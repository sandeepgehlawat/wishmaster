//! Job route integration tests.
//!
//! Tests cover:
//! - POST /api/jobs (create job)
//! - GET /api/jobs (list jobs, excludes drafts)
//! - GET /api/jobs/:id (get job details)
//! - POST /api/jobs/:id/publish (draft -> open)
//! - POST /api/jobs/:id/select-bid
//! - POST /api/jobs/:id/approve
//! - Authorization checks (wrong user gets 403)

mod common;

use axum::{
    body::Body,
    http::{Method, Request, StatusCode},
    Router,
};
use common::*;
use serde_json::{json, Value};
use std::sync::Arc;
use tower::ServiceExt;
use uuid::Uuid;

/// Build the test application router with services.
fn build_test_app(services: Arc<wishmaster_backend::services::Services>) -> Router {
    use axum::{
        middleware as axum_mw,
        routing::{get, post},
        Extension,
    };

    // Public routes
    let public_routes = Router::new()
        .route("/api/jobs", get(list_jobs_handler))
        .route("/api/jobs/:id", get(get_job_handler));

    // Protected routes (require auth)
    let protected_routes = Router::new()
        .route("/api/jobs", post(create_job_handler))
        .route("/api/jobs/:id/publish", post(publish_job_handler))
        .route("/api/jobs/:id/select-bid", post(select_bid_handler))
        .route("/api/jobs/:id/approve", post(approve_job_handler))
        .layer(axum_mw::from_fn_with_state(
            services.clone(),
            |axum::extract::State(services): axum::extract::State<Arc<wishmaster_backend::services::Services>>, req, next| async move {
                wishmaster_backend::middleware::auth::auth_middleware(Extension(services), req, next).await
            }
        ));

    Router::new()
        .merge(public_routes)
        .merge(protected_routes)
        .layer(Extension(services))
}

// Handler wrappers that mirror the actual routes
async fn list_jobs_handler(
    axum::Extension(services): axum::Extension<Arc<wishmaster_backend::services::Services>>,
    axum::extract::Query(query): axum::extract::Query<wishmaster_backend::models::JobListQuery>,
) -> Result<axum::Json<wishmaster_backend::models::JobListResponse>, wishmaster_backend::AppError> {
    let response = services.jobs.list_public(query).await?;
    Ok(axum::Json(response))
}

async fn get_job_handler(
    axum::Extension(services): axum::Extension<Arc<wishmaster_backend::services::Services>>,
    axum::extract::Path(id): axum::extract::Path<Uuid>,
) -> Result<axum::Json<wishmaster_backend::models::JobWithDetails>, wishmaster_backend::AppError> {
    let job = services.jobs.get_with_details(id).await?;
    Ok(axum::Json(job))
}

async fn create_job_handler(
    axum::Extension(services): axum::Extension<Arc<wishmaster_backend::services::Services>>,
    axum::Extension(auth): axum::Extension<wishmaster_backend::middleware::auth::AuthUser>,
    axum::Json(input): axum::Json<wishmaster_backend::models::CreateJob>,
) -> Result<axum::Json<wishmaster_backend::models::JobWithDetails>, wishmaster_backend::AppError> {
    let job = services.jobs.create(auth.id, input).await?;
    let details = services.jobs.get_with_details(job.id).await?;
    Ok(axum::Json(details))
}

async fn publish_job_handler(
    axum::Extension(services): axum::Extension<Arc<wishmaster_backend::services::Services>>,
    axum::Extension(auth): axum::Extension<wishmaster_backend::middleware::auth::AuthUser>,
    axum::extract::Path(id): axum::extract::Path<Uuid>,
) -> Result<axum::Json<Value>, wishmaster_backend::AppError> {
    use wishmaster_backend::AppError;

    // ATOMIC: Transition from 'draft' to 'open'
    let job = sqlx::query_as::<_, wishmaster_backend::models::Job>(
        r#"
        UPDATE jobs SET status = 'open', published_at = NOW()
        WHERE id = $1 AND client_id = $2 AND status = 'draft'
        RETURNING id, client_id, agent_id, creator_type, agent_creator_id, title, description,
                  task_type, required_skills, complexity, budget_min, budget_max, final_price,
                  pricing_model, deadline, bid_deadline, urgency, status, created_at, published_at,
                  started_at, delivered_at, completed_at, sandbox_url, sandbox_project_id
        "#
    )
    .bind(id)
    .bind(auth.id)
    .fetch_optional(&services.db)
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?
    .ok_or_else(|| AppError::Conflict("Job not found, not yours, or already published".to_string()))?;

    Ok(axum::Json(json!({
        "job_id": job.id,
        "status": "open",
        "published": true
    })))
}

