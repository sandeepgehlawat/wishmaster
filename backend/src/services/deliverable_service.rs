use crate::error::{AppError, Result};
use crate::models::{
    CreateDeliverable, Deliverable, DeliverableListResponse, DeliverableStatus,
    DeliverableWithDetails, RequestChanges,
};
use sqlx::PgPool;
use uuid::Uuid;
use validator::Validate;

#[derive(Clone)]
pub struct DeliverableService {
    db: PgPool,
}

impl DeliverableService {
    pub fn new(db: PgPool) -> Self {
        Self { db }
    }

    /// Submit a deliverable (agent only)
    pub async fn create(
        &self,
        job_id: Uuid,
        agent_id: Uuid,
        input: CreateDeliverable,
    ) -> Result<Deliverable> {
        // Validate input
        input.validate().map_err(|e| {
            AppError::Validation(format!("Invalid input: {}", e))
        })?;

        // Determine version if this is a revision
        let version = if let Some(parent_id) = input.requirement_id {
            // Check for existing deliverables for this requirement
            let max_version: Option<i32> = sqlx::query_scalar(
                "SELECT MAX(version) FROM deliverables WHERE requirement_id = $1"
            )
            .bind(parent_id)
            .fetch_one(&self.db)
            .await?;
            max_version.unwrap_or(0) + 1
        } else {
            1
        };

        let deliverable = sqlx::query_as::<_, Deliverable>(
            r#"
            INSERT INTO deliverables (
                job_id, requirement_id, agent_id, title, description,
                file_url, file_name, file_size, mime_type, version
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
            "#,
        )
        .bind(job_id)
        .bind(input.requirement_id)
        .bind(agent_id)
        .bind(&input.title)
        .bind(&input.description)
        .bind(&input.file_url)
        .bind(&input.file_name)
        .bind(input.file_size)
        .bind(&input.mime_type)
        .bind(version)
        .fetch_one(&self.db)
        .await?;

        // If linked to a requirement, mark it as delivered
        if let Some(req_id) = input.requirement_id {
            sqlx::query(
                "UPDATE requirements SET status = 'delivered', updated_at = NOW() WHERE id = $1"
            )
            .bind(req_id)
            .execute(&self.db)
            .await?;
        }

        Ok(deliverable)
    }

    /// List deliverables for a job with details
    pub async fn list_for_job(&self, job_id: Uuid) -> Result<DeliverableListResponse> {
        let deliverables: Vec<DeliverableWithDetails> = sqlx::query_as(
            r#"
            SELECT
                d.id, d.job_id, d.requirement_id, d.agent_id, d.title,
                d.description, d.file_url, d.file_name, d.file_size, d.mime_type,
                d.status, d.client_feedback, d.version, d.parent_id,
                d.created_at, d.reviewed_at,
                r.title as requirement_title,
                COALESCE(a.display_name, 'Agent') as agent_name
            FROM deliverables d
            LEFT JOIN requirements r ON d.requirement_id = r.id
            LEFT JOIN agents a ON d.agent_id = a.id
            WHERE d.job_id = $1
            ORDER BY d.created_at DESC
            "#,
        )
        .bind(job_id)
        .fetch_all(&self.db)
        .await?;

        let total = deliverables.len() as i64;
        let pending_review = deliverables
            .iter()
            .filter(|d| d.status == "pending_review")
            .count() as i64;

        Ok(DeliverableListResponse {
            deliverables,
            total,
            pending_review,
        })
    }

    /// Get a single deliverable
    pub async fn get_by_id(&self, id: Uuid) -> Result<Deliverable> {
        sqlx::query_as::<_, Deliverable>("SELECT * FROM deliverables WHERE id = $1")
            .bind(id)
            .fetch_optional(&self.db)
            .await?
            .ok_or_else(|| AppError::NotFound("Deliverable not found".to_string()))
    }

    /// Approve a deliverable (client)
    pub async fn approve(&self, id: Uuid) -> Result<Deliverable> {
        // Get current deliverable for validation
        let current = self.get_by_id(id).await?;
        let status = DeliverableStatus::try_from(current.status.as_str())
            .map_err(|e| AppError::Internal(e))?;

        // Idempotency: Already approved is OK
        if status == DeliverableStatus::Approved {
            return Ok(current);
        }

        // Only pending_review can be approved
        if status != DeliverableStatus::PendingReview {
            return Err(AppError::BadRequest(format!(
                "Cannot approve deliverable with status '{}'. Must be 'pending_review'.",
                current.status
            )));
        }

        let deliverable = sqlx::query_as::<_, Deliverable>(
            r#"
            UPDATE deliverables
            SET status = 'approved', reviewed_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .fetch_one(&self.db)
        .await
        .map_err(|_| AppError::NotFound("Deliverable not found".to_string()))?;

        // If linked to a requirement, mark it as accepted
        if let Some(req_id) = deliverable.requirement_id {
            sqlx::query(
                "UPDATE requirements SET status = 'accepted', accepted_at = NOW(), updated_at = NOW() WHERE id = $1"
            )
            .bind(req_id)
            .execute(&self.db)
            .await?;
        }

        Ok(deliverable)
    }

    /// Request changes on a deliverable (client)
    pub async fn request_changes(&self, id: Uuid, input: RequestChanges) -> Result<Deliverable> {
        // Validate input
        input.validate().map_err(|e| {
            AppError::Validation(format!("Invalid input: {}", e))
        })?;

        // Get current deliverable for validation
        let current = self.get_by_id(id).await?;
        let status = DeliverableStatus::try_from(current.status.as_str())
            .map_err(|e| AppError::Internal(e))?;

        // Only pending_review can request changes
        if status != DeliverableStatus::PendingReview {
            return Err(AppError::BadRequest(format!(
                "Cannot request changes on deliverable with status '{}'. Must be 'pending_review'.",
                current.status
            )));
        }

        let deliverable = sqlx::query_as::<_, Deliverable>(
            r#"
            UPDATE deliverables
            SET status = 'changes_requested', client_feedback = $2, reviewed_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(&input.feedback)
        .fetch_one(&self.db)
        .await
        .map_err(|_| AppError::NotFound("Deliverable not found".to_string()))?;

        // If linked to a requirement, mark it as rejected
        if let Some(req_id) = deliverable.requirement_id {
            sqlx::query(
                "UPDATE requirements SET status = 'rejected', rejection_feedback = $2, updated_at = NOW() WHERE id = $1"
            )
            .bind(req_id)
            .bind(&input.feedback)
            .execute(&self.db)
            .await?;
        }

        Ok(deliverable)
    }

    /// Check if user can access deliverable
    pub async fn can_access(
        &self,
        deliverable_id: Uuid,
        user_id: Uuid,
        user_type: &str,
    ) -> Result<bool> {
        let deliverable = self.get_by_id(deliverable_id).await?;

        let job: Option<(Uuid, Option<Uuid>)> = sqlx::query_as(
            "SELECT client_id, agent_id FROM jobs WHERE id = $1"
        )
        .bind(deliverable.job_id)
        .fetch_optional(&self.db)
        .await?;

        match job {
            None => Err(AppError::NotFound("Job not found".to_string())),
            Some((client_id, agent_id)) => {
                if user_type == "client" && client_id == user_id {
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

    /// Check if agent is assigned to job
    pub async fn agent_assigned_to_job(&self, job_id: Uuid, agent_id: Uuid) -> Result<bool> {
        let job: Option<(Option<Uuid>,)> = sqlx::query_as(
            "SELECT agent_id FROM jobs WHERE id = $1"
        )
        .bind(job_id)
        .fetch_optional(&self.db)
        .await?;

        match job {
            None => Err(AppError::NotFound("Job not found".to_string())),
            Some((assigned_agent,)) => {
                Ok(assigned_agent == Some(agent_id))
            }
        }
    }

    /// Check if user owns job (for deliverable review)
    pub async fn user_owns_job(&self, job_id: Uuid, user_id: Uuid) -> Result<bool> {
        let job: Option<(Uuid,)> = sqlx::query_as(
            "SELECT client_id FROM jobs WHERE id = $1"
        )
        .bind(job_id)
        .fetch_optional(&self.db)
        .await?;

        match job {
            None => Err(AppError::NotFound("Job not found".to_string())),
            Some((client_id,)) => Ok(client_id == user_id),
        }
    }
}
