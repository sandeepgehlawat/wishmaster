use crate::error::{AppError, Result};
use crate::middleware::AuthUser;
use crate::models::{EscrowDetails, FundTransactionResponse};
use crate::services::Services;
use axum::{
    extract::Path,
    Extension, Json,
};
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct FundConfirmRequest {
    pub signature: String,
}

/// Get escrow details
pub async fn get_escrow(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(job_id): Path<Uuid>,
) -> Result<Json<EscrowDetails>> {
    let escrow = services.escrow.get_escrow(job_id).await?;

    // Verify ownership (client or assigned agent)
    let job: (Uuid, Option<Uuid>) = sqlx::query_as(
        "SELECT client_id, agent_id FROM jobs WHERE id = $1"
    )
    .bind(job_id)
    .fetch_optional(&services.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Job not found".to_string()))?;

    let is_client = job.0 == auth.id;
    let is_agent = job.1.map(|a| a == auth.id).unwrap_or(false);

    if !is_client && !is_agent {
        return Err(AppError::Forbidden("Not authorized".to_string()));
    }

    Ok(Json(escrow))
}

/// Generate fund transaction
pub async fn generate_fund_tx(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(job_id): Path<Uuid>,
) -> Result<Json<FundTransactionResponse>> {
    let tx = services.escrow.generate_fund_transaction(
        job_id,
        &auth.wallet_address,
    ).await?;

    Ok(Json(tx))
}

/// Confirm escrow funding and release job
pub async fn release_escrow(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(job_id): Path<Uuid>,
    Json(input): Json<FundConfirmRequest>,
) -> Result<Json<serde_json::Value>> {
    // SECURITY: Verify the caller owns this job
    let job_owner: Option<Uuid> = sqlx::query_scalar(
        "SELECT client_id FROM jobs WHERE id = $1"
    )
    .bind(job_id)
    .fetch_optional(&services.db)
    .await?;

    match job_owner {
        None => return Err(AppError::NotFound("Job not found".to_string())),
        Some(owner_id) if owner_id != auth.id => {
            return Err(AppError::Forbidden("Not authorized to confirm escrow for this job".to_string()));
        }
        _ => {}
    }

    // This endpoint is called after client signs the fund transaction
    // Verify signature on chain and update escrow status
    let escrow = services.escrow.confirm_funding(job_id, &input.signature).await?;

    Ok(Json(serde_json::json!({
        "funded": true,
        "escrow_pda": escrow.escrow_pda,
        "status": escrow.status
    })))
}

/// DEV ONLY: Simulate escrow funding without real Solana transaction
/// This should only be available in development/testing environments
pub async fn dev_fund_escrow(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(job_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    // Only allow in dev mode (check if using devnet or test RPC)
    let is_dev = services.config.solana_rpc_url
        .as_ref()
        .map(|url| url.contains("devnet") || url.contains("localhost"))
        .unwrap_or(true);

    if !is_dev {
        return Err(AppError::BadRequest("Dev funding only available in development mode".to_string()));
    }

    // Verify the caller owns this job
    let job_owner: Option<Uuid> = sqlx::query_scalar(
        "SELECT client_id FROM jobs WHERE id = $1"
    )
    .bind(job_id)
    .fetch_optional(&services.db)
    .await?;

    match job_owner {
        None => return Err(AppError::NotFound("Job not found".to_string())),
        Some(owner_id) if owner_id != auth.id => {
            return Err(AppError::Forbidden("Not authorized".to_string()));
        }
        _ => {}
    }

    // Directly update escrow to funded status
    let escrow = sqlx::query_as::<_, crate::models::Escrow>(
        r#"
        UPDATE escrows SET
            status = 'funded',
            funded_at = NOW(),
            fund_tx = 'DEV_MODE_SIMULATED_TX'
        WHERE job_id = $1 AND status = 'created'
        RETURNING *
        "#,
    )
    .bind(job_id)
    .fetch_optional(&services.db)
    .await?
    .ok_or_else(|| AppError::Conflict("Escrow not found or already funded".to_string()))?;

    tracing::info!("DEV MODE: Escrow funded for job {}", job_id);

    Ok(Json(serde_json::json!({
        "funded": true,
        "dev_mode": true,
        "escrow_pda": escrow.escrow_pda,
        "status": "funded"
    })))
}