async fn select_bid_handler(
    axum::Extension(services): axum::Extension<Arc<wishmaster_backend::services::Services>>,
    axum::Extension(auth): axum::Extension<wishmaster_backend::middleware::auth::AuthUser>,
    axum::extract::Path(id): axum::extract::Path<Uuid>,
    axum::Json(input): axum::Json<wishmaster_backend::models::SelectBidRequest>,
) -> Result<axum::Json<wishmaster_backend::models::JobWithDetails>, wishmaster_backend::AppError> {
    use wishmaster_backend::AppError;

    let job = services.jobs.get(id).await?;

    if job.client_id != Some(auth.id) {
        return Err(AppError::Forbidden("Not your job".to_string()));
    }

    if job.status != "bidding" && job.status != "open" {
        return Err(AppError::BadRequest(format!("Job not in bidding status (current: {})", job.status)));
    }

    // Get and accept the bid
    let bid = services.bids.get(input.bid_id).await?;
    if bid.job_id != id {
        return Err(AppError::BadRequest("Bid does not belong to this job".to_string()));
    }

    services.bids.accept(input.bid_id).await?;

    // Assign agent to job
    let price: f64 = bid.bid_amount.to_string().parse().unwrap_or(0.0);
    services.jobs.assign_agent(id, bid.agent_id, price).await?;

    let details = services.jobs.get_with_details(id).await?;
    Ok(axum::Json(details))
}

async fn approve_job_handler(
    axum::Extension(services): axum::Extension<Arc<wishmaster_backend::services::Services>>,
    axum::Extension(auth): axum::Extension<wishmaster_backend::middleware::auth::AuthUser>,
    axum::extract::Path(id): axum::extract::Path<Uuid>,
) -> Result<axum::Json<Value>, wishmaster_backend::AppError> {
    use wishmaster_backend::AppError;

    // ATOMIC: Transition from 'delivered' to 'completed'
    let _job = sqlx::query_as::<_, wishmaster_backend::models::Job>(
        r#"
        UPDATE jobs SET status = 'completed', completed_at = NOW()
        WHERE id = $1 AND client_id = $2 AND status = 'delivered'
        RETURNING id, client_id, agent_id, creator_type, agent_creator_id, title, description,
                  task_type, required_skills, complexity, budget_min, budget_max, final_price,
                  pricing_model, deadline, bid_deadline, urgency, status, created_at, published_at,
                  started_at, delivered_at, completed_at, sandbox_url, sandbox_project_id
        "#
    )
    .bind(id)
    .bind(auth.id)
    .fetch_optional(&services.db)
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?
    .ok_or_else(|| AppError::Conflict("Job not found, not yours, or not in delivered status".to_string()))?;

    Ok(axum::Json(json!({
        "completed": true,
        "message": "Job approved and completed"
    })))
}

// ============================================================================
// CREATE JOB TESTS
// ============================================================================

#[tokio::test]
async fn test_create_job_success() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let app = build_test_app(ctx.services.clone());

    let body = json!({
        "title": "Test Job Creation Via API",
        "description": "Testing job creation through the API endpoint",
        "task_type": "coding",
        "required_skills": ["rust", "testing"],
        "complexity": "moderate",
        "budget_min": 100.0,
        "budget_max": 500.0,
        "urgency": "standard"
    });

    let request = Request::builder()
        .method(Method::POST)
        .uri("/api/jobs")
        .header("Authorization", format!("Bearer {}", user.jwt_token))
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["title"], "Test Job Creation Via API");
    assert_eq!(json["status"], "draft");
    assert!(json["id"].is_string());
}

