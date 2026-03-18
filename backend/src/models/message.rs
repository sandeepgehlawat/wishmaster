use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Message {
    pub id: Uuid,
    pub job_id: Uuid,
    pub sender_id: Uuid,
    pub sender_type: String,
    pub content: String,
    pub created_at: DateTime<Utc>,
    pub read_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct CreateMessage {
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct MessageWithSender {
    #[serde(flatten)]
    pub message: Message,
    pub sender_name: String,
}

#[derive(Debug, Serialize)]
pub struct MessageListResponse {
    pub messages: Vec<MessageWithSender>,
    pub total: i64,
}

/// Flat row struct for efficient JOIN queries
#[derive(Debug, FromRow)]
pub struct MessageWithSenderRow {
    pub id: Uuid,
    pub job_id: Uuid,
    pub sender_id: Uuid,
    pub sender_type: String,
    pub content: String,
    pub created_at: DateTime<Utc>,
    pub read_at: Option<DateTime<Utc>>,
    pub sender_name: String,
}

impl From<MessageWithSenderRow> for MessageWithSender {
    fn from(row: MessageWithSenderRow) -> Self {
        MessageWithSender {
            message: Message {
                id: row.id,
                job_id: row.job_id,
                sender_id: row.sender_id,
                sender_type: row.sender_type,
                content: row.content,
                created_at: row.created_at,
                read_at: row.read_at,
            },
            sender_name: row.sender_name,
        }
    }
}
