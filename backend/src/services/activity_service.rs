use crate::error::{AppError, Result};
use crate::models::{ActivityAction, ActivityListParams, ActivityListResponse, ActivityWithActor};
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Clone)]
pub struct ActivityService {
    db: PgPool,
}

impl ActivityService {
    pub fn new(db: PgPool) -> Self {
        Self { db }
    }

    /// Log an activity event
    pub async fn log(
        &self,
        job_id: Uuid,
        actor_id: Uuid,
        actor_type: &str,
        action: ActivityAction,
        details: Option<serde_json::Value>,
    ) -> Result<()> {
        sqlx::query(
            r#"
            INSERT INTO activity_log (job_id, actor_id, actor_type, action, details)
            VALUES ($1, $2, $3, $4, $5)
            "#,
        )
        .bind(job_id)
        .bind(actor_id)
        .bind(actor_type)
        .bind(action.to_string())
        .bind(details.unwrap_or_else(|| json!({})))
        .execute(&self.db)
        .await?;

        Ok(())
    }

    /// List activities for a job
    pub async fn list_for_job(
        &self,
        job_id: Uuid,
        params: ActivityListParams,
    ) -> Result<ActivityListResponse> {
        let limit = params.limit.unwrap_or(50).min(100);
        let offset = params.offset.unwrap_or(0);

        let activities: Vec<ActivityWithActor> = if let Some(action) = params.action {
            sqlx::query_as(
                r#"
                SELECT
                    a.id, a.job_id, a.actor_id, a.actor_type, a.action, a.details, a.created_at,
                    CASE
                        WHEN a.actor_type = 'client' THEN COALESCE(u.display_name, 'Client')
                        WHEN a.actor_type = 'agent' THEN COALESCE(ag.display_name, 'Agent')
                        ELSE 'System'
                    END as actor_name
                FROM activity_log a
                LEFT JOIN users u ON a.actor_type = 'client' AND a.actor_id = u.id
                LEFT JOIN agents ag ON a.actor_type = 'agent' AND a.actor_id = ag.id
                WHERE a.job_id = $1 AND a.action = $2
                ORDER BY a.created_at DESC
                LIMIT $3 OFFSET $4
                "#,
            )
            .bind(job_id)
            .bind(&action)
            .bind(limit)
            .bind(offset)
            .fetch_all(&self.db)
            .await?
        } else {
            sqlx::query_as(
                r#"
                SELECT
                    a.id, a.job_id, a.actor_id, a.actor_type, a.action, a.details, a.created_at,
                    CASE
                        WHEN a.actor_type = 'client' THEN COALESCE(u.display_name, 'Client')
                        WHEN a.actor_type = 'agent' THEN COALESCE(ag.display_name, 'Agent')
                        ELSE 'System'
                    END as actor_name
                FROM activity_log a
                LEFT JOIN users u ON a.actor_type = 'client' AND a.actor_id = u.id
                LEFT JOIN agents ag ON a.actor_type = 'agent' AND a.actor_id = ag.id
                WHERE a.job_id = $1
                ORDER BY a.created_at DESC
                LIMIT $2 OFFSET $3
                "#,
            )
            .bind(job_id)
            .bind(limit)
            .bind(offset)
            .fetch_all(&self.db)
            .await?
        };

        // Get total count
        let total: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM activity_log WHERE job_id = $1"
        )
        .bind(job_id)
        .fetch_one(&self.db)
        .await?;

        Ok(ActivityListResponse {
            activities,
            total: total.0,
        })
    }

    /// Check if user can access job activities
    pub async fn can_access_job(&self, job_id: Uuid, user_id: Uuid, user_type: &str) -> Result<bool> {
        let job: Option<(Uuid, Option<Uuid>)> = sqlx::query_as(
            "SELECT client_id, agent_id FROM jobs WHERE id = $1"
        )
        .bind(job_id)
        .fetch_optional(&self.db)
        .await?;

        match job {
            None => Err(AppError::NotFound("Job not found".to_string())),
            Some((client_id, agent_id)) => {
                if (user_type == "client" || user_type == "user") && client_id == user_id {
                    return Ok(true);
                }
                if user_type == "agent" {
                    if let Some(assigned_agent) = agent_id {
                        if assigned_agent == user_id {
                            return Ok(true);
                        }
                    }
                }
                Err(AppError::Forbidden("Not authorized".to_string()))
            }
        }
    }
}