#[tokio::test]
async fn test_create_job_requires_auth() {
    let ctx = TestContext::new().await;
    let app = build_test_app(ctx.services.clone());

    let body = json!({
        "title": "Test Job Without Auth",
        "description": "This should fail",
        "task_type": "coding",
        "required_skills": ["rust"],
        "budget_min": 100.0,
        "budget_max": 500.0
    });

    let request = Request::builder()
        .method(Method::POST)
        .uri("/api/jobs")
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_create_job_invalid_token() {
    let ctx = TestContext::new().await;
    let app = build_test_app(ctx.services.clone());

    let body = json!({
        "title": "Test Job With Invalid Token",
        "description": "This should fail",
        "task_type": "coding",
        "required_skills": ["rust"],
        "budget_min": 100.0,
        "budget_max": 500.0
    });

    let request = Request::builder()
        .method(Method::POST)
        .uri("/api/jobs")
        .header("Authorization", "Bearer invalid.token.here")
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

// ============================================================================
// LIST JOBS TESTS
// ============================================================================

#[tokio::test]
async fn test_list_jobs_public() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let app = build_test_app(ctx.services.clone());

    // Create a job and set it to 'open' status
    let job = create_test_job(&ctx, user.id, None).await;
    set_job_status(&ctx, job.id, "open").await;

    let request = Request::builder()
        .method(Method::GET)
        .uri("/api/jobs")
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert!(json["jobs"].is_array());
    // Should find the open job
    let jobs = json["jobs"].as_array().unwrap();
    assert!(jobs.iter().any(|j| j["id"] == job.id.to_string()));
}

#[tokio::test]
async fn test_list_jobs_excludes_drafts() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let app = build_test_app(ctx.services.clone());

    // Create a draft job (default status)
    let draft_job = create_test_job(&ctx, user.id, Some(TestJobInput {
        title: format!("Draft Job {}", Uuid::new_v4()),
        ..Default::default()
    })).await;

    let request = Request::builder()
        .method(Method::GET)
        .uri("/api/jobs?limit=100")
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();

    let jobs = json["jobs"].as_array().unwrap();
    // Draft jobs should NOT appear in public listing
    assert!(
        !jobs.iter().any(|j| j["id"] == draft_job.id.to_string()),
        "Draft jobs should not appear in public listing"
    );
}

#[tokio::test]
async fn test_list_jobs_with_pagination() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let app = build_test_app(ctx.services.clone());

    // Create multiple open jobs
    for i in 0..5 {
        let job = create_test_job(&ctx, user.id, Some(TestJobInput {
            title: format!("Paginated Job {}", i),
            ..Default::default()
        })).await;
        set_job_status(&ctx, job.id, "open").await;
    }

    let request = Request::builder()
        .method(Method::GET)
        .uri("/api/jobs?page=1&limit=2")
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["limit"], 2);
    assert!(json["total"].as_i64().unwrap() >= 5);
}

// ============================================================================
// GET JOB DETAILS TESTS
// ============================================================================

#[tokio::test]
async fn test_get_job_details_open_job() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let app = build_test_app(ctx.services.clone());

    let job = create_test_job(&ctx, user.id, None).await;
    set_job_status(&ctx, job.id, "open").await;

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/api/jobs/{}", job.id))
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["id"], job.id.to_string());
    assert_eq!(json["title"], job.title);
    assert_eq!(json["status"], "open");
}

#[tokio::test]
async fn test_get_job_not_found() {
    let ctx = TestContext::new().await;
    let app = build_test_app(ctx.services.clone());

    let non_existent_id = Uuid::new_v4();

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/api/jobs/{}", non_existent_id))
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

// ============================================================================
// PUBLISH JOB TESTS
// ============================================================================

#[tokio::test]
async fn test_publish_job_success() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let app = build_test_app(ctx.services.clone());

    let job = create_test_job(&ctx, user.id, None).await;

    let request = Request::builder()
        .method(Method::POST)
        .uri(format!("/api/jobs/{}/publish", job.id))
        .header("Authorization", format!("Bearer {}", user.jwt_token))
        .header("Content-Type", "application/json")
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["job_id"], job.id.to_string());
    assert_eq!(json["status"], "open");
    assert_eq!(json["published"], true);
}

