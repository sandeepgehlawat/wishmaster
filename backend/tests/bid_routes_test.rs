//! Bid route integration tests.
//!
//! Tests cover:
//! - POST /api/jobs/:id/bids (submit bid)
//! - PATCH /api/bids/:id (update bid)
//! - DELETE /api/bids/:id (withdraw bid)
//! - Agent cannot bid on own job (agent-to-agent scenario)

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
        routing::{delete, get, patch, post},
        Extension,
    };

    // Public routes
    let public_routes = Router::new()
        .route("/api/jobs/:id/bids", get(list_bids_handler));

    // Agent routes (require agent auth)
    let agent_routes = Router::new()
        .route("/api/jobs/:id/bids", post(submit_bid_handler))
        .route("/api/bids/:id", patch(update_bid_handler))
        .route("/api/bids/:id", delete(withdraw_bid_handler))
        .layer(axum_mw::from_fn_with_state(
            services.clone(),
            |axum::extract::State(services): axum::extract::State<Arc<wishmaster_backend::services::Services>>, req, next| async move {
                wishmaster_backend::middleware::auth::agent_auth_middleware(Extension(services), req, next).await
            }
        ));

    Router::new()
        .merge(public_routes)
        .merge(agent_routes)
        .layer(Extension(services))
}

// Handler wrappers
async fn list_bids_handler(
    axum::Extension(services): axum::Extension<Arc<wishmaster_backend::services::Services>>,
    axum::extract::Path(job_id): axum::extract::Path<Uuid>,
) -> Result<axum::Json<wishmaster_backend::models::BidListResponse>, wishmaster_backend::AppError> {
    use wishmaster_backend::AppError;

    // Verify job exists and is public
    let job_status: String = sqlx::query_scalar(
        "SELECT status FROM jobs WHERE id = $1"
    )
    .bind(job_id)
    .fetch_optional(&services.db)
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?
    .ok_or_else(|| AppError::NotFound("Job not found".to_string()))?;

    if job_status == "draft" {
        return Err(AppError::NotFound("Job not found".to_string()));
    }

    let response = services.bids.list_for_job(job_id).await?;
    Ok(axum::Json(response))
}

async fn submit_bid_handler(
    axum::Extension(services): axum::Extension<Arc<wishmaster_backend::services::Services>>,
    axum::Extension(auth): axum::Extension<wishmaster_backend::middleware::auth::AuthUser>,
    axum::extract::Path(job_id): axum::extract::Path<Uuid>,
    axum::Json(input): axum::Json<wishmaster_backend::models::SubmitBid>,
) -> Result<axum::Json<wishmaster_backend::models::Bid>, wishmaster_backend::AppError> {
    use wishmaster_backend::AppError;

    if auth.user_type != "agent" {
        return Err(AppError::Forbidden("Only agents can submit bids".to_string()));
    }

    // Verify job is open for bidding
    let job_status: String = sqlx::query_scalar(
        "SELECT status FROM jobs WHERE id = $1"
    )
    .bind(job_id)
    .fetch_optional(&services.db)
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?
    .ok_or_else(|| AppError::NotFound("Job not found".to_string()))?;

    if job_status != "open" && job_status != "bidding" {
        return Err(AppError::BadRequest("Job is not accepting bids".to_string()));
    }

    // Check if agent is the job creator (agent-to-agent scenario)
    let agent_creator_id: Option<Uuid> = sqlx::query_scalar(
        "SELECT agent_creator_id FROM jobs WHERE id = $1"
    )
    .bind(job_id)
    .fetch_one(&services.db)
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?;

    if agent_creator_id == Some(auth.id) {
        return Err(AppError::BadRequest("Cannot bid on your own job".to_string()));
    }

    let bid = services.bids.submit(job_id, auth.id, input).await?;
    Ok(axum::Json(bid))
}

async fn update_bid_handler(
    axum::Extension(services): axum::Extension<Arc<wishmaster_backend::services::Services>>,
    axum::Extension(auth): axum::Extension<wishmaster_backend::middleware::auth::AuthUser>,
    axum::extract::Path(bid_id): axum::extract::Path<Uuid>,
    axum::Json(input): axum::Json<wishmaster_backend::models::UpdateBid>,
) -> Result<axum::Json<wishmaster_backend::models::Bid>, wishmaster_backend::AppError> {
    use wishmaster_backend::AppError;

    if auth.user_type != "agent" {
        return Err(AppError::Forbidden("Only agents can update bids".to_string()));
    }

    let bid = services.bids.update(bid_id, auth.id, input).await?;
    Ok(axum::Json(bid))
}

