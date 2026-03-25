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
use rust_decimal::Decimal;
use std::sync::Arc;
use uuid::Uuid;

// ═══════════════════════════════════════════════════════════════════════════
// AGENT-TO-AGENT JOB ROUTES
// These routes allow agents to create jobs and hire other agents
// ═══════════════════════════════════════════════════════════════════════════

/// Create job as an agent (agent-to-agent work)
/// POST /api/agent/jobs
pub async fn create_job_as_agent(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Json(input): Json<CreateJob>,
) -> Result<Json<JobWithDetails>> {
    // Verify this is an agent
    if auth.user_type != "agent" {
        return Err(AppError::Forbidden("Only agents can use this endpoint".to_string()));
    }

    // Validate input
    if input.title.len() < 10 {
        return Err(AppError::BadRequest("Title must be at least 10 characters".to_string()));
    }
    if input.budget_min > input.budget_max {
        return Err(AppError::BadRequest("Min budget cannot exceed max budget".to_string()));
    }

    // Create job with agent as creator
    let job = services.jobs.create_by_agent(auth.id, input).await?;
    let details = services.jobs.get_with_details(job.id).await?;

    Ok(Json(details))
}

/// List jobs created by this agent
/// GET /api/agent/jobs
pub async fn list_agent_jobs(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Query(query): Query<JobListQuery>,
) -> Result<Json<JobListResponse>> {
    // Verify this is an agent
    if auth.user_type != "agent" {
        return Err(AppError::Forbidden("Only agents can use this endpoint".to_string()));
    }

    let jobs = services.jobs.list_by_agent_creator(auth.id, query).await?;
    Ok(Json(jobs))
}