#[tokio::test]
async fn test_publish_job_wrong_user_forbidden() {
    let ctx = TestContext::new().await;
    let owner = create_test_user(&ctx, None).await;
    let other_user = create_test_user(&ctx, None).await;
    let app = build_test_app(ctx.services.clone());

    let job = create_test_job(&ctx, owner.id, None).await;

    // Other user tries to publish owner's job
    let request = Request::builder()
        .method(Method::POST)
        .uri(format!("/api/jobs/{}/publish", job.id))
        .header("Authorization", format!("Bearer {}", other_user.jwt_token))
        .header("Content-Type", "application/json")
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    // Should fail because the job doesn't belong to other_user
    assert_eq!(response.status(), StatusCode::CONFLICT);
}

#[tokio::test]
async fn test_publish_already_open_job_fails() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let app = build_test_app(ctx.services.clone());

    let job = create_test_job(&ctx, user.id, None).await;
    set_job_status(&ctx, job.id, "open").await;

    let request = Request::builder()
        .method(Method::POST)
        .uri(format!("/api/jobs/{}/publish", job.id))
        .header("Authorization", format!("Bearer {}", user.jwt_token))
        .header("Content-Type", "application/json")
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    // Should fail because job is already published
    assert_eq!(response.status(), StatusCode::CONFLICT);
}

#[tokio::test]
async fn test_publish_job_requires_auth() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let app = build_test_app(ctx.services.clone());

    let job = create_test_job(&ctx, user.id, None).await;

    let request = Request::builder()
        .method(Method::POST)
        .uri(format!("/api/jobs/{}/publish", job.id))
        .header("Content-Type", "application/json")
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

// ============================================================================
// SELECT BID TESTS
// ============================================================================

#[tokio::test]
async fn test_select_bid_success() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let agent = create_test_agent(&ctx, None).await;
    let app = build_test_app(ctx.services.clone());

    // Create and publish job
    let job = create_test_job(&ctx, user.id, None).await;
    set_job_status(&ctx, job.id, "open").await;

    // Submit a bid
    let bid_input = wishmaster_backend::models::SubmitBid {
        bid_amount: 250.0,
        estimated_hours: Some(10.0),
        estimated_completion: None,
        proposal: "I will complete this task professionally".to_string(),
        approach: Some("Test approach".to_string()),
        relevant_work: None,
    };
    let bid = ctx.services.bids.submit(job.id, agent.id, bid_input).await.unwrap();

    // Select the bid
    let body = json!({ "bid_id": bid.id.to_string() });

    let request = Request::builder()
        .method(Method::POST)
        .uri(format!("/api/jobs/{}/select-bid", job.id))
        .header("Authorization", format!("Bearer {}", user.jwt_token))
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["agent_id"], agent.id.to_string());
    assert_eq!(json["status"], "assigned");
}

#[tokio::test]
async fn test_select_bid_wrong_user_forbidden() {
    let ctx = TestContext::new().await;
    let owner = create_test_user(&ctx, None).await;
    let other_user = create_test_user(&ctx, None).await;
    let agent = create_test_agent(&ctx, None).await;
    let app = build_test_app(ctx.services.clone());

    // Create and publish job
    let job = create_test_job(&ctx, owner.id, None).await;
    set_job_status(&ctx, job.id, "open").await;

    // Submit a bid
    let bid_input = wishmaster_backend::models::SubmitBid {
        bid_amount: 250.0,
        estimated_hours: Some(10.0),
        estimated_completion: None,
        proposal: "Test proposal".to_string(),
        approach: None,
        relevant_work: None,
    };
    let bid = ctx.services.bids.submit(job.id, agent.id, bid_input).await.unwrap();

    // Other user tries to select bid
    let body = json!({ "bid_id": bid.id.to_string() });

    let request = Request::builder()
        .method(Method::POST)
        .uri(format!("/api/jobs/{}/select-bid", job.id))
        .header("Authorization", format!("Bearer {}", other_user.jwt_token))
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn test_select_bid_wrong_job_fails() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let agent = create_test_agent(&ctx, None).await;
    let app = build_test_app(ctx.services.clone());

    // Create two jobs
    let job1 = create_test_job(&ctx, user.id, None).await;
    let job2 = create_test_job(&ctx, user.id, None).await;
    set_job_status(&ctx, job1.id, "open").await;
    set_job_status(&ctx, job2.id, "open").await;

    // Submit bid on job2
    let bid_input = wishmaster_backend::models::SubmitBid {
        bid_amount: 250.0,
        estimated_hours: Some(10.0),
        estimated_completion: None,
        proposal: "Test proposal".to_string(),
        approach: None,
        relevant_work: None,
    };
    let bid = ctx.services.bids.submit(job2.id, agent.id, bid_input).await.unwrap();

    // Try to select job2's bid for job1
    let body = json!({ "bid_id": bid.id.to_string() });

    let request = Request::builder()
        .method(Method::POST)
        .uri(format!("/api/jobs/{}/select-bid", job1.id))
        .header("Authorization", format!("Bearer {}", user.jwt_token))
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

// ============================================================================
// APPROVE JOB TESTS
// ============================================================================

#[tokio::test]
async fn test_approve_job_success() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let agent = create_test_agent(&ctx, None).await;
    let app = build_test_app(ctx.services.clone());

    // Create job and set to delivered status
    let job = create_test_job(&ctx, user.id, None).await;

    // Assign agent and set status
    sqlx::query("UPDATE jobs SET agent_id = $2, status = 'delivered', delivered_at = NOW() WHERE id = $1")
        .bind(job.id)
        .bind(agent.id)
        .execute(&ctx.pool)
        .await
        .unwrap();

    let request = Request::builder()
        .method(Method::POST)
        .uri(format!("/api/jobs/{}/approve", job.id))
        .header("Authorization", format!("Bearer {}", user.jwt_token))
        .header("Content-Type", "application/json")
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["completed"], true);
}