async fn withdraw_bid_handler(
    axum::Extension(services): axum::Extension<Arc<wishmaster_backend::services::Services>>,
    axum::Extension(auth): axum::Extension<wishmaster_backend::middleware::auth::AuthUser>,
    axum::extract::Path(bid_id): axum::extract::Path<Uuid>,
) -> Result<axum::Json<wishmaster_backend::models::Bid>, wishmaster_backend::AppError> {
    use wishmaster_backend::AppError;

    if auth.user_type != "agent" {
        return Err(AppError::Forbidden("Only agents can withdraw bids".to_string()));
    }

    let bid = services.bids.withdraw(bid_id, auth.id).await?;
    Ok(axum::Json(bid))
}

// ============================================================================
// SUBMIT BID TESTS
// ============================================================================

#[tokio::test]
async fn test_submit_bid_success() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let agent = create_test_agent(&ctx, None).await;
    let app = build_test_app(ctx.services.clone());

    // Create and publish job
    let job = create_test_job(&ctx, user.id, None).await;
    set_job_status(&ctx, job.id, "open").await;

    let body = json!({
        "bid_amount": 250.0,
        "estimated_hours": 10.0,
        "proposal": "I will complete this task professionally and efficiently",
        "approach": "My approach involves careful analysis and implementation"
    });

    let request = Request::builder()
        .method(Method::POST)
        .uri(format!("/api/jobs/{}/bids", job.id))
        .header("Authorization", format!("Bearer {}", agent.jwt_token))
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["job_id"], job.id.to_string());
    assert_eq!(json["agent_id"], agent.id.to_string());
    assert_eq!(json["status"], "pending");
    assert!(json["id"].is_string());
}

#[tokio::test]
async fn test_submit_bid_with_api_key() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let agent = create_test_agent(&ctx, None).await;
    let app = build_test_app(ctx.services.clone());

    let job = create_test_job(&ctx, user.id, None).await;
    set_job_status(&ctx, job.id, "open").await;

    let body = json!({
        "bid_amount": 300.0,
        "estimated_hours": 15.0,
        "proposal": "API key authenticated bid submission"
    });

    let request = Request::builder()
        .method(Method::POST)
        .uri(format!("/api/jobs/{}/bids", job.id))
        .header("X-API-Key", &agent.api_key)
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["agent_id"], agent.id.to_string());
}

#[tokio::test]
async fn test_submit_bid_requires_agent_auth() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let app = build_test_app(ctx.services.clone());

    let job = create_test_job(&ctx, user.id, None).await;
    set_job_status(&ctx, job.id, "open").await;

    let body = json!({
        "bid_amount": 250.0,
        "proposal": "Test proposal"
    });

    // User (not agent) tries to submit bid
    let request = Request::builder()
        .method(Method::POST)
        .uri(format!("/api/jobs/{}/bids", job.id))
        .header("Authorization", format!("Bearer {}", user.jwt_token))
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn test_submit_bid_on_draft_job_fails() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let agent = create_test_agent(&ctx, None).await;
    let app = build_test_app(ctx.services.clone());

    // Create draft job (not published)
    let job = create_test_job(&ctx, user.id, None).await;

    let body = json!({
        "bid_amount": 250.0,
        "proposal": "Test proposal"
    });

    let request = Request::builder()
        .method(Method::POST)
        .uri(format!("/api/jobs/{}/bids", job.id))
        .header("Authorization", format!("Bearer {}", agent.jwt_token))
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_submit_duplicate_bid_fails() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let agent = create_test_agent(&ctx, None).await;
    let app = build_test_app(ctx.services.clone());

    let job = create_test_job(&ctx, user.id, None).await;
    set_job_status(&ctx, job.id, "open").await;

    // Submit first bid directly through service
    let bid_input = wishmaster_backend::models::SubmitBid {
        bid_amount: 250.0,
        estimated_hours: Some(10.0),
        estimated_completion: None,
        proposal: "First bid".to_string(),
        approach: None,
        relevant_work: None,
    };
    ctx.services.bids.submit(job.id, agent.id, bid_input).await.unwrap();

    // Try to submit second bid through API
    let body = json!({
        "bid_amount": 300.0,
        "proposal": "Second bid attempt"
    });

    let request = Request::builder()
        .method(Method::POST)
        .uri(format!("/api/jobs/{}/bids", job.id))
        .header("Authorization", format!("Bearer {}", agent.jwt_token))
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::CONFLICT);
}

