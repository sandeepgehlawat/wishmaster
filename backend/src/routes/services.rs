use crate::error::Result;
use crate::middleware::AuthUser;
use crate::models::{
    BillingListResponse, CreateManagedService, CreateServiceUpdate, ManagedService,
    ManagedServiceWithDetails, RejectServiceUpdate, ServiceListResponse, ServiceUpdate,
    ServiceUpdateListResponse, UpdateManagedService,
};
use crate::services::Services;
use axum::{extract::Path, Extension, Json};
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;

// ==================== Managed Services ====================

/// List services for current user
pub async fn list_services(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
) -> Result<Json<ServiceListResponse>> {
    let response = services
        .managed_services
        .list_for_user(auth.id, &auth.user_type)
        .await?;
    Ok(Json(response))
}

/// Get service details
pub async fn get_service(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<ManagedServiceWithDetails>> {
    services
        .managed_services
        .can_access(id, auth.id, &auth.user_type)
        .await?;

    let service = services.managed_services.get_with_details(id).await?;
    Ok(Json(service))
}

#[derive(Debug, Deserialize)]
pub struct ConvertToServiceInput {
    pub agent_id: Uuid,
    #[serde(flatten)]
    pub service: CreateManagedService,
}

/// Convert completed job to managed service (client initiates)
pub async fn convert_to_service(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(job_id): Path<Uuid>,
    Json(input): Json<ConvertToServiceInput>,
) -> Result<Json<ManagedService>> {
    if auth.user_type != "client" {
        return Err(crate::error::AppError::Forbidden(
            "Only clients can create managed services".to_string(),
        ));
    }

    let service = services
        .managed_services
        .create(job_id, auth.id, input.agent_id, input.service)
        .await?;

    Ok(Json(service))
}

/// Accept a service offer (agent)
pub async fn accept_service(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<ManagedService>> {
    if auth.user_type != "agent" {
        return Err(crate::error::AppError::Forbidden(
            "Only agents can accept service offers".to_string(),
        ));
    }

    let service = services.managed_services.accept(id, auth.id).await?;
    Ok(Json(service))
}

/// Update service details
pub async fn update_service(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateManagedService>,
) -> Result<Json<ManagedService>> {
    services
        .managed_services
        .can_access(id, auth.id, &auth.user_type)
        .await?;

    let service = services.managed_services.update(id, input).await?;
    Ok(Json(service))
}

/// Pause a service (client or agent)
pub async fn pause_service(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<ManagedService>> {
    services
        .managed_services
        .can_access(id, auth.id, &auth.user_type)
        .await?;

    let service = services.managed_services.pause(id).await?;
    Ok(Json(service))
}

/// Resume a paused service (client or agent)
pub async fn resume_service(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<ManagedService>> {
    services
        .managed_services
        .can_access(id, auth.id, &auth.user_type)
        .await?;

    let service = services.managed_services.resume(id).await?;
    Ok(Json(service))
}

/// Cancel a service (client or agent)
pub async fn cancel_service(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<ManagedService>> {
    services
        .managed_services
        .can_access(id, auth.id, &auth.user_type)
        .await?;

    let service = services.managed_services.cancel(id).await?;
    Ok(Json(service))
}

// ==================== Service Updates ====================

/// List updates for a service
pub async fn list_updates(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(service_id): Path<Uuid>,
) -> Result<Json<ServiceUpdateListResponse>> {
    services
        .managed_services
        .can_access(service_id, auth.id, &auth.user_type)
        .await?;

    let response = services.managed_services.list_updates(service_id).await?;
    Ok(Json(response))
}

/// Create a service update (agent only)
pub async fn create_update(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(service_id): Path<Uuid>,
    Json(input): Json<CreateServiceUpdate>,
) -> Result<Json<ServiceUpdate>> {
    if auth.user_type != "agent" {
        return Err(crate::error::AppError::Forbidden(
            "Only agents can create service updates".to_string(),
        ));
    }

    let update = services
        .managed_services
        .create_update(service_id, auth.id, input)
        .await?;

    Ok(Json(update))
}

/// Approve a service update (client only)
pub async fn approve_update(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<ServiceUpdate>> {
    if auth.user_type != "client" {
        return Err(crate::error::AppError::Forbidden(
            "Only clients can approve service updates".to_string(),
        ));
    }

    // Verify client owns the service
    let update = services.managed_services.get_update_by_id(id).await?;
    let service = services.managed_services.get_by_id(update.service_id).await?;
    if service.client_id != auth.id {
        return Err(crate::error::AppError::Forbidden(
            "Not your service".to_string(),
        ));
    }

    let update = services.managed_services.approve_update(id).await?;
    Ok(Json(update))
}

/// Reject a service update (client only)
pub async fn reject_update(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
    Json(input): Json<RejectServiceUpdate>,
) -> Result<Json<ServiceUpdate>> {
    if auth.user_type != "client" {
        return Err(crate::error::AppError::Forbidden(
            "Only clients can reject service updates".to_string(),
        ));
    }

    // Verify client owns the service
    let update = services.managed_services.get_update_by_id(id).await?;
    let service = services.managed_services.get_by_id(update.service_id).await?;
    if service.client_id != auth.id {
        return Err(crate::error::AppError::Forbidden(
            "Not your service".to_string(),
        ));
    }

    let update = services.managed_services.reject_update(id, input).await?;
    Ok(Json(update))
}

/// Deploy a service update (agent only, after approval)
pub async fn deploy_update(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<ServiceUpdate>> {
    if auth.user_type != "agent" {
        return Err(crate::error::AppError::Forbidden(
            "Only agents can deploy service updates".to_string(),
        ));
    }

    let update = services.managed_services.deploy_update(id, auth.id).await?;
    Ok(Json(update))
}

// ==================== Billing ====================

/// List billing records for a service
pub async fn list_billing(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(service_id): Path<Uuid>,
) -> Result<Json<BillingListResponse>> {
    services
        .managed_services
        .can_access(service_id, auth.id, &auth.user_type)
        .await?;

    let response = services.managed_services.list_billing(service_id).await?;
    Ok(Json(response))
}
