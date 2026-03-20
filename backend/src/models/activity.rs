use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use sqlx::FromRow;
use uuid::Uuid;

/// Activity action types for auto-logging
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ActivityAction {
    // Job lifecycle
    JobCreated,
    JobPublished,
    JobCancelled,
    JobCompleted,
    // Bidding
    BidSubmitted,
    BidAccepted,
    BidRejected,
    BidWithdrawn,
    // Requirements
    RequirementAdded,
    RequirementUpdated,
    RequirementDelivered,
    RequirementAccepted,
    RequirementRejected,
    // Deliverables
    DeliverableSubmitted,
    DeliverableApproved,
    DeliverableChangesRequested,
    // Communication
    MessageSent,
    // Escrow
    EscrowFunded,
    EscrowReleased,
    // Other
    Custom(String),
}

impl std::fmt::Display for ActivityAction {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::JobCreated => write!(f, "job_created"),
            Self::JobPublished => write!(f, "job_published"),
            Self::JobCancelled => write!(f, "job_cancelled"),
            Self::JobCompleted => write!(f, "job_completed"),
            Self::BidSubmitted => write!(f, "bid_submitted"),
            Self::BidAccepted => write!(f, "bid_accepted"),
            Self::BidRejected => write!(f, "bid_rejected"),
            Self::BidWithdrawn => write!(f, "bid_withdrawn"),
            Self::RequirementAdded => write!(f, "requirement_added"),
            Self::RequirementUpdated => write!(f, "requirement_updated"),
            Self::RequirementDelivered => write!(f, "requirement_delivered"),
            Self::RequirementAccepted => write!(f, "requirement_accepted"),
            Self::RequirementRejected => write!(f, "requirement_rejected"),
            Self::DeliverableSubmitted => write!(f, "deliverable_submitted"),
            Self::DeliverableApproved => write!(f, "deliverable_approved"),
            Self::DeliverableChangesRequested => write!(f, "deliverable_changes_requested"),
            Self::MessageSent => write!(f, "message_sent"),
            Self::EscrowFunded => write!(f, "escrow_funded"),
            Self::EscrowReleased => write!(f, "escrow_released"),
            Self::Custom(s) => write!(f, "{}", s),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Activity {
    pub id: Uuid,
    pub job_id: Uuid,
    pub actor_id: Uuid,
    pub actor_type: String,
    pub action: String,
    pub details: JsonValue,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct ActivityWithActor {
    pub id: Uuid,
    pub job_id: Uuid,
    pub actor_id: Uuid,
    pub actor_type: String,
    pub action: String,
    pub details: JsonValue,
    pub created_at: DateTime<Utc>,
    pub actor_name: String,
}

#[derive(Debug, Serialize)]
pub struct ActivityListResponse {
    pub activities: Vec<ActivityWithActor>,
    pub total: i64,
}

#[derive(Debug, Deserialize)]
pub struct ActivityListParams {
    #[serde(default)]
    pub limit: Option<i64>,
    #[serde(default)]
    pub offset: Option<i64>,
    #[serde(default)]
    pub action: Option<String>,
}
