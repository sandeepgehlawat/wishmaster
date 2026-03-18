use crate::error::{AppError, Result};
use crate::models::{
    CreateRequirement, RejectRequirement, Requirement, RequirementListResponse,
    RequirementStatus, UpdateRequirement,
};
use sqlx::PgPool;
use uuid::Uuid;
use validator::Validate;

#[derive(Clone)]
pub struct RequirementService {
    db: PgPool,
}

impl RequirementService {
    pub fn new(db: PgPool) -> Self {
        Self { db }
    }

    /// Create a new requirement for a job (client only)
    pub async fn create(
        &self,
        job_id: Uuid,
        created_by: Uuid,
        input: CreateRequirement,
    ) -> Result<Requirement> {
        // Validate input
        input.validate().map_err(|e| {
            AppError::Validation(format!("Invalid input: {}", e))
        })?;

        // Get next position
        let max_pos: Option<i32> = sqlx::query_scalar(
            "SELECT MAX(position) FROM requirements WHERE job_id = $1"
        )
        .bind(job_id)
        .fetch_one(&self.db)
        .await?;

        let position = input.position.unwrap_or_else(|| max_pos.unwrap_or(-1) + 1);
        let priority = input.priority.unwrap_or_else(|| "must_have".to_string());

        let requirement = sqlx::query_as::<_, Requirement>(
            r#"
            INSERT INTO requirements (job_id, created_by, title, description, acceptance_criteria, priority, position)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
            "#,
        )
        .bind(job_id)
        .bind(created_by)
        .bind(&input.title)
        .bind(&input.description)
        .bind(&input.acceptance_criteria)
        .bind(&priority)
        .bind(position)
        .fetch_one(&self.db)
        .await?;

        Ok(requirement)
    }

    /// List requirements for a job
    pub async fn list_for_job(&self, job_id: Uuid) -> Result<RequirementListResponse> {
        let requirements: Vec<Requirement> = sqlx::query_as(
            r#"
            SELECT * FROM requirements
            WHERE job_id = $1
            ORDER BY position ASC, created_at ASC
            "#,
        )
        .bind(job_id)
        .fetch_all(&self.db)
        .await?;

        let total = requirements.len() as i64;
        let completed = requirements
            .iter()
            .filter(|r| r.status == "accepted")
            .count() as i64;

        Ok(RequirementListResponse {
            requirements,
            total,
            completed,
        })
    }

    /// Get a single requirement by ID
    pub async fn get_by_id(&self, id: Uuid) -> Result<Requirement> {
        sqlx::query_as::<_, Requirement>("SELECT * FROM requirements WHERE id = $1")
            .bind(id)
            .fetch_optional(&self.db)
            .await?
            .ok_or_else(|| AppError::NotFound("Requirement not found".to_string()))
    }

    /// Update a requirement
    pub async fn update(&self, id: Uuid, input: UpdateRequirement) -> Result<Requirement> {
        let mut query = String::from("UPDATE requirements SET updated_at = NOW()");
        let mut param_count = 0;

        if input.title.is_some() {
            param_count += 1;
            query.push_str(&format!(", title = ${}", param_count));
        }
        if input.description.is_some() {
            param_count += 1;
            query.push_str(&format!(", description = ${}", param_count));
        }
        if input.acceptance_criteria.is_some() {
            param_count += 1;
            query.push_str(&format!(", acceptance_criteria = ${}", param_count));
        }
        if input.priority.is_some() {
            param_count += 1;
            query.push_str(&format!(", priority = ${}", param_count));
        }
        if input.status.is_some() {
            param_count += 1;
            query.push_str(&format!(", status = ${}", param_count));
        }
        if input.position.is_some() {
            param_count += 1;
            query.push_str(&format!(", position = ${}", param_count));
        }

        param_count += 1;
        query.push_str(&format!(" WHERE id = ${} RETURNING *", param_count));

        let mut q = sqlx::query_as::<_, Requirement>(&query);

        if let Some(ref title) = input.title {
            q = q.bind(title);
        }
        if let Some(ref description) = input.description {
            q = q.bind(description);
        }
        if let Some(ref acceptance_criteria) = input.acceptance_criteria {
            q = q.bind(acceptance_criteria);
        }
        if let Some(ref priority) = input.priority {
            q = q.bind(priority);
        }
        if let Some(ref status) = input.status {
            q = q.bind(status);
        }
        if let Some(position) = input.position {
            q = q.bind(position);
        }

        q = q.bind(id);

        q.fetch_one(&self.db)
            .await
            .map_err(|_| AppError::NotFound("Requirement not found".to_string()))
    }

