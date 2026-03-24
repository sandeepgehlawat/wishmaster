use std::sync::Arc;
use axum::{
    Router,
    routing::{get, post, patch, delete},
    http::{Method, HeaderValue, header},
    Extension,
    middleware as axum_mw,
};
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tower_governor::{governor::GovernorConfigBuilder, GovernorLayer, key_extractor::SmartIpKeyExtractor};
use std::net::SocketAddr;
use axum::extract::connect_info::IntoMakeServiceWithConnectInfo;
use sqlx::postgres::PgPoolOptions;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod config;
mod error;
mod routes;
mod services;
mod models;
mod middleware;
mod validation;

use config::Config;
use services::Services;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::try_from_default_env()
            .unwrap_or_else(|_| "wishmaster_backend=debug,tower_http=debug".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load configuration
    dotenvy::dotenv().ok();
    let config = Config::from_env()?;

    tracing::info!("Starting WishMaster backend on {}", config.server_addr);

    // Database connection pool
    let db_pool = PgPoolOptions::new()
        .max_connections(config.db_max_connections)
        .connect(&config.database_url)
        .await?;

    // Run migrations
    sqlx::migrate!("./migrations")
        .run(&db_pool)
        .await?;

    tracing::info!("Database migrations complete");

    // Redis connection (optional for dev)
    let redis_client = if let Some(redis_url) = &config.redis_url {
        Some(redis::Client::open(redis_url.as_str())?)
    } else {
        tracing::warn!("Redis URL not configured, caching disabled");
        None
    };

    // Initialize services
    let services = Arc::new(Services::new(
        db_pool.clone(),
        redis_client,
        config.clone(),
    ));

    // Build routes
    let app = build_router(services);

    // Start server with ConnectInfo for rate limiting
    let listener = tokio::net::TcpListener::bind(&config.server_addr).await?;
    tracing::info!("Server listening on {}", config.server_addr);

    axum::serve(listener, app.into_make_service_with_connect_info::<SocketAddr>()).await?;

    Ok(())
}

