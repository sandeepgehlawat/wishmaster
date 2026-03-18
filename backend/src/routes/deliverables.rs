use crate::error::Result;
use crate::middleware::AuthUser;
use crate::models::{CreateDeliverable, Deliverable, DeliverableListResponse, RequestChanges};
use crate::services::Services;
use axum::{extract::Path, Extension, Json};
use std::sync::Arc;
use uuid::Uuid;

/// List deliverables for a job
pub async fn list_deliverables(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(job_id): Path<Uuid>,
) -> Result<Json<DeliverableListResponse>> {
    // Verify user can access this job
    services
        .messages
        .can_access_job(job_id, auth.id, &auth.user_type)
        .await?;

    let response = services.deliverables.list_for_job(job_id).await?;
    Ok(Json(response))
}

/// Submit a deliverable (agent only)
pub async fn submit_deliverable(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(job_id): Path<Uuid>,
    Json(input): Json<CreateDeliverable>,
) -> Result<Json<Deliverable>> {
    if auth.user_type != "agent" {
        return Err(crate::error::AppError::Forbidden(
            "Only agents can submit deliverables".to_string(),
        ));
    }

    // Verify agent is assigned to this job
    if !services
        .deliverables
        .agent_assigned_to_job(job_id, auth.id)
        .await?
    {
        return Err(crate::error::AppError::Forbidden(
            "Not assigned to this job".to_string(),
        ));
    }

    let deliverable = services
        .deliverables
        .create(job_id, auth.id, input)
        .await?;

    // Log activity
    services
        .activity
        .log_deliverable_submitted(job_id, auth.id, &deliverable.title)
        .await
        .ok();

    Ok(Json(deliverable))
}

/// Approve a deliverable (client only)
pub async fn approve_deliverable(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<Deliverable>> {
    if auth.user_type != "client" {
        return Err(crate::error::AppError::Forbidden(
            "Only clients can approve deliverables".to_string(),
        ));
    }

    let del = services.deliverables.get_by_id(id).await?;
    if !services
        .deliverables
        .user_owns_job(del.job_id, auth.id)
        .await?
    {
        return Err(crate::error::AppError::Forbidden("Not your job".to_string()));
    }

    let deliverable = services.deliverables.approve(id).await?;

    // Log activity
    services
        .activity
        .log_deliverable_approved(deliverable.job_id, auth.id, &deliverable.title)
        .await
        .ok();

    Ok(Json(deliverable))
}

/// Request changes on a deliverable (client only)
pub async fn request_changes(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
    Json(input): Json<RequestChanges>,
) -> Result<Json<Deliverable>> {
    if auth.user_type != "client" {
        return Err(crate::error::AppError::Forbidden(
            "Only clients can request changes".to_string(),
        ));
    }

    let del = services.deliverables.get_by_id(id).await?;
    if !services
        .deliverables
        .user_owns_job(del.job_id, auth.id)
        .await?
    {
        return Err(crate::error::AppError::Forbidden("Not your job".to_string()));
    }

    let deliverable = services.deliverables.request_changes(id, input).await?;

    // Log activity
    services
        .activity
        .log_deliverable_changes_requested(deliverable.job_id, auth.id, &deliverable.title)
        .await
        .ok();

    Ok(Json(deliverable))
}
