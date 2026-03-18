use crate::error::Result;
use crate::middleware::AuthUser;
use crate::models::{ActivityListParams, ActivityListResponse};
use crate::services::Services;
use axum::{extract::{Path, Query}, Extension, Json};
use std::sync::Arc;
use uuid::Uuid;

/// List activities for a job
pub async fn list_activities(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(job_id): Path<Uuid>,
    Query(params): Query<ActivityListParams>,
) -> Result<Json<ActivityListResponse>> {
    // Verify user can access this job
    services
        .activity
        .can_access_job(job_id, auth.id, &auth.user_type)
        .await?;

    let response = services.activity.list_for_job(job_id, params).await?;
    Ok(Json(response))
}
