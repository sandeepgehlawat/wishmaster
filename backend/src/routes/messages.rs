use crate::error::Result;
use crate::middleware::AuthUser;
use crate::models::{CreateMessage, MessageListResponse, MessageWithSender};
use crate::services::Services;
use axum::{extract::Path, Extension, Json};
use serde::Serialize;
use std::sync::Arc;
use uuid::Uuid;

/// List messages for a job
pub async fn list_messages(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(job_id): Path<Uuid>,
) -> Result<Json<MessageListResponse>> {
    // Verify user can access this job's messages
    services
        .messages
        .can_access_job(job_id, auth.id, &auth.user_type)
        .await?;

    let response = services.messages.list_for_job(job_id).await?;
    Ok(Json(response))
}

/// Send a message for a job
pub async fn send_message(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(job_id): Path<Uuid>,
    Json(input): Json<CreateMessage>,
) -> Result<Json<MessageWithSender>> {
    // Verify user can access this job's messages
    services
        .messages
        .can_access_job(job_id, auth.id, &auth.user_type)
        .await?;

    // Create the message
    let message = services
        .messages
        .create(job_id, auth.id, &auth.user_type, &input.content)
        .await?;

    // Return with sender name
    let sender_name = if auth.user_type == "agent" {
        // Get agent display name
        let name: Option<String> = sqlx::query_scalar(
            "SELECT display_name FROM agents WHERE id = $1"
        )
        .bind(auth.id)
        .fetch_optional(&services.db)
        .await?;
        name.unwrap_or_else(|| "Agent".to_string())
    } else {
        // Get user display name
        let name: Option<String> = sqlx::query_scalar(
            "SELECT display_name FROM users WHERE id = $1"
        )
        .bind(auth.id)
        .fetch_optional(&services.db)
        .await?;
        name.unwrap_or_else(|| "Client".to_string())
    };

    Ok(Json(MessageWithSender {
        message,
        sender_name,
    }))
}

#[derive(Serialize)]
pub struct MarkReadResponse {
    pub marked_count: i64,
}

/// Get unread message count
pub async fn get_unread_count(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(job_id): Path<Uuid>,
) -> Result<Json<UnreadCountResponse>> {
    // Verify user can access this job's messages
    services
        .messages
        .can_access_job(job_id, auth.id, &auth.user_type)
        .await?;

    let count = services
        .messages
        .get_unread_count(job_id, auth.id, &auth.user_type)
        .await?;

    Ok(Json(UnreadCountResponse { unread_count: count }))
}

#[derive(Serialize)]
pub struct UnreadCountResponse {
    pub unread_count: i64,
}

/// Mark all messages as read
pub async fn mark_messages_read(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(job_id): Path<Uuid>,
) -> Result<Json<MarkReadResponse>> {
    // Verify user can access this job's messages
    services
        .messages
        .can_access_job(job_id, auth.id, &auth.user_type)
        .await?;

    let marked_count = services
        .messages
        .mark_as_read(job_id, auth.id, &auth.user_type)
        .await?;

    Ok(Json(MarkReadResponse { marked_count }))
}
