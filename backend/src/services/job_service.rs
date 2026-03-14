use crate::error::{AppError, Result};
use crate::models::{
    CreateJob, Job, JobListQuery, JobListResponse, JobStatus, JobWithDetails, UpdateJob,
};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Clone)]
pub struct JobService {
    db: PgPool,
}

impl JobService {
    pub fn new(db: PgPool) -> Self {
        Self { db }
    }

    pub async fn create(&self, client_id: Uuid, input: CreateJob) -> Result<Job> {
        let id = Uuid::new_v4();
        let skills_json = serde_json::to_value(&input.required_skills)
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let job = sqlx::query_as::<_, Job>(
            r#"
            INSERT INTO jobs (
                id, client_id, title, description, task_type, required_skills,
                complexity, budget_min, budget_max, deadline, bid_deadline, urgency, status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'draft')
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(client_id)
        .bind(&input.title)
        .bind(&input.description)
        .bind(&input.task_type)
        .bind(&skills_json)
        .bind(input.complexity.unwrap_or_else(|| "moderate".to_string()))
        .bind(input.budget_min)
        .bind(input.budget_max)
        .bind(input.deadline)
        .bind(input.bid_deadline)
        .bind(input.urgency.unwrap_or_else(|| "standard".to_string()))
        .fetch_one(&self.db)
        .await?;

        Ok(job)
    }

    pub async fn get(&self, id: Uuid) -> Result<Job> {
        sqlx::query_as::<_, Job>("SELECT * FROM jobs WHERE id = $1")
            .bind(id)
            .fetch_optional(&self.db)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Job {} not found", id)))
    }

    pub async fn get_with_details(&self, id: Uuid) -> Result<JobWithDetails> {
        // Fetch job first
        let job = self.get(id).await?;

        // Fetch client name
        let client_name: (String,) = sqlx::query_as(
            "SELECT display_name FROM users WHERE id = $1"
        )
        .bind(job.client_id)
        .fetch_one(&self.db)
        .await?;

        // Fetch agent name if assigned
        let agent_name: Option<String> = if let Some(agent_id) = job.agent_id {
            let result: Option<(String,)> = sqlx::query_as(
                "SELECT display_name FROM agents WHERE id = $1"
            )
            .bind(agent_id)
            .fetch_optional(&self.db)
            .await?;
            result.map(|r| r.0)
        } else {
            None
        };

        // Count bids
        let bid_count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM bids WHERE job_id = $1 AND status != 'withdrawn'"
        )
        .bind(id)
        .fetch_one(&self.db)
        .await?;

        Ok(JobWithDetails {
            job,
            client_name: client_name.0,
            agent_name,
            bid_count: bid_count.0,
        })
    }

    pub async fn list(&self, query: JobListQuery) -> Result<JobListResponse> {
        let page = query.page.unwrap_or(1).max(1);
        let limit = query.limit.unwrap_or(20).min(100);
        let offset = ((page - 1) * limit) as i64;
        let limit_i64 = limit as i64;

        // Simplified query - fetch jobs with basic filters
        let jobs: Vec<Job> = if let Some(status) = &query.status {
            sqlx::query_as::<_, Job>(
                r#"
                SELECT * FROM jobs
                WHERE status = $1
                ORDER BY created_at DESC
                LIMIT $2 OFFSET $3
                "#
            )
            .bind(status)
            .bind(limit_i64)
            .bind(offset)
            .fetch_all(&self.db)
            .await?
        } else {
            sqlx::query_as::<_, Job>(
                r#"
                SELECT * FROM jobs
                ORDER BY created_at DESC
                LIMIT $1 OFFSET $2
                "#
            )
            .bind(limit_i64)
            .bind(offset)
            .fetch_all(&self.db)
            .await?
        };

        let total: (i64,) = if let Some(status) = &query.status {
            sqlx::query_as("SELECT COUNT(*) FROM jobs WHERE status = $1")
                .bind(status)
                .fetch_one(&self.db)
                .await?
        } else {
            sqlx::query_as("SELECT COUNT(*) FROM jobs")
                .fetch_one(&self.db)
                .await?
        };

        // Fetch details for each job
        let mut jobs_with_details = Vec::new();
        for job in jobs {
            let client_name: (String,) = sqlx::query_as(
                "SELECT display_name FROM users WHERE id = $1"
            )
            .bind(job.client_id)
            .fetch_one(&self.db)
            .await?;

            let agent_name: Option<String> = if let Some(agent_id) = job.agent_id {
                let result: Option<(String,)> = sqlx::query_as(
                    "SELECT display_name FROM agents WHERE id = $1"
                )
                .bind(agent_id)
                .fetch_optional(&self.db)
                .await?;
                result.map(|r| r.0)
            } else {
                None
            };

            let bid_count: (i64,) = sqlx::query_as(
                "SELECT COUNT(*) FROM bids WHERE job_id = $1 AND status != 'withdrawn'"
            )
            .bind(job.id)
            .fetch_one(&self.db)
            .await?;

            jobs_with_details.push(JobWithDetails {
                job,
                client_name: client_name.0,
                agent_name,
                bid_count: bid_count.0,
            });
        }

        Ok(JobListResponse {
            jobs: jobs_with_details,
            total: total.0,
            page,
            limit,
        })
    }

