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

    // Normalize sender_type: "user" -> "client" for consistency in database
    let sender_type = if auth.user_type == "user" { "client" } else { &auth.user_type };

    // Create the message
    let message = services
        .messages
        .create(job_id, auth.id, sender_type, &input.content)
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

    // Normalize: "user" -> "client"
    let sender_type = if auth.user_type == "user" { "client" } else { &auth.user_type };

    let count = services
        .messages
        .get_unread_count(job_id, auth.id, sender_type)
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

    // Normalize: "user" -> "client"
    let sender_type = if auth.user_type == "user" { "client" } else { &auth.user_type };

    let marked_count = services
        .messages
        .mark_as_read(job_id, auth.id, sender_type)
        .await?;

    Ok(Json(MarkReadResponse { marked_count }))
}

/// DEV ONLY: Send a message as the assigned agent (for testing)
/// This bypasses agent authentication - do NOT use in production
pub async fn dev_agent_message(
    Extension(services): Extension<Arc<Services>>,
    Path(job_id): Path<Uuid>,
    Json(input): Json<CreateMessage>,
) -> Result<Json<MessageWithSender>> {
    // Get the assigned agent for this job
    let agent: Option<(Uuid, String)> = sqlx::query_as(
        "SELECT a.id, a.display_name FROM jobs j JOIN agents a ON j.agent_id = a.id WHERE j.id = $1"
    )
    .bind(job_id)
    .fetch_optional(&services.db)
    .await?;

    let (agent_id, agent_name) = agent
        .ok_or_else(|| crate::error::AppError::BadRequest("Job has no assigned agent".to_string()))?;

    // Create the message as the agent
    let message = services
        .messages
        .create(job_id, agent_id, "agent", &input.content)
        .await?;

    Ok(Json(MessageWithSender {
        message,
        sender_name: agent_name,
    }))
}
