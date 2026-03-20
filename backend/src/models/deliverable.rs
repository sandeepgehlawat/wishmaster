use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum DeliverableStatus {
    PendingReview,
    Approved,
    ChangesRequested,
}

impl Default for DeliverableStatus {
    fn default() -> Self {
        Self::PendingReview
    }
}

impl std::fmt::Display for DeliverableStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::PendingReview => write!(f, "pending_review"),
            Self::Approved => write!(f, "approved"),
            Self::ChangesRequested => write!(f, "changes_requested"),
        }
    }
}

impl TryFrom<&str> for DeliverableStatus {
    type Error = String;
    fn try_from(s: &str) -> Result<Self, Self::Error> {
        match s {
            "pending_review" => Ok(Self::PendingReview),
            "approved" => Ok(Self::Approved),
            "changes_requested" => Ok(Self::ChangesRequested),
            _ => Err(format!("Invalid status: {}", s)),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Deliverable {
    pub id: Uuid,
    pub job_id: Uuid,
    pub requirement_id: Option<Uuid>,
    pub agent_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub file_url: Option<String>,
    pub file_name: Option<String>,
    pub file_size: Option<i64>,
    pub mime_type: Option<String>,
    pub status: String,
    pub client_feedback: Option<String>,
    pub version: i32,
    pub parent_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub reviewed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct DeliverableWithDetails {
    // Deliverable fields
    pub id: Uuid,
    pub job_id: Uuid,
    pub requirement_id: Option<Uuid>,
    pub agent_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub file_url: Option<String>,
    pub file_name: Option<String>,
    pub file_size: Option<i64>,
    pub mime_type: Option<String>,
    pub status: String,
    pub client_feedback: Option<String>,
    pub version: i32,
    pub parent_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub reviewed_at: Option<DateTime<Utc>>,
    // Joined fields
    pub requirement_title: Option<String>,
    pub agent_name: String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateDeliverable {
    pub requirement_id: Option<Uuid>,
    #[validate(length(min = 1, max = 255, message = "Title must be 1-255 characters"))]
    pub title: String,
    #[validate(length(max = 10000, message = "Description must be under 10000 characters"))]
    pub description: Option<String>,
    #[validate(url(message = "Invalid file URL"))]
    pub file_url: Option<String>,
    #[validate(length(max = 255, message = "File name must be under 255 characters"))]
    pub file_name: Option<String>,
    pub file_size: Option<i64>,
    #[validate(length(max = 100, message = "MIME type must be under 100 characters"))]
    pub mime_type: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct RequestChanges {
    #[validate(length(min = 1, max = 5000, message = "Feedback must be 1-5000 characters"))]
    pub feedback: String,
}

#[derive(Debug, Serialize)]
pub struct DeliverableListResponse {
    pub deliverables: Vec<DeliverableWithDetails>,
    pub total: i64,
    pub pending_review: i64,
}
