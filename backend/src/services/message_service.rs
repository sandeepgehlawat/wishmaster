use crate::error::{AppError, Result};
use crate::models::{Message, MessageListResponse, MessageWithSender, MessageWithSenderRow};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Clone)]
pub struct MessageService {
    db: PgPool,
}

impl MessageService {
    pub fn new(db: PgPool) -> Self {
        Self { db }
    }

    /// Create a new message for a job
    pub async fn create(
        &self,
        job_id: Uuid,
        sender_id: Uuid,
        sender_type: &str,
        content: &str,
    ) -> Result<Message> {
        let id = Uuid::new_v4();

        let message = sqlx::query_as::<_, Message>(
            r#"
            INSERT INTO messages (id, job_id, sender_id, sender_type, content)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(job_id)
        .bind(sender_id)
        .bind(sender_type)
        .bind(content)
        .fetch_one(&self.db)
        .await?;

        Ok(message)
    }

    /// List messages for a job with sender names
    pub async fn list_for_job(&self, job_id: Uuid) -> Result<MessageListResponse> {
        let rows: Vec<MessageWithSenderRow> = sqlx::query_as(
            r#"
            SELECT
                m.id,
                m.job_id,
                m.sender_id,
                m.sender_type,
                m.content,
                m.created_at,
                m.read_at,
                CASE
                    WHEN m.sender_type = 'client' THEN COALESCE(u.display_name, 'Client')
                    WHEN m.sender_type = 'agent' THEN COALESCE(a.display_name, 'Agent')
                    ELSE 'Unknown'
                END as sender_name
            FROM messages m
            LEFT JOIN users u ON m.sender_type = 'client' AND m.sender_id = u.id
            LEFT JOIN agents a ON m.sender_type = 'agent' AND m.sender_id = a.id
            WHERE m.job_id = $1
            ORDER BY m.created_at ASC
            "#,
        )
        .bind(job_id)
        .fetch_all(&self.db)
        .await?;

        let total = rows.len() as i64;
        let messages: Vec<MessageWithSender> = rows.into_iter().map(|r| r.into()).collect();

        Ok(MessageListResponse { messages, total })
    }

    /// Mark all unread messages as read for a user in a job
    pub async fn mark_as_read(
        &self,
        job_id: Uuid,
        _reader_id: Uuid,
        reader_type: &str,
    ) -> Result<i64> {
        // Mark messages from the OTHER party as read
        let other_type = if reader_type == "client" { "agent" } else { "client" };

        let result = sqlx::query(
            r#"
            UPDATE messages
            SET read_at = NOW()
            WHERE job_id = $1
              AND sender_type = $2
              AND read_at IS NULL
            "#,
        )
        .bind(job_id)
        .bind(other_type)
        .execute(&self.db)
        .await?;

        Ok(result.rows_affected() as i64)
    }

    /// Get unread message count for a user in a job
    pub async fn get_unread_count(
        &self,
        job_id: Uuid,
        reader_id: Uuid,
        reader_type: &str,
    ) -> Result<i64> {
        // Count messages from the OTHER party that haven't been read
        let other_type = if reader_type == "client" { "agent" } else { "client" };

        let count: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*)
            FROM messages
            WHERE job_id = $1
              AND sender_type = $2
              AND read_at IS NULL
            "#,
        )
        .bind(job_id)
        .bind(other_type)
        .fetch_one(&self.db)
        .await?;

        Ok(count.0)
    }

    /// Check if a user can access messages for a job
    pub async fn can_access_job(
        &self,
        job_id: Uuid,
        user_id: Uuid,
        user_type: &str,
    ) -> Result<bool> {
        let job: Option<(Uuid, Option<Uuid>, String)> = sqlx::query_as(
            "SELECT client_id, agent_id, status FROM jobs WHERE id = $1"
        )
        .bind(job_id)
        .fetch_optional(&self.db)
        .await?;

        match job {
            None => Err(AppError::NotFound("Job not found".to_string())),
            Some((client_id, agent_id, _status)) => {
                // Client can access if they own the job
                if user_type == "client" && client_id == user_id {
                    // Client can only message if job has an assigned agent
                    if agent_id.is_none() {
                        return Err(AppError::BadRequest(
                            "Cannot message until an agent is assigned".to_string()
                        ));
                    }
                    return Ok(true);
                }

                // Agent can access if they are assigned to the job
                if user_type == "agent" {
                    if let Some(assigned_agent) = agent_id {
                        if assigned_agent == user_id {
                            return Ok(true);
                        }
                    }
                }

                Err(AppError::Forbidden("Not authorized to access this job's messages".to_string()))
            }
        }
    }
}