/// Get a specific job created by this agent
/// GET /api/agent/jobs/:id
pub async fn get_agent_job(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<JobWithDetails>> {
    // Verify this is an agent
    if auth.user_type != "agent" {
        return Err(AppError::Forbidden("Only agents can use this endpoint".to_string()));
    }

    let job = services.jobs.get_with_details(id).await?;

    // Verify ownership
    if job.job.agent_creator_id != Some(auth.id) {
        return Err(AppError::Forbidden("Not your job".to_string()));
    }

    Ok(Json(job))
}

/// Publish an agent-created job
/// POST /api/agent/jobs/:id/publish
pub async fn publish_agent_job(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    // Verify this is an agent
    if auth.user_type != "agent" {
        return Err(AppError::Forbidden("Only agents can use this endpoint".to_string()));
    }

    // ATOMIC: Claim the job for publishing by transitioning from 'draft' to 'open'
    let job = sqlx::query_as::<_, crate::models::Job>(
        &format!(r#"
        UPDATE jobs SET status = 'open', published_at = NOW()
        WHERE id = $1 AND agent_creator_id = $2 AND status = 'draft'
        RETURNING {}
        "#, JOB_COLUMNS)
    )
    .bind(id)
    .bind(auth.id)
    .fetch_optional(&services.db)
    .await?
    .ok_or_else(|| AppError::Conflict("Job not found, not yours, or already published".to_string()))?;

    // Create escrow using agent's wallet
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

    Ok(Json(serde_json::json!({
        "job_id": id,
        "escrow_pda": escrow.escrow_pda,
        "transaction": tx_response.transaction,
        "amount_usdc": tx_response.amount_usdc
    })))
}

/// Select winning bid for an agent-created job
/// POST /api/agent/jobs/:id/select-bid
pub async fn select_bid_as_agent(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
    Json(input): Json<SelectBidRequest>,
) -> Result<Json<JobWithDetails>> {
    // Verify this is an agent
    if auth.user_type != "agent" {
        return Err(AppError::Forbidden("Only agents can use this endpoint".to_string()));
    }

    let job = services.jobs.get(id).await?;

    // Verify ownership (agent creator)
    if job.agent_creator_id != Some(auth.id) {
        return Err(AppError::Forbidden("Not your job".to_string()));
    }

    // Allow selection from 'bidding' status, or if already partially processed
    if job.status != "bidding" && job.status != "open" {
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

    // Cannot hire yourself
    if bid.agent_id == auth.id {
        return Err(AppError::BadRequest("Cannot hire yourself".to_string()));
    }

    // Accept bid if not already accepted
    if bid.status == "pending" {
        services.bids.accept(input.bid_id).await?;
    } else if bid.status != "accepted" {
        return Err(AppError::BadRequest(format!("Bid is not selectable (status: {})", bid.status)));
    }

    // Get agent wallet for escrow lock
    let agent_wallet: String = sqlx::query_scalar(
        "SELECT wallet_address FROM agents WHERE id = $1"
    )
    .bind(bid.agent_id)
    .fetch_one(&services.db)
    .await?;

    // Lock escrow to agent with bid amount
    let bid_amount: f64 = bid.bid_amount.to_string().parse().unwrap_or(0.0);
    services.escrow.lock_to_agent(id, &agent_wallet, Some(bid_amount)).await?;

    // Assign agent to job
    let price: f64 = bid.bid_amount.to_string().parse().unwrap_or(0.0);
    services.jobs.assign_agent(id, bid.agent_id, price).await?;

    // Create StackBlitz sandbox for the job
    if let Err(e) = services.sandbox.create_stackblitz_project(id, &job.title).await {
        tracing::warn!("Failed to create sandbox for job {}: {:?}", id, e);
    }

    let details = services.jobs.get_with_details(id).await?;
    Ok(Json(details))
}

/// Approve job delivery (agent as client)
/// POST /api/agent/jobs/:id/approve
pub async fn approve_agent_job(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    // Verify this is an agent
    if auth.user_type != "agent" {
        return Err(AppError::Forbidden("Only agents can use this endpoint".to_string()));
    }

    // ATOMIC: Transition from 'delivered' to 'completed'
    let job = sqlx::query_as::<_, crate::models::Job>(
        &format!(r#"
        UPDATE jobs SET status = 'completed', completed_at = NOW()
        WHERE id = $1 AND agent_creator_id = $2 AND status = 'delivered'
        RETURNING {}
        "#, JOB_COLUMNS)
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
            // Rollback
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
            // Rollback
            let _ = sqlx::query("UPDATE jobs SET status = 'delivered', completed_at = NULL WHERE id = $1 AND status = 'completed'")
                .bind(id)
                .execute(&services.db)
                .await;
            return Err(err);
        }
    };

    // Update agent reputation
    let _ = services.reputation.calculate_agent_reputation(agent_id).await;

    Ok(Json(serde_json::json!({
        "completed": true,
        "signature": release_result.signature,
        "agent_payout": release_result.agent_payout,
        "platform_fee": release_result.platform_fee
    })))
}

// ═══════════════════════════════════════════════════════════════════════════
// ORIGINAL CLIENT JOB ROUTES (below)
// ═══════════════════════════════════════════════════════════════════════════

// Explicit column list for Job queries (avoids SELECT * issues with schema changes)
// Note: sandbox_url and sandbox_project_id are optional - use COALESCE for backward compat
const JOB_COLUMNS: &str = "id, client_id, agent_id, creator_type, agent_creator_id, title, description, task_type, required_skills, complexity, budget_min, budget_max, final_price, pricing_model, deadline, bid_deadline, urgency, status, created_at, published_at, started_at, delivered_at, completed_at, sandbox_url, sandbox_project_id";

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

/// Get job details (public view - limited fields for open jobs, full for participants)
pub async fn get_job(
    Extension(services): Extension<Arc<Services>>,
    auth: Option<Extension<AuthUser>>,
    Path(id): Path<Uuid>,
) -> Result<Json<JobWithDetails>> {
    let job = services.jobs.get_with_details(id).await?;

    // Check authorization: public can only see open jobs, participants see full details
    let is_participant = auth.as_ref().map_or(false, |a| {
        let user_id = a.id;
        let user_type = &a.user_type;
        // Client owns job (client_id is Option<Uuid> for agent-to-agent jobs)
        job.job.client_id == Some(user_id) ||
        // Agent is assigned
        job.job.agent_id == Some(user_id) ||
        // Agent created job (agent-to-agent)
        job.job.agent_creator_id == Some(user_id) ||
        // User type check for broader access
        (user_type == "user" && job.job.client_id == Some(user_id))
    });

    // For non-participants, only allow viewing open/bidding jobs (marketplace browsing)
    if !is_participant {
        match job.job.status.as_str() {
            "open" | "bidding" => {
                // Allow public view of open jobs (for marketplace)
            }
            _ => {
                return Err(AppError::Forbidden(
                    "You don't have access to this job".to_string()
                ));
            }
        }
    }

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
        &format!(r#"
        UPDATE jobs SET status = 'open', published_at = NOW()
        WHERE id = $1 AND client_id = $2 AND status = 'draft'
        RETURNING {}
        "#, JOB_COLUMNS)
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

    if job.client_id != Some(auth.id) {
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

    if job.client_id != Some(auth.id) {
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

    // Lock escrow to agent with bid amount
    // The bid amount is passed to update the escrow record (excess was refunded on-chain)
    let bid_amount: f64 = bid.bid_amount.to_string().parse().unwrap_or(0.0);
    services.escrow.lock_to_agent(id, &agent_wallet, Some(bid_amount)).await?;

    // Assign agent to job
    let price: f64 = bid.bid_amount.to_string().parse().unwrap_or(0.0);
    services.jobs.assign_agent(id, bid.agent_id, price).await?;

    // Create StackBlitz sandbox for the job
    if let Err(e) = services.sandbox.create_stackblitz_project(id, &job.title).await {
        tracing::warn!("Failed to create sandbox for job {}: {:?}", id, e);
        // Non-fatal: sandbox creation failure shouldn't block bid selection
    }

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
        &format!(r#"
        UPDATE jobs SET status = 'completed', completed_at = NOW()
        WHERE id = $1 AND client_id = $2 AND status = 'delivered'
        RETURNING {}
        "#, JOB_COLUMNS)
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

    if job.client_id != Some(auth.id) {
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
    let is_client = job.client_id == Some(auth.id);
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

/// DEV ONLY: Publish job (for testing - bypasses auth)
pub async fn dev_publish_job(
    Extension(services): Extension<Arc<Services>>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    // Get job details
    let job = services.jobs.get(id).await?;

    if job.status != "draft" {
        return Err(AppError::BadRequest(format!("Job not in draft status (current: {})", job.status)));
    }

    // Get client wallet
    let client_wallet: String = sqlx::query_scalar(
        "SELECT wallet_address FROM users WHERE id = $1"
    )
    .bind(job.client_id)
    .fetch_one(&services.db)
    .await?;

    // ATOMIC: Update job status to open
    sqlx::query(
        "UPDATE jobs SET status = 'open', published_at = NOW() WHERE id = $1 AND status = 'draft'"
    )
    .bind(id)
    .execute(&services.db)
    .await?;

    // Create escrow
    let amount: f64 = job.budget_max.to_string().parse().unwrap_or(0.0);
    let escrow = match services.escrow.create_escrow(id, &client_wallet, amount).await {
        Ok(e) => e,
        Err(err) => {
            // Rollback
            let _ = sqlx::query("UPDATE jobs SET status = 'draft', published_at = NULL WHERE id = $1")
                .bind(id)
                .execute(&services.db)
                .await;
            return Err(err);
        }
    };

    // Generate fund transaction
    let tx_response = match services.escrow.generate_fund_transaction(id, &client_wallet).await {
        Ok(t) => t,
        Err(err) => {
            // Rollback
            let _ = sqlx::query("UPDATE jobs SET status = 'draft', published_at = NULL WHERE id = $1")
                .bind(id)
                .execute(&services.db)
                .await;
            return Err(err);
        }
    };

    Ok(Json(serde_json::json!({
        "dev_mode": true,
        "job_id": id,
        "escrow_pda": escrow.escrow_pda,
        "transaction": tx_response.transaction,
        "amount_usdc": tx_response.amount_usdc
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

    if let Some(agent_id) = job.agent_id {
        // Update escrow with agent payout for earnings tracking
        sqlx::query(
            "UPDATE escrows SET agent_payout_usdc = $2 WHERE job_id = $1"
        )
        .bind(id)
        .bind(Decimal::from_f64_retain(agent_payout).unwrap_or_default())
        .execute(&services.db)
        .await?;

        // Auto-create a 5-star rating in dev mode so reputation reflects completed work
        let _ = sqlx::query(
            r#"
            INSERT INTO ratings (job_id, rater_id, ratee_id, rater_type, ratee_type, overall, dimension_1, dimension_2, dimension_3, review_text, is_public, is_quarantined)
            VALUES ($1, $2, $3, 'client', 'agent', 5, 5, 5, 5, 'Dev mode auto-rating', true, false)
            ON CONFLICT DO NOTHING
            "#,
        )
        .bind(id)
        .bind(job.client_id)
        .bind(agent_id)
        .execute(&services.db)
        .await;

        // Recalculate agent reputation with the new rating and earnings
        let _ = services.reputation.calculate_agent_reputation(agent_id).await;
    }

    Ok(Json(serde_json::json!({
        "completed": true,
        "dev_mode": true,
        "signature": "DEV_MODE_SIMULATED_TX",
        "agent_payout": agent_payout,
        "platform_fee": platform_fee,
        "message": "Job completed (dev mode - no real payment)"
    })))
}
