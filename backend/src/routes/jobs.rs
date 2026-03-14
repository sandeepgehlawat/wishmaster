use crate::error::{AppError, Result};
use crate::middleware::AuthUser;
use crate::models::{
    CreateJob, DisputeRequest, JobListQuery, JobListResponse, JobStatus, JobWithDetails,
    RevisionRequest, SelectBidRequest, UpdateJob,
};
use crate::services::Services;
use axum::{
    extract::{Path, Query},
    Extension, Json,
};
use std::sync::Arc;
use uuid::Uuid;

/// List jobs
pub async fn list_jobs(
    Extension(services): Extension<Arc<Services>>,
    Query(query): Query<JobListQuery>,
) -> Result<Json<JobListResponse>> {
    let response = services.jobs.list(query).await?;
    Ok(Json(response))
}

/// Create a new job (draft)
pub async fn create_job(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Json(input): Json<CreateJob>,
) -> Result<Json<JobWithDetails>> {
    let job = services.jobs.create(auth.id, input).await?;
    let details = services.jobs.get_with_details(job.id).await?;
    Ok(Json(details))
}

/// Get job details
pub async fn get_job(
    Extension(services): Extension<Arc<Services>>,
    Path(id): Path<Uuid>,
) -> Result<Json<JobWithDetails>> {
    let job = services.jobs.get_with_details(id).await?;
    Ok(Json(job))
}

/// Update job (only drafts)
pub async fn update_job(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateJob>,
) -> Result<Json<JobWithDetails>> {
    services.jobs.update(id, auth.id, input).await?;
    let details = services.jobs.get_with_details(id).await?;
    Ok(Json(details))
}

/// Publish job and create escrow
pub async fn publish_job(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    let job = services.jobs.get(id).await?;

    // Verify ownership
    if job.client_id != auth.id {
        return Err(AppError::Forbidden("Not your job".to_string()));
    }

    if job.status != "draft" {
        return Err(AppError::BadRequest("Job already published".to_string()));
    }

    // Create escrow
    let amount: f64 = job.budget_max.to_string().parse().unwrap_or(0.0);
    let escrow = services.escrow.create_escrow(
        id,
        &auth.wallet_address,
        amount,
    ).await?;

    // Generate fund transaction
    let tx_response = services.escrow.generate_fund_transaction(
        id,
        &auth.wallet_address,
    ).await?;

    Ok(Json(serde_json::json!({
        "job_id": id,
        "escrow_pda": escrow.escrow_pda,
        "transaction": tx_response.transaction,
        "amount_usdc": tx_response.amount_usdc
    })))
}

/// Cancel job
pub async fn cancel_job(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    let job = services.jobs.get(id).await?;

    if job.client_id != auth.id {
        return Err(AppError::Forbidden("Not your job".to_string()));
    }

    // Check if cancellation is allowed
    let status = JobStatus::from_str(&job.status);
    if !status.can_transition_to(&JobStatus::Cancelled) {
        return Err(AppError::BadRequest(format!(
            "Cannot cancel job in {} status",
            job.status
        )));
    }

    // Transition to cancelled
    services.jobs.transition_status(id, &job.status, JobStatus::Cancelled).await?;

    // Refund escrow if funded
    let refund_result = services.escrow.refund(id).await;

    Ok(Json(serde_json::json!({
        "cancelled": true,
        "refund_signature": refund_result.ok()
    })))
}

/// Select winning bid
pub async fn select_bid(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
    Json(input): Json<SelectBidRequest>,
) -> Result<Json<JobWithDetails>> {
    let job = services.jobs.get(id).await?;

    if job.client_id != auth.id {
        return Err(AppError::Forbidden("Not your job".to_string()));
    }

    if job.status != "bidding" {
        return Err(AppError::BadRequest("Job not in bidding status".to_string()));
    }

    // Get the selected bid
    let bid = services.bids.get(input.bid_id).await?;

    if bid.job_id != id {
        return Err(AppError::BadRequest("Bid does not belong to this job".to_string()));
    }

    // Accept bid and reject others
    services.bids.accept(input.bid_id).await?;

    // Get agent wallet for escrow lock
    let agent_wallet: String = sqlx::query_scalar(
        "SELECT wallet_address FROM agents WHERE id = $1"
    )
    .bind(bid.agent_id)
    .fetch_one(&services.db)
    .await?;

    // Lock escrow to agent
    services.escrow.lock_to_agent(id, &agent_wallet).await?;

    // Assign agent to job
    let price: f64 = bid.bid_amount.to_string().parse().unwrap_or(0.0);
    services.jobs.assign_agent(id, bid.agent_id, price).await?;

    let details = services.jobs.get_with_details(id).await?;
    Ok(Json(details))
}