    pub async fn update(&self, id: Uuid, client_id: Uuid, input: UpdateJob) -> Result<Job> {
        let job = self.get(id).await?;

        // Only allow updates on draft jobs
        if job.status != "draft" {
            return Err(AppError::BadRequest(
                "Can only update jobs in draft status".to_string(),
            ));
        }

        // Verify ownership
        if job.client_id != client_id {
            return Err(AppError::Forbidden("Not authorized to update this job".to_string()));
        }

        let updated = sqlx::query_as::<_, Job>(
            r#"
            UPDATE jobs SET
                title = COALESCE($2, title),
                description = COALESCE($3, description),
                task_type = COALESCE($4, task_type),
                required_skills = COALESCE($5, required_skills),
                complexity = COALESCE($6, complexity),
                budget_min = COALESCE($7, budget_min),
                budget_max = COALESCE($8, budget_max),
                deadline = COALESCE($9, deadline),
                bid_deadline = COALESCE($10, bid_deadline),
                urgency = COALESCE($11, urgency),
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(&input.title)
        .bind(&input.description)
        .bind(&input.task_type)
        .bind(input.required_skills.as_ref().map(|s| serde_json::to_value(s).ok()).flatten())
        .bind(&input.complexity)
        .bind(input.budget_min)
        .bind(input.budget_max)
        .bind(input.deadline)
        .bind(input.bid_deadline)
        .bind(&input.urgency)
        .fetch_one(&self.db)
        .await?;

        Ok(updated)
    }

    pub async fn transition_status(
        &self,
        id: Uuid,
        current_status: &str,
        new_status: JobStatus,
    ) -> Result<Job> {
        let current = JobStatus::from_str(current_status);

        if !current.can_transition_to(&new_status) {
            return Err(AppError::InvalidStateTransition(format!(
                "Cannot transition from {} to {}",
                current_status,
                new_status.as_str()
            )));
        }

        // Set appropriate timestamp based on new status
        let timestamp_column = match new_status {
            JobStatus::Open => "published_at",
            JobStatus::InProgress => "started_at",
            JobStatus::Delivered => "delivered_at",
            JobStatus::Completed => "completed_at",
            _ => "",
        };

        let query = if !timestamp_column.is_empty() {
            format!(
                "UPDATE jobs SET status = $2, {} = NOW(), updated_at = NOW() WHERE id = $1 AND status = $3 RETURNING *",
                timestamp_column
            )
        } else {
            "UPDATE jobs SET status = $2, updated_at = NOW() WHERE id = $1 AND status = $3 RETURNING *".to_string()
        };

        let job = sqlx::query_as::<_, Job>(&query)
            .bind(id)
            .bind(new_status.as_str())
            .bind(current_status)
            .fetch_optional(&self.db)
            .await?
            .ok_or_else(|| {
                AppError::Conflict("Job status has changed, please retry".to_string())
            })?;

        Ok(job)
    }

    pub async fn assign_agent(&self, job_id: Uuid, agent_id: Uuid, price: f64) -> Result<Job> {
        let job = sqlx::query_as::<_, Job>(
            r#"
            UPDATE jobs SET
                agent_id = $2,
                final_price = $3,
                status = 'assigned',
                updated_at = NOW()
            WHERE id = $1 AND status = 'bidding'
            RETURNING *
            "#,
        )
        .bind(job_id)
        .bind(agent_id)
        .bind(price)
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| AppError::Conflict("Job is not in bidding status".to_string()))?;

        Ok(job)
    }
}
