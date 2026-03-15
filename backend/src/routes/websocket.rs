use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path,
    },
    response::IntoResponse,
    Extension,
};
use std::sync::Arc;
use uuid::Uuid;

use crate::services::Services;

/// WebSocket connection for real-time job updates
/// Clients subscribe to progress events for a specific job
pub async fn job_updates(
    ws: WebSocketUpgrade,
    Path(job_id): Path<Uuid>,
    Extension(services): Extension<Arc<Services>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_job_socket(socket, job_id, services))
}

/// WebSocket connection for agent notifications
/// Agents subscribe to receive job assignments, messages, etc.
pub async fn agent_notifications(
    ws: WebSocketUpgrade,
    Path(agent_id): Path<Uuid>,
    Extension(services): Extension<Arc<Services>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_agent_socket(socket, agent_id, services))
}

async fn handle_job_socket(mut socket: WebSocket, job_id: Uuid, services: Arc<Services>) {
    tracing::info!("WebSocket connected for job {}", job_id);

    // Get initial progress if available
    if let Some(progress) = services.sandbox.get_progress(job_id).await {
        if let Ok(json) = serde_json::to_string(&progress) {
            let _ = socket.send(Message::Text(json)).await;
        }
    }

    // Use polling mode for progress updates
    // In production, this could be enhanced with Redis pub/sub using a dedicated connection pool
    poll_job_progress(&mut socket, job_id, &services).await;

    tracing::info!("WebSocket disconnected for job {}", job_id);
}

/// Poll for job progress updates
async fn poll_job_progress(socket: &mut WebSocket, job_id: Uuid, services: &Arc<Services>) {
    let mut last_progress: Option<u8> = None;
    let mut last_message: Option<String> = None;
    let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(1));

    loop {
        tokio::select! {
            _ = interval.tick() => {
                if let Some(progress) = services.sandbox.get_progress(job_id).await {
                    // Only send if progress or message changed
                    let progress_changed = last_progress != Some(progress.progress_percent);
                    let message_changed = last_message.as_ref() != Some(&progress.status_message);

                    if progress_changed || message_changed {
                        last_progress = Some(progress.progress_percent);
                        last_message = Some(progress.status_message.clone());

                        if let Ok(json) = serde_json::to_string(&progress) {
                            if socket.send(Message::Text(json)).await.is_err() {
                                break;
                            }
                        }
                    }

                    // Stop polling if job completed
                    if progress.progress_percent >= 100 {
                        // Give client time to receive final update
                        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                        break;
                    }
                }
            }
            Some(msg) = socket.recv() => {
                match msg {
                    Ok(Message::Close(_)) => break,
                    Ok(Message::Ping(data)) => {
                        let _ = socket.send(Message::Pong(data)).await;
                    }
                    Err(_) => break,
                    _ => {}
                }
            }
        }
    }
}

async fn handle_agent_socket(mut socket: WebSocket, agent_id: Uuid, _services: Arc<Services>) {
    tracing::info!("WebSocket connected for agent {}", agent_id);

    // Keep agent connection alive with periodic pings
    // In production, this would receive notifications from Redis pub/sub
    let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(30));

    loop {
        tokio::select! {
            _ = interval.tick() => {
                // Send ping to keep connection alive
                if socket.send(Message::Ping(vec![])).await.is_err() {
                    break;
                }
            }
            Some(msg) = socket.recv() => {
                match msg {
                    Ok(Message::Close(_)) => break,
                    Ok(Message::Pong(_)) => {
                        // Client is alive
                    }
                    Ok(Message::Text(text)) => {
                        // Handle client messages (e.g., subscribe to specific events)
                        tracing::debug!("Agent {} sent: {}", agent_id, text);
                    }
                    Err(_) => break,
                    _ => {}
                }
            }
        }
    }

    tracing::info!("WebSocket disconnected for agent {}", agent_id);
}

/// Helper to publish notification to an agent
/// This can be called from other services to send real-time notifications
#[allow(dead_code)]
pub fn publish_agent_notification(
    redis_client: &Option<redis::Client>,
    agent_id: Uuid,
    notification: &serde_json::Value,
) -> Result<(), redis::RedisError> {
    if let Some(client) = redis_client {
        let mut conn = client.get_connection()?;
        let channel = format!("agent:{}:notifications", agent_id);
        let payload = serde_json::to_string(notification).unwrap_or_default();
        redis::cmd("PUBLISH")
            .arg(&channel)
            .arg(&payload)
            .query::<()>(&mut conn)?;
    }
    Ok(())
}

/// Helper to publish job progress event
/// This is used by sandbox_service to broadcast progress updates
#[allow(dead_code)]
pub fn publish_job_progress(
    redis_client: &Option<redis::Client>,
    job_id: Uuid,
    progress: &serde_json::Value,
) -> Result<(), redis::RedisError> {
    if let Some(client) = redis_client {
        let mut conn = client.get_connection()?;
        let channel = format!("job:{}:progress", job_id);
        let payload = serde_json::to_string(progress).unwrap_or_default();
        redis::cmd("PUBLISH")
            .arg(&channel)
            .arg(&payload)
            .query::<()>(&mut conn)?;
    }
    Ok(())
}
