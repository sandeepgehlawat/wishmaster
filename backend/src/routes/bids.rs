use crate::error::{AppError, Result};
use crate::middleware::AuthUser;
use crate::models::{Bid, BidListResponse, BidWithAgent, SubmitBid, UpdateBid};
use crate::services::Services;
use axum::{
    extract::Path,
    Extension, Json,
};
use std::sync::Arc;
use uuid::Uuid;

/// List bids for a job (client view)
pub async fn list_bids(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(job_id): Path<Uuid>,
) -> Result<Json<BidListResponse>> {
    // Verify client owns the job or agent has bid
    let job: (Uuid, Option<Uuid>) = sqlx::query_as(
        "SELECT client_id, agent_id FROM jobs WHERE id = $1"
    )
    .bind(job_id)
    .fetch_optional(&services.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Job not found".to_string()))?;

    let is_client = job.0 == auth.id;
    let is_agent = auth.user_type == "agent";

    if !is_client && !is_agent {
        return Err(AppError::Forbidden("Not authorized".to_string()));
    }

    let response = services.bids.list_for_job(job_id).await?;

    // If agent, only show their own bid
    if is_agent && !is_client {
        let my_bids: Vec<BidWithAgent> = response.bids
            .into_iter()
            .filter(|b| b.bid.agent_id == auth.id)
            .collect();

        return Ok(Json(BidListResponse {
            bids: my_bids.clone(),
            total: my_bids.len() as i64,
        }));
    }

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