/// Approve job delivery
pub async fn approve_job(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    let job = services.jobs.get(id).await?;

    if job.client_id != auth.id {
        return Err(AppError::Forbidden("Not your job".to_string()));
    }

    if job.status != "delivered" {
        return Err(AppError::BadRequest("Job not in delivered status".to_string()));
    }

    // Transition to completed
    services.jobs.transition_status(id, "delivered", JobStatus::Completed).await?;

    // Get agent trust tier for fee calculation
    let trust_tier: String = sqlx::query_scalar(
        "SELECT trust_tier FROM agents WHERE id = $1"
    )
    .bind(job.agent_id.unwrap())
    .fetch_one(&services.db)
    .await?;

    // Release escrow
    let release_result = services.escrow.release(id, &trust_tier).await?;

    // Update agent reputation
    if let Some(agent_id) = job.agent_id {
        services.reputation.calculate_agent_reputation(agent_id).await?;
    }

    Ok(Json(serde_json::json!({
        "completed": true,
        "signature": release_result.signature,
        "agent_payout": release_result.agent_payout,
        "platform_fee": release_result.platform_fee
    })))
}

/// Request revision
pub async fn request_revision(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
    Json(input): Json<RevisionRequest>,
) -> Result<Json<JobWithDetails>> {
    let job = services.jobs.get(id).await?;

    if job.client_id != auth.id {
        return Err(AppError::Forbidden("Not your job".to_string()));
    }

    if job.status != "delivered" {
        return Err(AppError::BadRequest("Job not in delivered status".to_string()));
    }

    // Check revision count (max 2)
    let revision_count: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*) FROM audit_log
        WHERE job_id = $1 AND action = 'revision_requested'
        "#,
    )
    .bind(id)
    .fetch_one(&services.db)
    .await?;

    if revision_count >= 2 {
        return Err(AppError::BadRequest("Maximum revisions (2) reached".to_string()));
    }

    // Transition to revision
    services.jobs.transition_status(id, "delivered", JobStatus::Revision).await?;

    // Log revision request
    sqlx::query(
        r#"
        INSERT INTO audit_log (job_id, action, metadata)
        VALUES ($1, 'revision_requested', $2)
        "#,
    )
    .bind(id)
    .bind(serde_json::json!({
        "reason": input.reason,
        "details": input.details
    }))
    .execute(&services.db)
    .await?;

    let details = services.jobs.get_with_details(id).await?;
    Ok(Json(details))
}

/// Dispute job
pub async fn dispute_job(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
    Json(input): Json<DisputeRequest>,
) -> Result<Json<serde_json::Value>> {
    let job = services.jobs.get(id).await?;

    // Either client or agent can dispute
    let is_client = job.client_id == auth.id;
    let is_agent = job.agent_id.map(|a| a == auth.id).unwrap_or(false);

    if !is_client && !is_agent {
        return Err(AppError::Forbidden("Not authorized".to_string()));
    }

    if job.status != "delivered" {
        return Err(AppError::BadRequest("Can only dispute delivered jobs".to_string()));
    }

    // Transition to disputed
    services.jobs.transition_status(id, "delivered", JobStatus::Disputed).await?;

    // Update escrow to disputed
    sqlx::query("UPDATE escrows SET status = 'disputed' WHERE job_id = $1")
        .bind(id)
        .execute(&services.db)
        .await?;

    // Log dispute
    sqlx::query(
        r#"
        INSERT INTO audit_log (job_id, action, metadata)
        VALUES ($1, 'dispute_filed', $2)
        "#,
    )
    .bind(id)
    .bind(serde_json::json!({
        "filed_by": if is_client { "client" } else { "agent" },
        "reason": input.reason,
        "details": input.details
    }))
    .execute(&services.db)
    .await?;

    Ok(Json(serde_json::json!({
        "disputed": true,
        "message": "Dispute filed. An arbitrator will review your case."
    })))
}
