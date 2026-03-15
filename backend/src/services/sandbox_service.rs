use crate::config::Config;
use crate::error::{AppError, Result};
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobData {
    pub files: Vec<JobFile>,
    pub metadata: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobFile {
    pub path: String,
    pub size: u64,
    pub content_type: String,
}

/// In-memory progress store (in production: Redis)
type ProgressStore = Arc<RwLock<HashMap<Uuid, JobProgress>>>;

/// In-memory results store (in production: S3)
type ResultsStore = Arc<RwLock<HashMap<Uuid, serde_json::Value>>>;

#[derive(Clone)]
pub struct SandboxService {
    db: PgPool,
    config: Config,
    progress_store: ProgressStore,
    results_store: ResultsStore,
    redis_client: Option<redis::Client>,
}

impl SandboxService {
    pub fn new(db: PgPool, config: Config) -> Self {
        let redis_client = config.redis_url.as_ref().and_then(|url| {
            redis::Client::open(url.as_str()).ok()
        });

        Self {
            db,
            config,
            progress_store: Arc::new(RwLock::new(HashMap::new())),
            results_store: Arc::new(RwLock::new(HashMap::new())),
            redis_client,
        }
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
        let expires_at = now + Duration::hours(24);

        // Transition job to in_progress
        sqlx::query(
            "UPDATE jobs SET status = 'in_progress', started_at = NOW() WHERE id = $1"
        )
        .bind(job_id)
        .execute(&self.db)
        .await?;

        // Log audit entry
        self.log_audit(agent_id, job_id, "sandbox_claimed", None).await?;

        // Create container ID (in production: Docker/K8s API)
        let container_id = self.create_sandbox_container(job_id, agent_id).await?;

        // Initialize progress tracking
        let progress = JobProgress {
            job_id,
            progress_percent: 0,
            status_message: "Started".to_string(),
            updated_at: now,
        };
        self.progress_store.write().await.insert(job_id, progress.clone());

        // Publish start event
        self.publish_progress_event(job_id, &progress).await?;

        Ok(SandboxSession {
            job_id,
            agent_id,
            token,
            started_at: now,
            expires_at,
            container_id: Some(container_id),
        })
    }

    /// Create sandbox container (Docker/K8s integration point)
    async fn create_sandbox_container(&self, job_id: Uuid, agent_id: Uuid) -> Result<String> {
        let container_id = format!("sandbox-{}-{}", job_id, agent_id);

        // In production with Docker:
        // ```
        // docker run -d \
        //   --name $container_id \
        //   --runtime=runsc \
        //   --network=sandbox-net \
        //   --memory=4g \
        //   --cpus=2 \
        //   --read-only \
        //   --tmpfs /tmp:size=2G \
        //   -e JOB_ID=$job_id \
        //   -e AGENT_ID=$agent_id \
        //   agenthive/sandbox:latest
        // ```

        // In production with Kubernetes:
        // Create pod spec with gVisor runtime, network policies, etc.

        tracing::info!(
            "Created sandbox container {} for job {} agent {}",
            container_id,
            job_id,
            agent_id
        );

        Ok(container_id)
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

        // Fetch from storage (in production: S3, Azure Blob, etc.)
        let data = self.fetch_job_data(job_id, file_path).await?;

        Ok(data)
    }

    /// Fetch data from storage backend
    async fn fetch_job_data(&self, job_id: Uuid, file_path: &str) -> Result<Vec<u8>> {
        // Check if data exists in database (small files)
        let stored_data: Option<(Vec<u8>,)> = sqlx::query_as(
            r#"
            SELECT data FROM job_files
            WHERE job_id = $1 AND file_path = $2
            "#,
        )
        .bind(job_id)
        .bind(file_path)
        .fetch_optional(&self.db)
        .await?;

        if let Some((data,)) = stored_data {
            return Ok(data);
        }

        // In production with S3:
        // let s3_key = format!("jobs/{}/{}", job_id, file_path);
        // let response = s3_client.get_object()
        //     .bucket(&self.config.s3_bucket)
        //     .key(&s3_key)
        //     .send()
        //     .await?;
        // let data = response.body.collect().await?.to_vec();

        // For development, return placeholder
        Ok(format!("Data for job {} file: {}", job_id, file_path).into_bytes())
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

        let progress = JobProgress {
            job_id,
            progress_percent: progress_percent.min(100),
            status_message: status_message.to_string(),
            updated_at: Utc::now(),
        };

        // Store progress
        self.progress_store.write().await.insert(job_id, progress.clone());

        // Publish to Redis for real-time updates
        self.publish_progress_event(job_id, &progress).await?;

        tracing::info!(
            "Job {} progress: {}% - {}",
            job_id,
            progress_percent,
            status_message
        );

        Ok(())
    }

    /// Publish progress event via Redis pub/sub
    async fn publish_progress_event(&self, job_id: Uuid, progress: &JobProgress) -> Result<()> {
        if let Some(ref client) = self.redis_client {
            if let Ok(mut conn) = client.get_connection() {
                let channel = format!("job:{}:progress", job_id);
                let payload = serde_json::to_string(progress).unwrap_or_default();

                let _: std::result::Result<(), _> = redis::cmd("PUBLISH")
                    .arg(&channel)
                    .arg(&payload)
                    .query(&mut conn);
            }
        }
        Ok(())
    }

    /// Get current progress for a job
    pub async fn get_progress(&self, job_id: Uuid) -> Option<JobProgress> {
        self.progress_store.read().await.get(&job_id).cloned()
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

        // Store results
        self.store_results(job_id, &results).await?;

        // Transition to delivered
        sqlx::query(
            "UPDATE jobs SET status = 'delivered', delivered_at = NOW() WHERE id = $1"
        )
        .bind(job_id)
        .execute(&self.db)
        .await?;

        // Log audit
        self.log_audit(agent_id, job_id, "results_submitted", None).await?;

        // Cleanup sandbox
        self.cleanup_sandbox(job_id, agent_id).await?;

        // Update progress to 100%
        let final_progress = JobProgress {
            job_id,
            progress_percent: 100,
            status_message: "Completed".to_string(),
            updated_at: Utc::now(),
        };
        self.progress_store.write().await.insert(job_id, final_progress.clone());
        self.publish_progress_event(job_id, &final_progress).await?;

        Ok(())
    }

    /// Store results (in production: S3)
    async fn store_results(&self, job_id: Uuid, results: &serde_json::Value) -> Result<()> {
        // Store in memory for now
        self.results_store.write().await.insert(job_id, results.clone());

        // Also store in database for persistence
        sqlx::query(
            r#"
            INSERT INTO job_results (job_id, results, created_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (job_id) DO UPDATE SET results = $2, created_at = NOW()
            "#,
        )
        .bind(job_id)
        .bind(results)
        .execute(&self.db)
        .await?;

        // In production with S3:
        // let s3_key = format!("results/{}/output.json", job_id);
        // s3_client.put_object()
        //     .bucket(&self.config.s3_bucket)
        //     .key(&s3_key)
        //     .body(serde_json::to_vec(results)?.into())
        //     .send()
        //     .await?;

        tracing::info!("Stored results for job {}", job_id);
        Ok(())
    }

    /// Get stored results
    pub async fn get_results(&self, job_id: Uuid) -> Result<Option<serde_json::Value>> {
        // Try memory first
        if let Some(results) = self.results_store.read().await.get(&job_id) {
            return Ok(Some(results.clone()));
        }

        // Fall back to database
        let stored: Option<(serde_json::Value,)> = sqlx::query_as(
            "SELECT results FROM job_results WHERE job_id = $1"
        )
        .bind(job_id)
        .fetch_optional(&self.db)
        .await?;

        Ok(stored.map(|(r,)| r))
    }

    /// Cleanup sandbox after job completion
    async fn cleanup_sandbox(&self, job_id: Uuid, agent_id: Uuid) -> Result<()> {
        let container_id = format!("sandbox-{}-{}", job_id, agent_id);

        // In production with Docker:
        // docker stop $container_id && docker rm $container_id

        // In production with Kubernetes:
        // kubectl delete pod $container_id

        // Clear progress from memory
        self.progress_store.write().await.remove(&job_id);

        tracing::info!("Cleaned up sandbox {} for job {}", container_id, job_id);
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

    /// List available data files for a job
    pub async fn list_job_files(&self, job_id: Uuid) -> Result<Vec<JobFile>> {
        let files: Vec<(String, i64, String)> = sqlx::query_as(
            r#"
            SELECT file_path, file_size, content_type
            FROM job_files
            WHERE job_id = $1
            "#,
        )
        .bind(job_id)
        .fetch_all(&self.db)
        .await?;

        Ok(files.into_iter().map(|(path, size, content_type)| JobFile {
            path,
            size: size as u64,
            content_type,
        }).collect())
    }
}

fn generate_sandbox_token() -> String {
    use rand::Rng;
    let bytes: [u8; 32] = rand::thread_rng().gen();
    format!("sbox_{}", hex::encode(bytes))
}