fn build_router(services: Arc<Services>) -> Router {
    // CORS configuration - use allowed origins from config
    let allowed_origins: Vec<HeaderValue> = services
        .config
        .cors_allowed_origins
        .iter()
        .filter_map(|origin| origin.parse().ok())
        .collect();

    let cors = CorsLayer::new()
        .allow_origin(allowed_origins)
        .allow_methods([Method::GET, Method::POST, Method::PATCH, Method::DELETE, Method::OPTIONS])
        .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION, header::ACCEPT, header::HeaderName::from_static("x-api-key")])
        .allow_credentials(true);

    // Rate limiting configuration with SmartIpKeyExtractor for proxy support
    let governor_config = Arc::new(
        GovernorConfigBuilder::default()
            .per_second(services.config.rate_limit_requests_per_minute as u64 / 60)
            .burst_size(services.config.rate_limit_burst)
            .key_extractor(SmartIpKeyExtractor)
            .finish()
            .expect("Failed to create rate limiter config"),
    );

    let rate_limit_layer = GovernorLayer {
        config: governor_config,
    };

    tracing::info!(
        "Rate limiting: {} requests/min, burst: {}",
        services.config.rate_limit_requests_per_minute,
        services.config.rate_limit_burst
    );

    // Public routes (no auth required)
    let public_routes = Router::new()
        .route("/health", get(routes::health::health_check))
        .route("/health/ready", get(routes::metrics::readiness))
        .route("/health/live", get(routes::metrics::liveness))
        .route("/metrics", get(routes::metrics::metrics))
        .route("/api/auth/challenge", post(routes::auth::get_challenge))
        .route("/api/auth/verify", post(routes::auth::verify_signature))
        .route("/api/auth/refresh", post(routes::auth::refresh_token))
        .route("/api/agents", get(routes::agents::list_agents))
        .route("/api/agents/:id", get(routes::agents::get_agent))
        .route("/api/agents/:id/reputation", get(routes::agents::get_agent_reputation))
        .route("/api/agents/:id/portfolio", get(routes::agents::get_portfolio))
        .route("/api/agents/:id/ratings", get(routes::ratings::get_agent_ratings))
        // Agent registration is public - agents need to register before they have credentials
        .route("/api/agents/register", post(routes::agents::register_agent))
        .route("/api/jobs", get(routes::jobs::list_jobs))
        .route("/api/jobs/:id", get(routes::jobs::get_job))
        // Bids are public so agents can see competitive bids
        .route("/api/jobs/:id/bids", get(routes::bids::list_bids))
        .route("/api/stats", get(routes::stats::get_platform_stats))
        .route("/api/users/:id/reputation", get(routes::users::get_reputation))
        .route("/api/users/:id/ratings", get(routes::ratings::get_user_ratings))
        // WebSocket routes for real-time updates
        .route("/ws/jobs/:id", get(routes::websocket::job_updates))
        .route("/ws/agent/:id", get(routes::websocket::agent_notifications))
        // DEV ONLY: Send message as assigned agent (testing)
        .route("/api/jobs/:id/dev-agent-message", post(routes::messages::dev_agent_message))
        .route("/api/jobs/:id/dev-messages", get(routes::messages::dev_list_messages))
        .route("/api/jobs/:id/dev-publish", post(routes::jobs::dev_publish_job))
        .route("/api/jobs/:id/dev-fund", post(routes::escrow::dev_fund_escrow_noauth))
        .route("/api/jobs/:id/dev-bid", post(routes::bids::dev_submit_bid))
        .route("/api/jobs/:id/dev-deliver", post(routes::jobs::dev_deliver_job))
        .route("/api/jobs/:id/dev-approve", post(routes::jobs::dev_approve_job));

    // Protected routes (auth required)
    let protected_routes = Router::new()
        .route("/api/users/me", get(routes::users::get_current_user))
        .route("/api/users/me", patch(routes::users::update_current_user))
        .route("/api/agents", post(routes::agents::register_agent))
        .route("/api/jobs/mine", get(routes::jobs::list_my_jobs))
        .route("/api/jobs", post(routes::jobs::create_job))
        .route("/api/jobs/:id", patch(routes::jobs::update_job))
        .route("/api/jobs/:id/publish", post(routes::jobs::publish_job))
        .route("/api/jobs/:id/cancel", post(routes::jobs::cancel_job))
        .route("/api/jobs/:id/select-bid", post(routes::jobs::select_bid))
        .route("/api/jobs/:id/approve", post(routes::jobs::approve_job))
        .route("/api/jobs/:id/revision", post(routes::jobs::request_revision))
        .route("/api/jobs/:id/dispute", post(routes::jobs::dispute_job))
        // bids GET moved to public routes
        .route("/api/escrow/:job_id", get(routes::escrow::get_escrow))
        .route("/api/escrow/:job_id/fund", post(routes::escrow::generate_fund_tx))
        .route("/api/escrow/:job_id/release", post(routes::escrow::release_escrow))
        .route("/api/escrow/:job_id/confirm", post(routes::escrow::confirm_funding))
        .route("/api/escrow/:job_id/dev-fund", post(routes::escrow::dev_fund_escrow))
        .route("/api/jobs/:id/rating", post(routes::ratings::submit_rating))
        // messages routes moved to agent_routes for API key support (agent_auth_middleware supports JWT too)
        .route("/api/jobs/:id/messages/read", post(routes::messages::mark_messages_read))
        .route("/api/jobs/:id/messages/unread", get(routes::messages::get_unread_count))
        // Requirements
        .route("/api/jobs/:id/requirements", get(routes::requirements::list_requirements))
        .route("/api/jobs/:id/requirements", post(routes::requirements::add_requirement))
        .route("/api/requirements/:id", patch(routes::requirements::update_requirement))
        .route("/api/requirements/:id", delete(routes::requirements::delete_requirement))
        // deliver route moved to agent_routes for API key support
        .route("/api/requirements/:id/accept", post(routes::requirements::accept_requirement))
        .route("/api/requirements/:id/reject", post(routes::requirements::reject_requirement))
        // Deliverables
        .route("/api/jobs/:id/deliverables", get(routes::deliverables::list_deliverables))
        // submit_deliverable moved to agent_routes for API key support
        .route("/api/deliverables/:id/approve", post(routes::deliverables::approve_deliverable))
        .route("/api/deliverables/:id/request-changes", post(routes::deliverables::request_changes))
        // Activity
        .route("/api/jobs/:id/activity", get(routes::activity::list_activities))
        // Portfolio
        .route("/api/portfolio", post(routes::portfolio::create_portfolio_item))
        .route("/api/portfolio/:id", patch(routes::portfolio::update_portfolio_item))
        .route("/api/portfolio/:id", delete(routes::portfolio::delete_portfolio_item))
        .route("/api/portfolio/from-job/:job_id", post(routes::portfolio::create_from_job))
        // Managed Services
        .route("/api/services", get(routes::services::list_services))
        .route("/api/services/:id", get(routes::services::get_service))
        .route("/api/services/:id", patch(routes::services::update_service))
        .route("/api/services/:id/pause", post(routes::services::pause_service))
        .route("/api/services/:id/resume", post(routes::services::resume_service))
        .route("/api/services/:id/cancel", post(routes::services::cancel_service))
        .route("/api/jobs/:id/convert-to-service", post(routes::services::convert_to_service))
        .route("/api/services/:id/accept", post(routes::services::accept_service))
        // Service Updates
        .route("/api/services/:id/updates", get(routes::services::list_updates))
        // create_update moved to agent_routes for API key support
        .route("/api/service-updates/:id/approve", post(routes::services::approve_update))
        .route("/api/service-updates/:id/reject", post(routes::services::reject_update))
        .route("/api/service-updates/:id/deploy", post(routes::services::deploy_update))
        // Service Billing
        .route("/api/services/:id/billing", get(routes::services::list_billing))
        .layer(axum_mw::from_fn_with_state(
            services.clone(),
            |axum::extract::State(services): axum::extract::State<Arc<Services>>, req, next| async move {
                crate::middleware::auth::auth_middleware(Extension(services), req, next).await
            }
        ));

    // Agent SDK routes (supports both JWT and X-API-Key auth)
    let agent_routes = Router::new()
        // Agent-to-Agent Job Creation (NEW)
        .route("/api/agent/jobs", post(routes::jobs::create_job_as_agent))
        .route("/api/agent/jobs", get(routes::jobs::list_agent_jobs))
        .route("/api/agent/jobs/:id", get(routes::jobs::get_agent_job))
        .route("/api/agent/jobs/:id/publish", post(routes::jobs::publish_agent_job))
        .route("/api/agent/jobs/:id/select-bid", post(routes::jobs::select_bid_as_agent))
        .route("/api/agent/jobs/:id/approve", post(routes::jobs::approve_agent_job))
        // Bidding
        .route("/api/jobs/:id/bids", post(routes::bids::submit_bid))
        .route("/api/bids/:id", patch(routes::bids::update_bid))
        .route("/api/bids/:id", delete(routes::bids::withdraw_bid))
        // Sandbox
        .route("/api/sandbox/claim", post(routes::sandbox::claim_job))
        .route("/api/sandbox/data/:file", get(routes::sandbox::stream_data))
        .route("/api/sandbox/progress", post(routes::sandbox::report_progress))
        .route("/api/sandbox/submit", post(routes::sandbox::submit_results))
        .route("/api/sandbox/heartbeat", post(routes::sandbox::heartbeat))
        // Deliver requirements
        .route("/api/requirements/:id/deliver", post(routes::requirements::deliver_requirement))
        // Submit deliverables
        .route("/api/jobs/:id/deliverables", post(routes::deliverables::submit_deliverable))
        // Messages
        .route("/api/jobs/:id/messages", get(routes::messages::list_messages))
        .route("/api/jobs/:id/messages", post(routes::messages::send_message))
        // Service updates (for managed services)
        .route("/api/services/:id/updates", post(routes::services::create_update))
        .layer(axum_mw::from_fn_with_state(
            services.clone(),
            |axum::extract::State(services): axum::extract::State<Arc<Services>>, req, next| async move {
                crate::middleware::auth::agent_auth_middleware(Extension(services), req, next).await
            }
        ));

    // Paid routes (require x402 payment + agent auth)
    // These endpoints require payment via the x402 protocol before access is granted
    // Middleware order: auth runs first (innermost), then x402 payment verification
    let paid_routes = Router::new()
        // Paid compute endpoint ($10)
        .route("/api/agent/paid/compute", post(routes::paid::execute_compute))
        // Paid data query endpoint ($5)
        .route("/api/agent/paid/data/query", post(routes::paid::query_data))
        // Paid analysis endpoint ($7.50)
        .route("/api/agent/paid/analysis", post(routes::paid::run_analysis))
        // Paid health check for testing ($1)
        .route("/api/agent/paid/health", get(routes::paid::paid_health_check))
        // Apply agent auth middleware first (runs before x402)
        .layer(axum_mw::from_fn_with_state(
            services.clone(),
            |axum::extract::State(services): axum::extract::State<Arc<Services>>, req, next| async move {
                crate::middleware::auth::agent_auth_middleware(Extension(services), req, next).await
            }
        ))
        // Then apply x402 payment middleware (runs after auth)
        .layer(axum_mw::from_fn_with_state(
            services.clone(),
            crate::middleware::x402::x402_payment_middleware,
        ));

    let is_dev = std::env::var("ENVIRONMENT").unwrap_or_default() == "development";

    let app = Router::new()
        .merge(public_routes)
        .merge(agent_routes)
        .merge(paid_routes)
        .merge(protected_routes)
        .layer(TraceLayer::new_for_http());

    let app = if is_dev {
        tracing::info!("Development mode: rate limiting DISABLED");
        app
    } else {
        app.layer(rate_limit_layer)
    };

    app.layer(cors)
        .layer(Extension(services))
}
