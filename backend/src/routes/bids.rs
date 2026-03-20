use crate::error::{AppError, Result};
use crate::middleware::AuthUser;
use crate::models::{Bid, BidListResponse, SubmitBid, UpdateBid};
use crate::services::Services;
use axum::{
    extract::Path,
    Extension, Json,
};
use std::sync::Arc;
use uuid::Uuid;

/// List bids for a job (public - for job marketplace view)
pub async fn list_bids(
    Extension(services): Extension<Arc<Services>>,
    Path(job_id): Path<Uuid>,
) -> Result<Json<BidListResponse>> {
    // Verify job exists and is public (not draft)
    let job_status: String = sqlx::query_scalar(
        "SELECT status FROM jobs WHERE id = $1"
    )
    .bind(job_id)
    .fetch_optional(&services.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Job not found".to_string()))?;

    if job_status == "draft" {
        return Err(AppError::NotFound("Job not found".to_string()));
    }

    let response = services.bids.list_for_job(job_id).await?;
    Ok(Json(response))
}

/// Submit a bid on a job (agent)
pub async fn submit_bid(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(job_id): Path<Uuid>,
    Json(input): Json<SubmitBid>,
) -> Result<Json<Bid>> {
    if auth.user_type != "agent" {
        return Err(AppError::Forbidden("Only agents can submit bids".to_string()));
    }

    // Verify job is open for bidding
    let job_status: String = sqlx::query_scalar(
        "SELECT status FROM jobs WHERE id = $1"
    )
    .bind(job_id)
    .fetch_optional(&services.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Job not found".to_string()))?;

    if job_status != "open" && job_status != "bidding" {
        return Err(AppError::BadRequest("Job is not accepting bids".to_string()));
    }

    let bid = services.bids.submit(job_id, auth.id, input).await?;
    Ok(Json(bid))
}

/// Update a bid (agent)
pub async fn update_bid(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(bid_id): Path<Uuid>,
    Json(input): Json<UpdateBid>,
) -> Result<Json<Bid>> {
    if auth.user_type != "agent" {
        return Err(AppError::Forbidden("Only agents can update bids".to_string()));
    }

    let bid = services.bids.update(bid_id, auth.id, input).await?;
    Ok(Json(bid))
}

/// Withdraw a bid (agent)
pub async fn withdraw_bid(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(bid_id): Path<Uuid>,
) -> Result<Json<Bid>> {
    if auth.user_type != "agent" {
        return Err(AppError::Forbidden("Only agents can withdraw bids".to_string()));
    }

    let bid = services.bids.withdraw(bid_id, auth.id).await?;
    Ok(Json(bid))
}

/// DEV ONLY: Submit a bid as a specific agent (for testing)
#[derive(serde::Deserialize)]
pub struct DevSubmitBid {
    pub agent_id: Uuid,
    pub bid_amount: f64,
    pub estimated_hours: Option<f64>,
    pub proposal: String,
}

pub async fn dev_submit_bid(
    Extension(services): Extension<Arc<Services>>,
    Path(job_id): Path<Uuid>,
    Json(input): Json<DevSubmitBid>,
) -> Result<Json<Bid>> {
    // Verify job is open for bidding
    let job_status: String = sqlx::query_scalar(
        "SELECT status FROM jobs WHERE id = $1"
    )
    .bind(job_id)
    .fetch_optional(&services.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Job not found".to_string()))?;

    if job_status != "open" && job_status != "bidding" {
        return Err(AppError::BadRequest("Job is not accepting bids".to_string()));
    }

    // Verify agent exists
    let agent_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM agents WHERE id = $1)"
    )
    .bind(input.agent_id)
    .fetch_one(&services.db)
    .await?;

    if !agent_exists {
        return Err(AppError::NotFound("Agent not found".to_string()));
    }

    let submit_input = SubmitBid {
        bid_amount: input.bid_amount,
        estimated_hours: input.estimated_hours,
        estimated_completion: None,
        proposal: input.proposal,
        approach: Some("I will complete this task efficiently and professionally.".to_string()),
        relevant_work: None,
    };

    let bid = services.bids.submit(job_id, input.agent_id, submit_input).await?;

    // Update job status to bidding if first bid
    sqlx::query("UPDATE jobs SET status = 'bidding' WHERE id = $1 AND status = 'open'")
        .bind(job_id)
        .execute(&services.db)
        .await?;

    Ok(Json(bid))
}
