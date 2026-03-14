use crate::error::{AppError, Result};
use crate::middleware::AuthUser;
use crate::services::{sandbox_service::SandboxSession, Services};
use axum::{
    extract::Path,
    Extension, Json,
};
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct ClaimRequest {
    pub job_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct ProgressRequest {
    pub job_id: Uuid,
    pub progress_percent: u8,
    pub status_message: String,
}

#[derive(Debug, Deserialize)]
pub struct SubmitRequest {
    pub job_id: Uuid,
    pub results: serde_json::Value,
}

#[derive(Debug, Deserialize)]
pub struct HeartbeatRequest {
    pub job_id: Uuid,
}

/// Claim a job and start sandbox (agent)
pub async fn claim_job(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Json(input): Json<ClaimRequest>,
) -> Result<Json<SandboxSession>> {
    if auth.user_type != "agent" {
        return Err(AppError::Forbidden("Only agents can claim jobs".to_string()));
    }

    let session = services.sandbox.claim_job(input.job_id, auth.id).await?;
    Ok(Json(session))
}

/// Stream job data file (agent, from within sandbox)
pub async fn stream_data(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(file): Path<String>,
) -> Result<Vec<u8>> {
    if auth.user_type != "agent" {
        return Err(AppError::Forbidden("Only agents can access data".to_string()));
    }

    // Get active job for this agent
    let job_id: Uuid = sqlx::query_scalar(
        "SELECT id FROM jobs WHERE agent_id = $1 AND status = 'in_progress' LIMIT 1"
    )
    .bind(auth.id)
    .fetch_optional(&services.db)
    .await?
    .ok_or_else(|| AppError::NotFound("No active job found".to_string()))?;

    let data = services.sandbox.stream_data(job_id, auth.id, &file).await?;
    Ok(data)
}

/// Report progress (agent)
pub async fn report_progress(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Json(input): Json<ProgressRequest>,
) -> Result<Json<serde_json::Value>> {
    if auth.user_type != "agent" {
        return Err(AppError::Forbidden("Only agents can report progress".to_string()));
    }

    services.sandbox.report_progress(
        input.job_id,
        auth.id,
        input.progress_percent,
        &input.status_message,
    ).await?;

    Ok(Json(serde_json::json!({"ok": true})))
}

/// Submit results (agent)
pub async fn submit_results(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Json(input): Json<SubmitRequest>,
) -> Result<Json<serde_json::Value>> {
    if auth.user_type != "agent" {
        return Err(AppError::Forbidden("Only agents can submit results".to_string()));
    }

    services.sandbox.submit_results(input.job_id, auth.id, input.results).await?;

    Ok(Json(serde_json::json!({
        "submitted": true,
        "message": "Results submitted. Awaiting client review."
    })))
}

/// Heartbeat to keep session alive (agent)
pub async fn heartbeat(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Json(input): Json<HeartbeatRequest>,
) -> Result<Json<serde_json::Value>> {
    if auth.user_type != "agent" {
        return Err(AppError::Forbidden("Only agents can heartbeat".to_string()));
    }

    services.sandbox.heartbeat(input.job_id, auth.id).await?;

    Ok(Json(serde_json::json!({"alive": true})))
}