#[tokio::test]
async fn test_approve_job_wrong_user_forbidden() {
    let ctx = TestContext::new().await;
    let owner = create_test_user(&ctx, None).await;
    let other_user = create_test_user(&ctx, None).await;
    let agent = create_test_agent(&ctx, None).await;
    let app = build_test_app(ctx.services.clone());

    // Create job and set to delivered status
    let job = create_test_job(&ctx, owner.id, None).await;

    sqlx::query("UPDATE jobs SET agent_id = $2, status = 'delivered', delivered_at = NOW() WHERE id = $1")
        .bind(job.id)
        .bind(agent.id)
        .execute(&ctx.pool)
        .await
        .unwrap();

    // Other user tries to approve
    let request = Request::builder()
        .method(Method::POST)
        .uri(format!("/api/jobs/{}/approve", job.id))
        .header("Authorization", format!("Bearer {}", other_user.jwt_token))
        .header("Content-Type", "application/json")
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::CONFLICT);
}

#[tokio::test]
async fn test_approve_job_not_delivered_fails() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let app = build_test_app(ctx.services.clone());

    // Create job in draft status (not delivered)
    let job = create_test_job(&ctx, user.id, None).await;

    let request = Request::builder()
        .method(Method::POST)
        .uri(format!("/api/jobs/{}/approve", job.id))
        .header("Authorization", format!("Bearer {}", user.jwt_token))
        .header("Content-Type", "application/json")
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    // Should fail because job is not in delivered status
    assert_eq!(response.status(), StatusCode::CONFLICT);
}

// ============================================================================
// AUTHORIZATION TESTS
// ============================================================================

#[tokio::test]
async fn test_missing_auth_header_returns_401() {
    let ctx = TestContext::new().await;
    let app = build_test_app(ctx.services.clone());

    let request = Request::builder()
        .method(Method::POST)
        .uri("/api/jobs")
        .header("Content-Type", "application/json")
        .body(Body::from(r#"{"title":"test"}"#))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_invalid_jwt_returns_401() {
    let ctx = TestContext::new().await;
    let app = build_test_app(ctx.services.clone());

    let request = Request::builder()
        .method(Method::POST)
        .uri("/api/jobs")
        .header("Authorization", "Bearer invalid.jwt.token")
        .header("Content-Type", "application/json")
        .body(Body::from(r#"{"title":"test"}"#))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_malformed_auth_header_returns_401() {
    let ctx = TestContext::new().await;
    let app = build_test_app(ctx.services.clone());

    let request = Request::builder()
        .method(Method::POST)
        .uri("/api/jobs")
        .header("Authorization", "NotBearer token")
        .header("Content-Type", "application/json")
        .body(Body::from(r#"{"title":"test"}"#))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}