// Helper functions for common activity logging
impl ActivityService {
    pub async fn log_job_created(&self, job_id: Uuid, client_id: Uuid, title: &str) -> Result<()> {
        self.log(
            job_id,
            client_id,
            "client",
            ActivityAction::JobCreated,
            Some(json!({ "title": title })),
        )
        .await
    }

    pub async fn log_job_published(&self, job_id: Uuid, client_id: Uuid) -> Result<()> {
        self.log(job_id, client_id, "client", ActivityAction::JobPublished, None)
            .await
    }

    pub async fn log_bid_submitted(&self, job_id: Uuid, agent_id: Uuid, amount: f64) -> Result<()> {
        self.log(
            job_id,
            agent_id,
            "agent",
            ActivityAction::BidSubmitted,
            Some(json!({ "amount": amount })),
        )
        .await
    }

    pub async fn log_bid_accepted(&self, job_id: Uuid, client_id: Uuid, agent_name: &str) -> Result<()> {
        self.log(
            job_id,
            client_id,
            "client",
            ActivityAction::BidAccepted,
            Some(json!({ "agent_name": agent_name })),
        )
        .await
    }

    pub async fn log_requirement_added(&self, job_id: Uuid, client_id: Uuid, title: &str) -> Result<()> {
        self.log(
            job_id,
            client_id,
            "client",
            ActivityAction::RequirementAdded,
            Some(json!({ "title": title })),
        )
        .await
    }

    pub async fn log_requirement_delivered(&self, job_id: Uuid, agent_id: Uuid, title: &str) -> Result<()> {
        self.log(
            job_id,
            agent_id,
            "agent",
            ActivityAction::RequirementDelivered,
            Some(json!({ "title": title })),
        )
        .await
    }

    pub async fn log_requirement_accepted(&self, job_id: Uuid, client_id: Uuid, title: &str) -> Result<()> {
        self.log(
            job_id,
            client_id,
            "client",
            ActivityAction::RequirementAccepted,
            Some(json!({ "title": title })),
        )
        .await
    }

    pub async fn log_requirement_rejected(&self, job_id: Uuid, client_id: Uuid, title: &str) -> Result<()> {
        self.log(
            job_id,
            client_id,
            "client",
            ActivityAction::RequirementRejected,
            Some(json!({ "title": title })),
        )
        .await
    }

    pub async fn log_deliverable_submitted(&self, job_id: Uuid, agent_id: Uuid, title: &str) -> Result<()> {
        self.log(
            job_id,
            agent_id,
            "agent",
            ActivityAction::DeliverableSubmitted,
            Some(json!({ "title": title })),
        )
        .await
    }

    pub async fn log_deliverable_approved(&self, job_id: Uuid, client_id: Uuid, title: &str) -> Result<()> {
        self.log(
            job_id,
            client_id,
            "client",
            ActivityAction::DeliverableApproved,
            Some(json!({ "title": title })),
        )
        .await
    }

    pub async fn log_deliverable_changes_requested(&self, job_id: Uuid, client_id: Uuid, title: &str) -> Result<()> {
        self.log(
            job_id,
            client_id,
            "client",
            ActivityAction::DeliverableChangesRequested,
            Some(json!({ "title": title })),
        )
        .await
    }

    pub async fn log_message_sent(&self, job_id: Uuid, sender_id: Uuid, sender_type: &str) -> Result<()> {
        self.log(
            job_id,
            sender_id,
            sender_type,
            ActivityAction::MessageSent,
            None,
        )
        .await
    }
}
