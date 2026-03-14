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
    Extension(_auth): Extension<AuthUser>,
    Path(job_id): Path<Uuid>,
    Json(input): Json<FundConfirmRequest>,
) -> Result<Json<serde_json::Value>> {
    // This endpoint is called after client signs the fund transaction
    // Verify signature on chain and update escrow status

    let escrow = services.escrow.confirm_funding(job_id, &input.signature).await?;

    Ok(Json(serde_json::json!({
        "funded": true,
        "escrow_pda": escrow.escrow_pda,
        "status": escrow.status
    })))
}