#[tokio::test]
async fn test_submit_bid_on_nonexistent_job_fails() {
    let ctx = TestContext::new().await;
    let agent = create_test_agent(&ctx, None).await;
    let app = build_test_app(ctx.services.clone());

    let fake_job_id = Uuid::new_v4();

    let body = json!({
        "bid_amount": 250.0,
        "proposal": "Test proposal"
    });

    let request = Request::builder()
        .method(Method::POST)
        .uri(format!("/api/jobs/{}/bids", fake_job_id))
        .header("Authorization", format!("Bearer {}", agent.jwt_token))
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_agent_cannot_bid_on_own_job() {
    let ctx = TestContext::new().await;
    let agent = create_test_agent(&ctx, None).await;
    let app = build_test_app(ctx.services.clone());

    // Create job as agent (agent-to-agent scenario)
    let job_input = wishmaster_backend::models::CreateJob {
        title: "Agent-Created Job for Testing".to_string(),
        description: "This is a job created by an agent".to_string(),
        task_type: "coding".to_string(),
        required_skills: vec!["rust".to_string()],
        complexity: Some("simple".to_string()),
        budget_min: 100.0,
        budget_max: 500.0,
        deadline: None,
        bid_deadline: None,
        urgency: Some("standard".to_string()),
    };

    let job = ctx.services.jobs.create_by_agent(agent.id, job_input).await.unwrap();
    set_job_status(&ctx, job.id, "open").await;

    // Agent tries to bid on their own job
    let body = json!({
        "bid_amount": 250.0,
        "proposal": "Bidding on my own job"
    });

    let request = Request::builder()
        .method(Method::POST)
        .uri(format!("/api/jobs/{}/bids", job.id))
        .header("Authorization", format!("Bearer {}", agent.jwt_token))
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();

    // Verify error message
    let error_msg = json.get("error").and_then(|e| e.as_str()).unwrap_or("");
    assert!(error_msg.contains("own job") || error_msg.contains("Cannot bid"));
}

// ============================================================================
// UPDATE BID TESTS
// ============================================================================

#[tokio::test]
async fn test_update_bid_success() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let agent = create_test_agent(&ctx, None).await;
    let app = build_test_app(ctx.services.clone());

    let job = create_test_job(&ctx, user.id, None).await;
    set_job_status(&ctx, job.id, "open").await;

    // Submit bid
    let bid_input = wishmaster_backend::models::SubmitBid {
        bid_amount: 250.0,
        estimated_hours: Some(10.0),
        estimated_completion: None,
        proposal: "Original proposal".to_string(),
        approach: None,
        relevant_work: None,
    };
    let bid = ctx.services.bids.submit(job.id, agent.id, bid_input).await.unwrap();

    // Update the bid
    let body = json!({
        "bid_amount": 275.0,
        "proposal": "Updated proposal with more details"
    });

    let request = Request::builder()
        .method(Method::PATCH)
        .uri(format!("/api/bids/{}", bid.id))
        .header("Authorization", format!("Bearer {}", agent.jwt_token))
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["proposal"], "Updated proposal with more details");
    assert_eq!(json["revision_count"], 1);
}

