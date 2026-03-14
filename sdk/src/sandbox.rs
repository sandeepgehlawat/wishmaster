use crate::error::Result;
use crate::types::*;
use crate::AgentClient;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

/// Sandbox execution context
pub struct SandboxContext {
    client: Arc<AgentClient>,
    session: SandboxSession,
    progress: RwLock<u8>,
}

impl SandboxContext {
    /// Create a new sandbox context
    pub fn new(client: Arc<AgentClient>, session: SandboxSession) -> Self {
        Self {
            client,
            session,
            progress: RwLock::new(0),
        }
    }

    /// Get the job ID
    pub fn job_id(&self) -> Uuid {
        self.session.job_id
    }

    /// Get the session token
    pub fn token(&self) -> &str {
        &self.session.token
    }

    /// Read data file
    pub async fn read_file(&self, path: &str) -> Result<Vec<u8>> {
        self.client.get_data(path).await
    }

    /// Read data file as string
    pub async fn read_file_string(&self, path: &str) -> Result<String> {
        let bytes = self.read_file(path).await?;
        Ok(String::from_utf8_lossy(&bytes).to_string())
    }

    /// Read data file as JSON
    pub async fn read_file_json<T: serde::de::DeserializeOwned>(&self, path: &str) -> Result<T> {
        let bytes = self.read_file(path).await?;
        serde_json::from_slice(&bytes).map_err(crate::error::SdkError::Serialization)
    }

    /// Update progress (0-100)
    pub async fn update_progress(&self, percent: u8, message: &str) -> Result<()> {
        let percent = percent.min(100);
        *self.progress.write().await = percent;

        self.client
            .report_progress(ProgressUpdate {
                job_id: self.session.job_id,
                progress_percent: percent,
                status_message: message.to_string(),
            })
            .await
    }

    /// Submit results and complete the job
    pub async fn submit(&self, results: serde_json::Value) -> Result<()> {
        self.update_progress(100, "Submitting results").await?;

        self.client
            .submit_results(JobResults {
                job_id: self.session.job_id,
                results,
            })
            .await
    }

    /// Send heartbeat to keep session alive
    pub async fn heartbeat(&self) -> Result<()> {
        self.client.heartbeat(self.session.job_id).await
    }

    /// Get current progress
    pub async fn current_progress(&self) -> u8 {
        *self.progress.read().await
    }
}

/// Builder for sandbox execution
pub struct SandboxExecutor {
    client: Arc<AgentClient>,
}

impl SandboxExecutor {
    pub fn new(client: AgentClient) -> Self {
        Self {
            client: Arc::new(client),
        }
    }

    /// Claim job and create execution context
    pub async fn claim(&self, job_id: Uuid) -> Result<SandboxContext> {
        let session = self.client.claim_job(job_id).await?;
        Ok(SandboxContext::new(self.client.clone(), session))
    }
}

/// Start a heartbeat loop in the background
pub fn start_heartbeat(ctx: Arc<SandboxContext>, interval_secs: u64) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(interval_secs));

        loop {
            interval.tick().await;
            if let Err(e) = ctx.heartbeat().await {
                tracing::warn!("Heartbeat failed: {}", e);
                break;
            }
        }
    })
}
