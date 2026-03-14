use crate::config::Config;
use crate::error::{AppError, Result};
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxSession {
    pub job_id: Uuid,
    pub agent_id: Uuid,
    pub token: String,
    pub started_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub container_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobProgress {
    pub job_id: Uuid,
    pub progress_percent: u8,
    pub status_message: String,
    pub updated_at: DateTime<Utc>,
}

#[derive(Clone)]
pub struct SandboxService {
    db: PgPool,
    config: Config,
}

impl SandboxService {
    pub fn new(db: PgPool, config: Config) -> Self {
        Self { db, config }
    }

    /// Claim a job and start sandbox execution
    pub async fn claim_job(&self, job_id: Uuid, agent_id: Uuid) -> Result<SandboxSession> {
        // Verify agent is assigned to this job
        let job: (Uuid, String) = sqlx::query_as(
            "SELECT agent_id, status FROM jobs WHERE id = $1"
        )
        .bind(job_id)
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Job not found".to_string()))?;

        if job.0 != agent_id {
            return Err(AppError::Forbidden("You are not assigned to this job".to_string()));
        }

        if job.1 != "assigned" {
            return Err(AppError::BadRequest(format!(
                "Job is in {} state, expected 'assigned'",
                job.1
            )));
        }

        // Generate ephemeral access token
        let token = generate_sandbox_token();
        let now = Utc::now();
        let expires_at = now + Duration::hours(24); // 24h max session

        // Transition job to in_progress
        sqlx::query(
            "UPDATE jobs SET status = 'in_progress', started_at = NOW() WHERE id = $1"
        )
        .bind(job_id)
        .execute(&self.db)
        .await?;

        // Log audit entry
        self.log_audit(agent_id, job_id, "sandbox_claimed", None).await?;

        // In production, this would:
        // 1. Create Kubernetes pod with gVisor runtime
        // 2. Configure network policies
        // 3. Mount FUSE filesystem for data streaming
        let container_id = format!("sandbox-{}-{}", job_id, agent_id);

        Ok(SandboxSession {
            job_id,
            agent_id,
            token,
            started_at: now,
            expires_at,
            container_id: Some(container_id),
        })
    }

    /// Stream data file to agent (proxied through platform)
    pub async fn stream_data(
        &self,
        job_id: Uuid,
        agent_id: Uuid,
        file_path: &str,
    ) -> Result<Vec<u8>> {
        // Verify agent is executing this job
        let job_status: String = sqlx::query_scalar(
            "SELECT status FROM jobs WHERE id = $1 AND agent_id = $2"
        )
        .bind(job_id)
        .bind(agent_id)
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| AppError::Forbidden("Not authorized".to_string()))?;

        if job_status != "in_progress" {
            return Err(AppError::BadRequest("Job is not in progress".to_string()));
        }

        // Log data access for audit
        self.log_audit(
            agent_id,
            job_id,
            "data_access",
            Some(serde_json::json!({ "file": file_path })),
        ).await?;

        // In production, this would:
        // 1. Fetch from S3/secure storage
        // 2. Stream in chunks
        // 3. Never expose direct URLs

        // Placeholder: return mock data
        Ok(format!("Mock data for file: {}", file_path).into_bytes())
    }

    /// Report progress update
    pub async fn report_progress(
        &self,
        job_id: Uuid,
        agent_id: Uuid,
        progress_percent: u8,
        status_message: &str,
    ) -> Result<()> {
        // Verify ownership
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM jobs WHERE id = $1 AND agent_id = $2 AND status = 'in_progress')"
        )
        .bind(job_id)
        .bind(agent_id)
        .fetch_one(&self.db)
        .await?;

        if !exists {
            return Err(AppError::Forbidden("Not authorized".to_string()));
        }

        // In production, would publish to WebSocket/Redis pub-sub
        tracing::info!(
            "Job {} progress: {}% - {}",
            job_id,
            progress_percent,
            status_message
        );

        Ok(())
    }

    /// Submit job results
    pub async fn submit_results(
        &self,
        job_id: Uuid,
        agent_id: Uuid,
        results: serde_json::Value,
    ) -> Result<()> {
        // Verify ownership and status
        let job: (Uuid, String) = sqlx::query_as(
            "SELECT agent_id, status FROM jobs WHERE id = $1"
        )
        .bind(job_id)
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Job not found".to_string()))?;

        if job.0 != agent_id {
            return Err(AppError::Forbidden("Not authorized".to_string()));
        }

        if job.1 != "in_progress" && job.1 != "revision" {
            return Err(AppError::BadRequest(format!(
                "Cannot submit results for job in {} status",
                job.1
            )));
        }

        // Store results (in production: S3)
        // For now, just log and transition status
        tracing::info!("Job {} results submitted: {:?}", job_id, results);

        // Transition to delivered
        sqlx::query(
            "UPDATE jobs SET status = 'delivered', delivered_at = NOW() WHERE id = $1"
        )
        .bind(job_id)
        .execute(&self.db)
        .await?;

        // Log audit
        self.log_audit(agent_id, job_id, "results_submitted", None).await?;

        // In production, would:
        // 1. Destroy sandbox container
        // 2. Revoke data access token
        // 3. Purge temporary data

        Ok(())
    }

    /// Heartbeat to keep session alive
    pub async fn heartbeat(&self, job_id: Uuid, agent_id: Uuid) -> Result<()> {
        // Verify active session
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM jobs WHERE id = $1 AND agent_id = $2 AND status = 'in_progress')"
        )
        .bind(job_id)
        .bind(agent_id)
        .fetch_one(&self.db)
        .await?;

        if !exists {
            return Err(AppError::NotFound("No active session".to_string()));
        }

        // Update last_seen on agent
        sqlx::query("UPDATE agents SET last_seen_at = NOW() WHERE id = $1")
            .bind(agent_id)
            .execute(&self.db)
            .await?;

        Ok(())
    }

    /// Log audit entry
    async fn log_audit(
        &self,
        agent_id: Uuid,
        job_id: Uuid,
        action: &str,
        metadata: Option<serde_json::Value>,
    ) -> Result<()> {
        sqlx::query(
            r#"
            INSERT INTO audit_log (agent_id, job_id, action, metadata)
            VALUES ($1, $2, $3, $4)
            "#,
        )
        .bind(agent_id)
        .bind(job_id)
        .bind(action)
        .bind(metadata)
        .execute(&self.db)
        .await?;

        Ok(())
    }
}

fn generate_sandbox_token() -> String {
    use rand::Rng;
    let bytes: [u8; 32] = rand::thread_rng().gen();
    format!("sbox_{}", hex::encode(bytes))
}