#[tokio::test]
async fn test_update_bid_by_wrong_agent_fails() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let agent1 = create_test_agent(&ctx, None).await;
    let agent2 = create_test_agent(&ctx, None).await;
    let app = build_test_app(ctx.services.clone());

    let job = create_test_job(&ctx, user.id, None).await;
    set_job_status(&ctx, job.id, "open").await;

    // Agent1 submits bid
    let bid_input = wishmaster_backend::models::SubmitBid {
        bid_amount: 250.0,
        estimated_hours: Some(10.0),
        estimated_completion: None,
        proposal: "Agent 1 proposal".to_string(),
        approach: None,
        relevant_work: None,
    };
    let bid = ctx.services.bids.submit(job.id, agent1.id, bid_input).await.unwrap();

    // Agent2 tries to update Agent1's bid
    let body = json!({
        "proposal": "Unauthorized update"
    });

    let request = Request::builder()
        .method(Method::PATCH)
        .uri(format!("/api/bids/{}", bid.id))
        .header("Authorization", format!("Bearer {}", agent2.jwt_token))
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn test_update_bid_exceeds_revision_limit() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let agent = create_test_agent(&ctx, None).await;
    let app = build_test_app(ctx.services.clone());

    let job = create_test_job(&ctx, user.id, None).await;
    set_job_status(&ctx, job.id, "open").await;

    // Submit and update bid once
    let bid_input = wishmaster_backend::models::SubmitBid {
        bid_amount: 250.0,
        estimated_hours: Some(10.0),
        estimated_completion: None,
        proposal: "Original proposal".to_string(),
        approach: None,
        relevant_work: None,
    };
    let bid = ctx.services.bids.submit(job.id, agent.id, bid_input).await.unwrap();

    // First update (should succeed)
    let update1 = wishmaster_backend::models::UpdateBid {
        bid_amount: Some(275.0),
        estimated_hours: None,
        estimated_completion: None,
        proposal: Some("First revision".to_string()),
        approach: None,
    };
    ctx.services.bids.update(bid.id, agent.id, update1).await.unwrap();

    // Second update attempt (should fail - revision limit reached)
    let body = json!({
        "proposal": "Second revision attempt"
    });

    let request = Request::builder()
        .method(Method::PATCH)
        .uri(format!("/api/bids/{}", bid.id))
        .header("Authorization", format!("Bearer {}", agent.jwt_token))
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_update_nonexistent_bid_fails() {
    let ctx = TestContext::new().await;
    let agent = create_test_agent(&ctx, None).await;
    let app = build_test_app(ctx.services.clone());

    let fake_bid_id = Uuid::new_v4();

    let body = json!({
        "proposal": "Update nonexistent bid"
    });

    let request = Request::builder()
        .method(Method::PATCH)
        .uri(format!("/api/bids/{}", fake_bid_id))
        .header("Authorization", format!("Bearer {}", agent.jwt_token))
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

// ============================================================================
// WITHDRAW BID TESTS
// ============================================================================

#[tokio::test]
async fn test_withdraw_bid_success() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let agent = create_test_agent(&ctx, None).await;
    let app = build_test_app(ctx.services.clone());

    let job = create_test_job(&ctx, user.id, None).await;
    set_job_status(&ctx, job.id, "open").await;

    // Submit bid
    let bid_input = wishmaster_backend::models::SubmitBid {
        bid_amount: 250.0,
        estimated_hours: Some(10.0),
        estimated_completion: None,
        proposal: "Bid to withdraw".to_string(),
        approach: None,
        relevant_work: None,
    };
    let bid = ctx.services.bids.submit(job.id, agent.id, bid_input).await.unwrap();

    // Withdraw the bid
    let request = Request::builder()
        .method(Method::DELETE)
        .uri(format!("/api/bids/{}", bid.id))
        .header("Authorization", format!("Bearer {}", agent.jwt_token))
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["status"], "withdrawn");
}

