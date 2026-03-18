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

/// List jobs (PUBLIC endpoint - excludes drafts and ignores client_id filter)
pub async fn list_jobs(
    Extension(services): Extension<Arc<Services>>,
    Query(query): Query<JobListQuery>,
) -> Result<Json<JobListResponse>> {
    // SECURITY: Use list_public to prevent data leakage of draft jobs
    let response = services.jobs.list_public(query).await?;
    Ok(Json(response))
}

/// List my jobs (for authenticated user)
pub async fn list_my_jobs(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Query(query): Query<JobListQuery>,
) -> Result<Json<JobListResponse>> {
    // Override client_id with authenticated user's ID
    let mut my_query = query;
    my_query.client_id = Some(auth.id);
    let response = services.jobs.list(my_query).await?;
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
/// Uses atomic status transition to prevent race conditions
pub async fn publish_job(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    // ATOMIC: Claim the job for publishing by transitioning from 'draft' to 'open'
    // This prevents race conditions where two requests could both see 'draft' status
    let job = sqlx::query_as::<_, crate::models::Job>(
        r#"
        UPDATE jobs SET status = 'open', published_at = NOW()
        WHERE id = $1 AND client_id = $2 AND status = 'draft'
        RETURNING *
        "#
    )
    .bind(id)
    .bind(auth.id)
    .fetch_optional(&services.db)
    .await?
    .ok_or_else(|| AppError::Conflict("Job not found, not yours, or already published".to_string()))?;

    // Create escrow
    let amount: f64 = job.budget_max.to_string().parse().unwrap_or(0.0);
    let escrow = match services.escrow.create_escrow(
        id,
        &auth.wallet_address,
        amount,
    ).await {
        Ok(e) => e,
        Err(err) => {
            // Rollback: set status back to draft if escrow creation fails
            let _ = sqlx::query("UPDATE jobs SET status = 'draft', published_at = NULL WHERE id = $1 AND status = 'open'")
                .bind(id)
                .execute(&services.db)
                .await;
            return Err(err);
        }
    };

    // Generate fund transaction
    let tx_response = match services.escrow.generate_fund_transaction(
        id,
        &auth.wallet_address,
    ).await {
        Ok(t) => t,
        Err(err) => {
            // Rollback: set status back to draft if transaction generation fails
            let _ = sqlx::query("UPDATE jobs SET status = 'draft', published_at = NULL WHERE id = $1 AND status = 'open'")
                .bind(id)
                .execute(&services.db)
                .await;
            return Err(err);
        }
    };

    // Job is already 'open' status from the first atomic update
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
/// Uses atomic approach: if bid is already accepted (from failed prior attempt),
/// just complete the remaining steps (lock escrow + assign agent)
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

    // Allow selection from 'bidding' status, or if already partially processed
    // (bid accepted but job not assigned due to prior failure)
    if job.status != "bidding" && job.status != "open" {
        // Check if this is a retry of a partially completed selection
        if job.agent_id.is_some() {
            return Err(AppError::BadRequest("Job already has an assigned agent".to_string()));
        }
        return Err(AppError::BadRequest(format!("Job not in bidding status (current: {})", job.status)));
    }

    // Get the selected bid
    let bid = services.bids.get(input.bid_id).await?;

    if bid.job_id != id {
        return Err(AppError::BadRequest("Bid does not belong to this job".to_string()));
    }

    // Accept bid if not already accepted (idempotent - handles retry case)
    if bid.status == "pending" {
        services.bids.accept(input.bid_id).await?;
    } else if bid.status != "accepted" {
        return Err(AppError::BadRequest(format!("Bid is not selectable (status: {})", bid.status)));
    }
    // If bid.status == "accepted", it was accepted in a prior failed attempt - continue

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
/// Uses atomic status transition to prevent race conditions and ensure consistency
pub async fn approve_job(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    // ATOMIC: Transition from 'delivered' to 'completed' in one step
    // This prevents race conditions and ensures only one approval process runs
    let job = sqlx::query_as::<_, crate::models::Job>(
        r#"
        UPDATE jobs SET status = 'completed', completed_at = NOW()
        WHERE id = $1 AND client_id = $2 AND status = 'delivered'
        RETURNING *
        "#
    )
    .bind(id)
    .bind(auth.id)
    .fetch_optional(&services.db)
    .await?
    .ok_or_else(|| AppError::Conflict("Job not found, not yours, or not in delivered status".to_string()))?;

    let agent_id = job.agent_id
        .ok_or_else(|| AppError::Internal("Job has no assigned agent".to_string()))?;

    // Get agent trust tier for fee calculation
    let trust_tier: String = match sqlx::query_scalar(
        "SELECT trust_tier FROM agents WHERE id = $1"
    )
    .bind(agent_id)
    .fetch_one(&services.db)
    .await {
        Ok(tier) => tier,
        Err(err) => {
            // Rollback: set status back to delivered
            let _ = sqlx::query("UPDATE jobs SET status = 'delivered', completed_at = NULL WHERE id = $1 AND status = 'completed'")
                .bind(id)
                .execute(&services.db)
                .await;
            return Err(err.into());
        }
    };

    // Release escrow
    let release_result = match services.escrow.release(id, &trust_tier).await {
        Ok(r) => r,
        Err(err) => {
            // Rollback: set status back to delivered
            let _ = sqlx::query("UPDATE jobs SET status = 'delivered', completed_at = NULL WHERE id = $1 AND status = 'completed'")
                .bind(id)
                .execute(&services.db)
                .await;
            return Err(err);
        }
    };

    // Update agent reputation (non-critical, don't fail if this errors)
    let _ = services.reputation.calculate_agent_reputation(agent_id).await;

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

/// DEV ONLY: Mark job as delivered (for testing)
pub async fn dev_deliver_job(
    Extension(services): Extension<Arc<Services>>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    // Transition: assigned/in_progress -> delivered
    sqlx::query(
        "UPDATE jobs SET status = 'delivered', delivered_at = NOW() WHERE id = $1 AND status IN ('assigned', 'in_progress')"
    )
    .bind(id)
    .execute(&services.db)
    .await?;

    Ok(Json(serde_json::json!({
        "delivered": true,
        "message": "Job marked as delivered. Client can now approve."
    })))
}

/// DEV ONLY: Approve job and complete (bypasses escrow for testing)
pub async fn dev_approve_job(
    Extension(services): Extension<Arc<Services>>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    // Get job details
    let job = services.jobs.get(id).await?;

    if job.status != "delivered" {
        return Err(AppError::BadRequest(format!("Job not in delivered status (current: {})", job.status)));
    }

    // Force escrow to completed status (dev mode bypass)
    sqlx::query(
        "UPDATE escrows SET status = 'released', released_at = NOW() WHERE job_id = $1"
    )
    .bind(id)
    .execute(&services.db)
    .await?;

    // Mark job as completed
    sqlx::query(
        "UPDATE jobs SET status = 'completed', completed_at = NOW() WHERE id = $1"
    )
    .bind(id)
    .execute(&services.db)
    .await?;

    // Calculate simulated payout
    let final_price: f64 = job.final_price.map(|p| p.to_string().parse().unwrap_or(0.0)).unwrap_or(0.0);
    let platform_fee = final_price * 0.05; // 5% fee
    let agent_payout = final_price - platform_fee;

    Ok(Json(serde_json::json!({
        "completed": true,
        "dev_mode": true,
        "signature": "DEV_MODE_SIMULATED_TX",
        "agent_payout": agent_payout,
        "platform_fee": platform_fee,
        "message": "Job completed (dev mode - no real payment)"
    })))
}