    /// Mark requirement as delivered (agent)
    pub async fn mark_delivered(&self, id: Uuid) -> Result<Requirement> {
        // Get current status and validate transition
        let current = self.get_by_id(id).await?;
        let current_status = RequirementStatus::try_from(current.status.as_str())
            .map_err(|e| AppError::Internal(e))?;

        if !current_status.can_transition_to(&RequirementStatus::Delivered) {
            return Err(AppError::BadRequest(format!(
                "Cannot mark requirement as delivered from '{}' status. Valid states: {:?}",
                current.status,
                current_status.valid_transitions()
            )));
        }

        sqlx::query_as::<_, Requirement>(
            r#"
            UPDATE requirements
            SET status = 'delivered', updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .fetch_one(&self.db)
        .await
        .map_err(|_| AppError::NotFound("Requirement not found".to_string()))
    }

    /// Accept a requirement (client)
    pub async fn accept(&self, id: Uuid) -> Result<Requirement> {
        // Get current status and validate transition
        let current = self.get_by_id(id).await?;
        let current_status = RequirementStatus::try_from(current.status.as_str())
            .map_err(|e| AppError::Internal(e))?;

        // Idempotency: Already accepted is OK
        if current_status == RequirementStatus::Accepted {
            return Ok(current);
        }

        if !current_status.can_transition_to(&RequirementStatus::Accepted) {
            return Err(AppError::BadRequest(format!(
                "Cannot accept requirement from '{}' status. Requirement must be 'delivered' first.",
                current.status
            )));
        }

        sqlx::query_as::<_, Requirement>(
            r#"
            UPDATE requirements
            SET status = 'accepted', accepted_at = NOW(), updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .fetch_one(&self.db)
        .await
        .map_err(|_| AppError::NotFound("Requirement not found".to_string()))
    }

    /// Reject a requirement with feedback (client)
    pub async fn reject(&self, id: Uuid, input: RejectRequirement) -> Result<Requirement> {
        // Get current status and validate transition
        let current = self.get_by_id(id).await?;
        let current_status = RequirementStatus::try_from(current.status.as_str())
            .map_err(|e| AppError::Internal(e))?;

        if !current_status.can_transition_to(&RequirementStatus::Rejected) {
            return Err(AppError::BadRequest(format!(
                "Cannot reject requirement from '{}' status. Requirement must be 'delivered' first.",
                current.status
            )));
        }

        sqlx::query_as::<_, Requirement>(
            r#"
            UPDATE requirements
            SET status = 'rejected', rejection_feedback = $2, updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(&input.feedback)
        .fetch_one(&self.db)
        .await
        .map_err(|_| AppError::NotFound("Requirement not found".to_string()))
    }

    /// Delete a requirement
    pub async fn delete(&self, id: Uuid) -> Result<()> {
        let result = sqlx::query("DELETE FROM requirements WHERE id = $1")
            .bind(id)
            .execute(&self.db)
            .await?;

        if result.rows_affected() == 0 {
            return Err(AppError::NotFound("Requirement not found".to_string()));
        }

        Ok(())
    }

    /// Check if user can access requirement
    pub async fn can_access(
        &self,
        requirement_id: Uuid,
        user_id: Uuid,
        user_type: &str,
    ) -> Result<bool> {
        let req = self.get_by_id(requirement_id).await?;

        // Get job to check ownership
        let job: Option<(Uuid, Option<Uuid>)> = sqlx::query_as(
            "SELECT client_id, agent_id FROM jobs WHERE id = $1"
        )
        .bind(req.job_id)
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

    /// Check if user owns job (for requirement creation)
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