#[tokio::test]
async fn test_withdraw_bid_by_wrong_agent_fails() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let agent1 = create_test_agent(&ctx, None).await;
    let agent2 = create_test_agent(&ctx, None).await;
    let app = build_test_app(ctx.services.clone());

    let job = create_test_job(&ctx, user.id, None).await;
    set_job_status(&ctx, job.id, "open").await;

    // Agent1 submits bid
    let bid_input = wishmaster_backend::models::SubmitBid {
        bid_amount: 250.0,
        estimated_hours: Some(10.0),
        estimated_completion: None,
        proposal: "Agent 1 bid".to_string(),
        approach: None,
        relevant_work: None,
    };
    let bid = ctx.services.bids.submit(job.id, agent1.id, bid_input).await.unwrap();

    // Agent2 tries to withdraw Agent1's bid
    let request = Request::builder()
        .method(Method::DELETE)
        .uri(format!("/api/bids/{}", bid.id))
        .header("Authorization", format!("Bearer {}", agent2.jwt_token))
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn test_withdraw_accepted_bid_fails() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let agent = create_test_agent(&ctx, None).await;
    let app = build_test_app(ctx.services.clone());

    let job = create_test_job(&ctx, user.id, None).await;
    set_job_status(&ctx, job.id, "open").await;

    // Submit and accept bid
    let bid_input = wishmaster_backend::models::SubmitBid {
        bid_amount: 250.0,
        estimated_hours: Some(10.0),
        estimated_completion: None,
        proposal: "Accepted bid".to_string(),
        approach: None,
        relevant_work: None,
    };
    let bid = ctx.services.bids.submit(job.id, agent.id, bid_input).await.unwrap();
    ctx.services.bids.accept(bid.id).await.unwrap();

    // Try to withdraw accepted bid
    let request = Request::builder()
        .method(Method::DELETE)
        .uri(format!("/api/bids/{}", bid.id))
        .header("Authorization", format!("Bearer {}", agent.jwt_token))
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_withdraw_nonexistent_bid_fails() {
    let ctx = TestContext::new().await;
    let agent = create_test_agent(&ctx, None).await;
    let app = build_test_app(ctx.services.clone());

    let fake_bid_id = Uuid::new_v4();

    let request = Request::builder()
        .method(Method::DELETE)
        .uri(format!("/api/bids/{}", fake_bid_id))
        .header("Authorization", format!("Bearer {}", agent.jwt_token))
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

// ============================================================================
// LIST BIDS TESTS
// ============================================================================

#[tokio::test]
async fn test_list_bids_public() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let agent = create_test_agent(&ctx, None).await;
    let app = build_test_app(ctx.services.clone());

    let job = create_test_job(&ctx, user.id, None).await;
    set_job_status(&ctx, job.id, "open").await;

    // Submit a bid
    let bid_input = wishmaster_backend::models::SubmitBid {
        bid_amount: 250.0,
        estimated_hours: Some(10.0),
        estimated_completion: None,
        proposal: "Test bid".to_string(),
        approach: None,
        relevant_work: None,
    };
    let bid = ctx.services.bids.submit(job.id, agent.id, bid_input).await.unwrap();

    // List bids (no auth required)
    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/api/jobs/{}/bids", job.id))
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert!(json["bids"].is_array());
    let bids = json["bids"].as_array().unwrap();
    assert!(bids.iter().any(|b| b["id"] == bid.id.to_string()));
}

#[tokio::test]
async fn test_list_bids_draft_job_fails() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let app = build_test_app(ctx.services.clone());

    // Create draft job
    let job = create_test_job(&ctx, user.id, None).await;

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/api/jobs/{}/bids", job.id))
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_list_bids_excludes_withdrawn() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let agent = create_test_agent(&ctx, None).await;
    let app = build_test_app(ctx.services.clone());

    let job = create_test_job(&ctx, user.id, None).await;
    set_job_status(&ctx, job.id, "open").await;

    // Submit and withdraw a bid
    let bid_input = wishmaster_backend::models::SubmitBid {
        bid_amount: 250.0,
        estimated_hours: Some(10.0),
        estimated_completion: None,
        proposal: "Withdrawn bid".to_string(),
        approach: None,
        relevant_work: None,
    };
    let bid = ctx.services.bids.submit(job.id, agent.id, bid_input).await.unwrap();
    ctx.services.bids.withdraw(bid.id, agent.id).await.unwrap();

    // List bids
    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/api/jobs/{}/bids", job.id))
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();

    let bids = json["bids"].as_array().unwrap();
    // Withdrawn bids should not appear
    assert!(!bids.iter().any(|b| b["id"] == bid.id.to_string()));
}

// ============================================================================
// AUTHORIZATION TESTS
// ============================================================================

#[tokio::test]
async fn test_bid_operations_require_agent_type() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let app = build_test_app(ctx.services.clone());

    let job = create_test_job(&ctx, user.id, None).await;
    set_job_status(&ctx, job.id, "open").await;

    // User (not agent) tries to submit bid
    let body = json!({
        "bid_amount": 250.0,
        "proposal": "User bid attempt"
    });

    let request = Request::builder()
        .method(Method::POST)
        .uri(format!("/api/jobs/{}/bids", job.id))
        .header("Authorization", format!("Bearer {}", user.jwt_token))
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn test_invalid_api_key_returns_401() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let app = build_test_app(ctx.services.clone());

    let job = create_test_job(&ctx, user.id, None).await;
    set_job_status(&ctx, job.id, "open").await;

    let body = json!({
        "bid_amount": 250.0,
        "proposal": "Invalid API key test"
    });

    let request = Request::builder()
        .method(Method::POST)
        .uri(format!("/api/jobs/{}/bids", job.id))
        .header("X-API-Key", "ahk_invalid_key_12345678901234567890")
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}
