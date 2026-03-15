use std::sync::Arc;
use axum::{
    Router,
    routing::{get, post, patch, delete},
    http::Method,
    Extension,
    middleware as axum_mw,
};
use tower_http::cors::{CorsLayer, Any};
use tower_http::trace::TraceLayer;
use sqlx::postgres::PgPoolOptions;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod config;
mod error;
mod routes;
mod services;
mod models;
mod middleware;

use config::Config;
use services::Services;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::try_from_default_env()
            .unwrap_or_else(|_| "agenthive_backend=debug,tower_http=debug".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load configuration
    dotenvy::dotenv().ok();
    let config = Config::from_env()?;

    tracing::info!("Starting AgentHive backend on {}", config.server_addr);

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

    // Start server
    let listener = tokio::net::TcpListener::bind(&config.server_addr).await?;
    tracing::info!("Server listening on {}", config.server_addr);

    axum::serve(listener, app).await?;

    Ok(())
}

fn build_router(services: Arc<Services>) -> Router {
    // CORS configuration
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::PATCH, Method::DELETE, Method::OPTIONS])
        .allow_headers(Any);

    // Public routes (no auth required)
    let public_routes = Router::new()
        .route("/health", get(routes::health::health_check))
        .route("/api/auth/challenge", post(routes::auth::get_challenge))
        .route("/api/auth/verify", post(routes::auth::verify_signature))
        .route("/api/auth/refresh", post(routes::auth::refresh_token))
        .route("/api/agents", get(routes::agents::list_agents))
        .route("/api/agents/:id", get(routes::agents::get_agent))
        .route("/api/agents/:id/reputation", get(routes::agents::get_agent_reputation))
        .route("/api/agents/:id/portfolio", get(routes::agents::get_portfolio))
        .route("/api/agents/:id/ratings", get(routes::ratings::get_agent_ratings))
        .route("/api/jobs", get(routes::jobs::list_jobs))
        .route("/api/jobs/:id", get(routes::jobs::get_job))
        .route("/api/users/:id/reputation", get(routes::users::get_reputation))
        .route("/api/users/:id/ratings", get(routes::ratings::get_user_ratings))
        // WebSocket routes for real-time updates
        .route("/ws/jobs/:id", get(routes::websocket::job_updates))
        .route("/ws/agent/:id", get(routes::websocket::agent_notifications));

    // Protected routes (auth required)
    let protected_routes = Router::new()
        .route("/api/users/me", get(routes::users::get_current_user))
        .route("/api/users/me", patch(routes::users::update_current_user))
        .route("/api/agents", post(routes::agents::register_agent))
        .route("/api/jobs", post(routes::jobs::create_job))
        .route("/api/jobs/:id", patch(routes::jobs::update_job))
        .route("/api/jobs/:id/publish", post(routes::jobs::publish_job))
        .route("/api/jobs/:id/cancel", post(routes::jobs::cancel_job))
        .route("/api/jobs/:id/select-bid", post(routes::jobs::select_bid))
        .route("/api/jobs/:id/approve", post(routes::jobs::approve_job))
        .route("/api/jobs/:id/revision", post(routes::jobs::request_revision))
        .route("/api/jobs/:id/dispute", post(routes::jobs::dispute_job))
        .route("/api/jobs/:id/bids", get(routes::bids::list_bids))
        .route("/api/jobs/:id/bids", post(routes::bids::submit_bid))
        .route("/api/bids/:id", patch(routes::bids::update_bid))
        .route("/api/bids/:id", delete(routes::bids::withdraw_bid))
        .route("/api/sandbox/claim", post(routes::sandbox::claim_job))
        .route("/api/sandbox/data/:file", get(routes::sandbox::stream_data))
        .route("/api/sandbox/progress", post(routes::sandbox::report_progress))
        .route("/api/sandbox/submit", post(routes::sandbox::submit_results))
        .route("/api/sandbox/heartbeat", post(routes::sandbox::heartbeat))
        .route("/api/escrow/:job_id", get(routes::escrow::get_escrow))
        .route("/api/escrow/:job_id/fund", post(routes::escrow::generate_fund_tx))
        .route("/api/escrow/:job_id/release", post(routes::escrow::release_escrow))
        .route("/api/jobs/:id/rating", post(routes::ratings::submit_rating))
        .layer(axum_mw::from_fn_with_state(
            services.clone(),
            |axum::extract::State(services): axum::extract::State<Arc<Services>>, req, next| async move {
                crate::middleware::auth::auth_middleware(Extension(services), req, next).await
            }
        ));

    Router::new()
        .merge(public_routes)
        .merge(protected_routes)
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .layer(Extension(services))
}
