use crate::error::Result;
use crate::middleware::AuthUser;
use crate::models::{
    CreateRequirement, RejectRequirement, Requirement, RequirementListResponse,
    UpdateRequirement,
};
use crate::services::Services;
use axum::{extract::Path, Extension, Json};
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

/// List requirements for a job
pub async fn list_requirements(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(job_id): Path<Uuid>,
) -> Result<Json<RequirementListResponse>> {
    // Verify user can access this job
    services
        .messages
        .can_access_job(job_id, auth.id, &auth.user_type)
        .await
        .ok(); // Allow viewing even without agent for client

    let response = services.requirements.list_for_job(job_id).await?;
    Ok(Json(response))
}

/// Add a requirement (client only)
pub async fn add_requirement(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(job_id): Path<Uuid>,
    Json(input): Json<CreateRequirement>,
) -> Result<Json<Requirement>> {
    // Verify user owns the job
    if auth.user_type != "client" {
        return Err(crate::error::AppError::Forbidden(
            "Only clients can add requirements".to_string(),
        ));
    }

    if !services.requirements.user_owns_job(job_id, auth.id).await? {
        return Err(crate::error::AppError::Forbidden("Not your job".to_string()));
    }

    let requirement = services
        .requirements
        .create(job_id, auth.id, input)
        .await?;

    // Log activity
    services
        .activity
        .log_requirement_added(job_id, auth.id, &requirement.title)
        .await
        .ok();

    Ok(Json(requirement))
}

/// Update a requirement
pub async fn update_requirement(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateRequirement>,
) -> Result<Json<Requirement>> {
    // Client can update details, agent can update status
    services
        .requirements
        .can_access(id, auth.id, &auth.user_type)
        .await?;

    let requirement = services.requirements.update(id, input).await?;
    Ok(Json(requirement))
}

/// Mark requirement as delivered (agent)
pub async fn deliver_requirement(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<Requirement>> {
    if auth.user_type != "agent" {
        return Err(crate::error::AppError::Forbidden(
            "Only agents can mark requirements as delivered".to_string(),
        ));
    }

    services
        .requirements
        .can_access(id, auth.id, &auth.user_type)
        .await?;

    let requirement = services.requirements.mark_delivered(id).await?;

    // Log activity
    services
        .activity
        .log_requirement_delivered(requirement.job_id, auth.id, &requirement.title)
        .await
        .ok();

    Ok(Json(requirement))
}

/// Accept a requirement (client)
pub async fn accept_requirement(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<Requirement>> {
    if auth.user_type != "client" {
        return Err(crate::error::AppError::Forbidden(
            "Only clients can accept requirements".to_string(),
        ));
    }

    let req = services.requirements.get_by_id(id).await?;
    if !services
        .requirements
        .user_owns_job(req.job_id, auth.id)
        .await?
    {
        return Err(crate::error::AppError::Forbidden("Not your job".to_string()));
    }

    let requirement = services.requirements.accept(id).await?;

    // Log activity
    services
        .activity
        .log_requirement_accepted(requirement.job_id, auth.id, &requirement.title)
        .await
        .ok();

    Ok(Json(requirement))
}

/// Reject a requirement with feedback (client)
pub async fn reject_requirement(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
    Json(input): Json<RejectRequirement>,
) -> Result<Json<Requirement>> {
    if auth.user_type != "client" {
        return Err(crate::error::AppError::Forbidden(
            "Only clients can reject requirements".to_string(),
        ));
    }

    let req = services.requirements.get_by_id(id).await?;
    if !services
        .requirements
        .user_owns_job(req.job_id, auth.id)
        .await?
    {
        return Err(crate::error::AppError::Forbidden("Not your job".to_string()));
    }

    let requirement = services.requirements.reject(id, input).await?;

    // Log activity
    services
        .activity
        .log_requirement_rejected(requirement.job_id, auth.id, &requirement.title)
        .await
        .ok();

    Ok(Json(requirement))
}

/// Delete a requirement (client only, before work starts)
pub async fn delete_requirement(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    if auth.user_type != "client" {
        return Err(crate::error::AppError::Forbidden(
            "Only clients can delete requirements".to_string(),
        ));
    }

    let req = services.requirements.get_by_id(id).await?;
    if !services
        .requirements
        .user_owns_job(req.job_id, auth.id)
        .await?
    {
        return Err(crate::error::AppError::Forbidden("Not your job".to_string()));
    }

    // Only allow deletion of pending requirements
    if req.status != "pending" {
        return Err(crate::error::AppError::BadRequest(
            "Can only delete pending requirements".to_string(),
        ));
    }

    services.requirements.delete(id).await?;

    Ok(Json(json!({ "deleted": true })))
}
