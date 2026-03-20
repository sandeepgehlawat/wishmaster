use crate::error::{AppError, Result};
use crate::models::{
    CreateJob, Job, JobListQuery, JobListResponse, JobStatus, JobWithDetails, JobWithDetailsRow, UpdateJob,
};
use sqlx::PgPool;
use uuid::Uuid;

// Explicit column list for Job queries (avoids SELECT * issues with schema changes)
// Updated for agent-to-agent work: includes creator_type and agent_creator_id
const JOB_COLUMNS: &str = "id, client_id, agent_id, creator_type, agent_creator_id, title, description, task_type, required_skills, complexity, budget_min, budget_max, final_price, pricing_model, deadline, bid_deadline, urgency, status, created_at, published_at, started_at, delivered_at, completed_at, sandbox_url, sandbox_project_id";

#[derive(Clone)]
pub struct JobService {
    db: PgPool,
}

impl JobService {
    pub fn new(db: PgPool) -> Self {
        Self { db }
    }

    /// Create a job as a human client
    pub async fn create(&self, client_id: Uuid, input: CreateJob) -> Result<Job> {
        let id = Uuid::new_v4();
        let skills_json = serde_json::to_value(&input.required_skills)
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let job = sqlx::query_as::<_, Job>(
            &format!(r#"
            INSERT INTO jobs (
                id, client_id, creator_type, title, description, task_type, required_skills,
                complexity, budget_min, budget_max, deadline, bid_deadline, urgency, status
            )
            VALUES ($1, $2, 'client', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'draft')
            RETURNING {}
            "#, JOB_COLUMNS),
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

    /// Create a job as an agent (agent-to-agent work)
    pub async fn create_by_agent(&self, agent_creator_id: Uuid, input: CreateJob) -> Result<Job> {
        let id = Uuid::new_v4();
        let skills_json = serde_json::to_value(&input.required_skills)
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let job = sqlx::query_as::<_, Job>(
            &format!(r#"
            INSERT INTO jobs (
                id, agent_creator_id, creator_type, title, description, task_type, required_skills,
                complexity, budget_min, budget_max, deadline, bid_deadline, urgency, status
            )
            VALUES ($1, $2, 'agent', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'draft')
            RETURNING {}
            "#, JOB_COLUMNS),
        )
        .bind(id)
        .bind(agent_creator_id)
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

    /// Check if caller owns this job (works for both client and agent creators)
    pub fn is_owner(&self, job: &Job, caller_id: Uuid, caller_type: &str) -> bool {
        match caller_type {
            "client" => job.client_id == Some(caller_id),
            "agent" => job.agent_creator_id == Some(caller_id),
            _ => false,
        }
    }

    pub async fn get(&self, id: Uuid) -> Result<Job> {
        sqlx::query_as::<_, Job>(&format!("SELECT {} FROM jobs WHERE id = $1", JOB_COLUMNS))
            .bind(id)
            .fetch_optional(&self.db)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Job {} not found", id)))
    }

    pub async fn get_with_details(&self, id: Uuid) -> Result<JobWithDetails> {
        // Single optimized query with JOINs (avoids N+1)
        // Handles both client-created and agent-created jobs
        let row = sqlx::query_as::<_, JobWithDetailsRow>(
            r#"
            SELECT
                j.*,
                u.display_name as client_name,
                ac.display_name as agent_creator_name,
                COALESCE(u.display_name, ac.display_name, 'Unknown') as creator_name,
                a.display_name as agent_name,
                COALESCE(b.bid_count, 0) as bid_count,
                e.status as escrow_status,
                e.amount_usdc as escrow_amount
            FROM jobs j
            LEFT JOIN users u ON u.id = j.client_id
            LEFT JOIN agents ac ON ac.id = j.agent_creator_id
            LEFT JOIN agents a ON a.id = j.agent_id
            LEFT JOIN (
                SELECT job_id, COUNT(*) as bid_count
                FROM bids
                WHERE status != 'withdrawn'
                GROUP BY job_id
            ) b ON b.job_id = j.id
            LEFT JOIN escrows e ON e.job_id = j.id
            WHERE j.id = $1
            "#
        )
        .bind(id)
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Job {} not found", id)))?;

        Ok(row.into())
    }

    /// List jobs created by a specific agent
    pub async fn list_by_agent_creator(&self, agent_creator_id: Uuid, query: JobListQuery) -> Result<JobListResponse> {
        let page = query.page.unwrap_or(1).max(1);
        let limit = query.limit.unwrap_or(20).min(100);
        let offset = ((page - 1) * limit) as i64;
        let limit_i64 = limit as i64;

        let base_select = r#"
            SELECT
                j.*,
                u.display_name as client_name,
                ac.display_name as agent_creator_name,
                COALESCE(u.display_name, ac.display_name, 'Unknown') as creator_name,
                a.display_name as agent_name,
                COALESCE(b.bid_count, 0) as bid_count,
                e.status as escrow_status,
                e.amount_usdc as escrow_amount
            FROM jobs j
            LEFT JOIN users u ON u.id = j.client_id
            LEFT JOIN agents ac ON ac.id = j.agent_creator_id
            LEFT JOIN agents a ON a.id = j.agent_id
            LEFT JOIN (
                SELECT job_id, COUNT(*) as bid_count
                FROM bids
                WHERE status != 'withdrawn'
                GROUP BY job_id
            ) b ON b.job_id = j.id
            LEFT JOIN escrows e ON e.job_id = j.id
        "#;

        let rows: Vec<JobWithDetailsRow> = if let Some(status) = &query.status {
            sqlx::query_as::<_, JobWithDetailsRow>(&format!(
                "{} WHERE j.agent_creator_id = $1 AND j.status = $2 ORDER BY j.created_at DESC LIMIT $3 OFFSET $4",
                base_select
            ))
            .bind(agent_creator_id)
            .bind(status)
            .bind(limit_i64)
            .bind(offset)
            .fetch_all(&self.db)
            .await?
        } else {
            sqlx::query_as::<_, JobWithDetailsRow>(&format!(
                "{} WHERE j.agent_creator_id = $1 ORDER BY j.created_at DESC LIMIT $2 OFFSET $3",
                base_select
            ))
            .bind(agent_creator_id)
            .bind(limit_i64)
            .bind(offset)
            .fetch_all(&self.db)
            .await?
        };

        let total: (i64,) = if let Some(status) = &query.status {
            sqlx::query_as("SELECT COUNT(*) FROM jobs WHERE agent_creator_id = $1 AND status = $2")
                .bind(agent_creator_id)
                .bind(status)
                .fetch_one(&self.db)
                .await?
        } else {
            sqlx::query_as("SELECT COUNT(*) FROM jobs WHERE agent_creator_id = $1")
                .bind(agent_creator_id)
                .fetch_one(&self.db)
                .await?
        };

        let jobs_with_details: Vec<JobWithDetails> = rows.into_iter().map(|r| r.into()).collect();

        Ok(JobListResponse {
            jobs: jobs_with_details,
            total: total.0,
            page,
            limit,
        })
    }

    /// List jobs for PUBLIC endpoint - excludes drafts and internal statuses
    /// SECURITY: Does not allow filtering by client_id to prevent data leakage
    /// OPTIMIZED: Uses JOINs to avoid N+1 queries
    /// UPDATED: Supports both client-created and agent-created jobs
    pub async fn list_public(&self, query: JobListQuery) -> Result<JobListResponse> {
        let page = query.page.unwrap_or(1).max(1);
        let limit = query.limit.unwrap_or(20).min(100);
        let offset = ((page - 1) * limit) as i64;
        let limit_i64 = limit as i64;

        // Public statuses only - no draft, publishing, approving, etc.
        let public_statuses = vec!["open", "bidding", "assigned", "in_progress", "delivered", "completed"];

        // Single optimized query with JOINs (avoids N+1)
        // Updated to handle both client and agent creators
        let rows: Vec<JobWithDetailsRow> = if let Some(status) = &query.status {
            // Only allow filtering to public statuses
            if !public_statuses.contains(&status.as_str()) {
                return Ok(JobListResponse { jobs: vec![], total: 0, page, limit });
            }
            sqlx::query_as::<_, JobWithDetailsRow>(
                r#"
                SELECT
                    j.*,
                    u.display_name as client_name,
                    ac.display_name as agent_creator_name,
                    COALESCE(u.display_name, ac.display_name, 'Unknown') as creator_name,
                    a.display_name as agent_name,
                    COALESCE(b.bid_count, 0) as bid_count,
                    e.status as escrow_status,
                    e.amount_usdc as escrow_amount
                FROM jobs j
                LEFT JOIN users u ON u.id = j.client_id
                LEFT JOIN agents ac ON ac.id = j.agent_creator_id
                LEFT JOIN agents a ON a.id = j.agent_id
                LEFT JOIN (
                    SELECT job_id, COUNT(*) as bid_count
                    FROM bids
                    WHERE status != 'withdrawn'
                    GROUP BY job_id
                ) b ON b.job_id = j.id
                LEFT JOIN escrows e ON e.job_id = j.id
                WHERE j.status = $1
                ORDER BY j.created_at DESC
                LIMIT $2 OFFSET $3
                "#
            )
            .bind(status)
            .bind(limit_i64)
            .bind(offset)
            .fetch_all(&self.db)
            .await?
        } else {
            // Default: show all public jobs
            sqlx::query_as::<_, JobWithDetailsRow>(
                r#"
                SELECT
                    j.*,
                    u.display_name as client_name,
                    ac.display_name as agent_creator_name,
                    COALESCE(u.display_name, ac.display_name, 'Unknown') as creator_name,
                    a.display_name as agent_name,
                    COALESCE(b.bid_count, 0) as bid_count,
                    e.status as escrow_status,
                    e.amount_usdc as escrow_amount
                FROM jobs j
                LEFT JOIN users u ON u.id = j.client_id
                LEFT JOIN agents ac ON ac.id = j.agent_creator_id
                LEFT JOIN agents a ON a.id = j.agent_id
                LEFT JOIN (
                    SELECT job_id, COUNT(*) as bid_count
                    FROM bids
                    WHERE status != 'withdrawn'
                    GROUP BY job_id
                ) b ON b.job_id = j.id
                LEFT JOIN escrows e ON e.job_id = j.id
                WHERE j.status IN ('open', 'bidding', 'assigned', 'in_progress', 'delivered', 'completed')
                ORDER BY j.created_at DESC
                LIMIT $1 OFFSET $2
                "#
            )
            .bind(limit_i64)
            .bind(offset)
            .fetch_all(&self.db)
            .await?
        };

        let total: (i64,) = if let Some(status) = &query.status {
            if !public_statuses.contains(&status.as_str()) {
                return Ok(JobListResponse { jobs: vec![], total: 0, page, limit });
            }
            sqlx::query_as("SELECT COUNT(*) FROM jobs WHERE status = $1")
                .bind(status)
                .fetch_one(&self.db)
                .await?
        } else {
            sqlx::query_as("SELECT COUNT(*) FROM jobs WHERE status IN ('open', 'bidding', 'assigned', 'in_progress', 'delivered', 'completed')")
                .fetch_one(&self.db)
                .await?
        };

        // Convert rows to JobWithDetails
        let jobs_with_details: Vec<JobWithDetails> = rows.into_iter().map(|r| r.into()).collect();

        Ok(JobListResponse {
            jobs: jobs_with_details,
            total: total.0,
            page,
            limit,
        })
    }

    /// List jobs for AUTHENTICATED users - allows filtering by client_id
    /// OPTIMIZED: Uses JOINs to avoid N+1 queries
    /// UPDATED: Supports both client-created and agent-created jobs
    pub async fn list(&self, query: JobListQuery) -> Result<JobListResponse> {
        let page = query.page.unwrap_or(1).max(1);
        let limit = query.limit.unwrap_or(20).min(100);
        let offset = ((page - 1) * limit) as i64;
        let limit_i64 = limit as i64;

        // Base query with JOINs for all related data
        // Updated to handle both client and agent creators
        let base_select = r#"
            SELECT
                j.*,
                u.display_name as client_name,
                ac.display_name as agent_creator_name,
                COALESCE(u.display_name, ac.display_name, 'Unknown') as creator_name,
                a.display_name as agent_name,
                COALESCE(b.bid_count, 0) as bid_count,
                e.status as escrow_status,
                e.amount_usdc as escrow_amount
            FROM jobs j
            LEFT JOIN users u ON u.id = j.client_id
            LEFT JOIN agents ac ON ac.id = j.agent_creator_id
            LEFT JOIN agents a ON a.id = j.agent_id
            LEFT JOIN (
                SELECT job_id, COUNT(*) as bid_count
                FROM bids
                WHERE status != 'withdrawn'
                GROUP BY job_id
            ) b ON b.job_id = j.id
            LEFT JOIN escrows e ON e.job_id = j.id
        "#;

        // Build dynamic query based on filters (single optimized query)
        let rows: Vec<JobWithDetailsRow> = match (&query.status, &query.client_id) {
            (Some(status), Some(client_id)) => {
                sqlx::query_as::<_, JobWithDetailsRow>(&format!(
                    "{} WHERE j.status = $1 AND j.client_id = $2 ORDER BY j.created_at DESC LIMIT $3 OFFSET $4",
                    base_select
                ))
                .bind(status)
                .bind(client_id)
                .bind(limit_i64)
                .bind(offset)
                .fetch_all(&self.db)
                .await?
            }
            (Some(status), None) => {
                sqlx::query_as::<_, JobWithDetailsRow>(&format!(
                    "{} WHERE j.status = $1 ORDER BY j.created_at DESC LIMIT $2 OFFSET $3",
                    base_select
                ))
                .bind(status)
                .bind(limit_i64)
                .bind(offset)
                .fetch_all(&self.db)
                .await?
            }
            (None, Some(client_id)) => {
                sqlx::query_as::<_, JobWithDetailsRow>(&format!(
                    "{} WHERE j.client_id = $1 ORDER BY j.created_at DESC LIMIT $2 OFFSET $3",
                    base_select
                ))
                .bind(client_id)
                .bind(limit_i64)
                .bind(offset)
                .fetch_all(&self.db)
                .await?
            }
            (None, None) => {
                sqlx::query_as::<_, JobWithDetailsRow>(&format!(
                    "{} ORDER BY j.created_at DESC LIMIT $1 OFFSET $2",
                    base_select
                ))
                .bind(limit_i64)
                .bind(offset)
                .fetch_all(&self.db)
                .await?
            }
        };

        let total: (i64,) = match (&query.status, &query.client_id) {
            (Some(status), Some(client_id)) => {
                sqlx::query_as("SELECT COUNT(*) FROM jobs WHERE status = $1 AND client_id = $2")
                    .bind(status)
                    .bind(client_id)
                    .fetch_one(&self.db)
                    .await?
            }
            (Some(status), None) => {
                sqlx::query_as("SELECT COUNT(*) FROM jobs WHERE status = $1")
                    .bind(status)
                    .fetch_one(&self.db)
                    .await?
            }
            (None, Some(client_id)) => {
                sqlx::query_as("SELECT COUNT(*) FROM jobs WHERE client_id = $1")
                    .bind(client_id)
                    .fetch_one(&self.db)
                    .await?
            }
            (None, None) => {
                sqlx::query_as("SELECT COUNT(*) FROM jobs")
                    .fetch_one(&self.db)
                    .await?
            }
        };

        // Convert rows to JobWithDetails
        let jobs_with_details: Vec<JobWithDetails> = rows.into_iter().map(|r| r.into()).collect();

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
        if job.client_id != Some(client_id) {
            return Err(AppError::Forbidden("Not authorized to update this job".to_string()));
        }

        let updated = sqlx::query_as::<_, Job>(
            &format!(r#"
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
                urgency = COALESCE($11, urgency)
            WHERE id = $1
            RETURNING {}
            "#, JOB_COLUMNS),
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
                "UPDATE jobs SET status = $2, {} = NOW() WHERE id = $1 AND status = $3 RETURNING {}",
                timestamp_column, JOB_COLUMNS
            )
        } else {
            format!("UPDATE jobs SET status = $2 WHERE id = $1 AND status = $3 RETURNING {}", JOB_COLUMNS)
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
            &format!(r#"
            UPDATE jobs SET
                agent_id = $2,
                final_price = $3,
                status = 'assigned',
                started_at = NOW()
            WHERE id = $1 AND status = 'bidding'
            RETURNING {}
            "#, JOB_COLUMNS),
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
