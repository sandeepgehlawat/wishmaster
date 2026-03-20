use crate::error::{Result, SdkError};
use crate::types::*;
use crate::AgentConfig;
use reqwest::{Client, StatusCode};
use serde::de::DeserializeOwned;
use std::time::Duration;
use uuid::Uuid;

/// Main client for interacting with WishMaster
pub struct AgentClient {
    config: AgentConfig,
    http: Client,
}

impl std::fmt::Debug for AgentClient {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("AgentClient")
            .field("config", &self.config)
            .finish()
    }
}

impl AgentClient {
    /// Create a new agent client
    pub fn new(config: AgentConfig) -> Result<Self> {
        if config.api_key.is_empty() {
            return Err(SdkError::Config("API key is required".to_string()));
        }

        let http = Client::builder()
            .timeout(Duration::from_secs(config.timeout_secs))
            .build()
            .map_err(SdkError::Http)?;

        Ok(Self { config, http })
    }

    /// List available jobs
    pub async fn list_jobs(&self, query: Option<JobListQuery>) -> Result<Vec<JobWithDetails>> {
        let query = query.unwrap_or_default();
        let response: JobListResponse = self
            .get(&format!("/api/jobs?{}", serde_urlencoded::to_string(&query).unwrap_or_default()))
            .await?;
        Ok(response.jobs)
    }

    /// Get job details
    pub async fn get_job(&self, job_id: Uuid) -> Result<JobWithDetails> {
        self.get(&format!("/api/jobs/{}", job_id)).await
    }

    /// Submit a bid on a job
    pub async fn submit_bid(&self, job_id: Uuid, bid: SubmitBidRequest) -> Result<Bid> {
        self.post(&format!("/api/jobs/{}/bids", job_id), &bid).await
    }

    /// Update an existing bid
    pub async fn update_bid(&self, bid_id: Uuid, bid: SubmitBidRequest) -> Result<Bid> {
        self.patch(&format!("/api/bids/{}", bid_id), &bid).await
    }

    /// Withdraw a bid
    pub async fn withdraw_bid(&self, bid_id: Uuid) -> Result<Bid> {
        self.delete(&format!("/api/bids/{}", bid_id)).await
    }

    /// Claim a job and start sandbox execution
    pub async fn claim_job(&self, job_id: Uuid) -> Result<SandboxSession> {
        self.post("/api/sandbox/claim", &serde_json::json!({ "job_id": job_id }))
            .await
    }

    /// Stream data file from sandbox
    pub async fn get_data(&self, file_path: &str) -> Result<Vec<u8>> {
        let url = format!("{}/api/sandbox/data/{}", self.config.base_url, file_path);
        let response = self
            .http
            .get(&url)
            .header("X-API-Key", &self.config.api_key)
            .send()
            .await
            .map_err(SdkError::Http)?;

        if !response.status().is_success() {
            return Err(SdkError::Api {
                status: response.status().as_u16(),
                message: response.text().await.unwrap_or_default(),
            });
        }

        response.bytes().await.map(|b| b.to_vec()).map_err(SdkError::Http)
    }

    /// Report progress
    pub async fn report_progress(&self, update: ProgressUpdate) -> Result<()> {
        self.post::<_, serde_json::Value>("/api/sandbox/progress", &update)
            .await?;
        Ok(())
    }

    /// Submit results
    pub async fn submit_results(&self, results: JobResults) -> Result<()> {
        self.post::<_, serde_json::Value>("/api/sandbox/submit", &results)
            .await?;
        Ok(())
    }

    /// Send heartbeat
    pub async fn heartbeat(&self, job_id: Uuid) -> Result<()> {
        self.post::<_, serde_json::Value>(
            "/api/sandbox/heartbeat",
            &serde_json::json!({ "job_id": job_id }),
        )
        .await?;
        Ok(())
    }

    /// Get agent reputation
    pub async fn get_reputation(&self, agent_id: Uuid) -> Result<AgentReputation> {
        self.get(&format!("/api/agents/{}/reputation", agent_id)).await
    }

    // HTTP helpers
    async fn get<T: DeserializeOwned>(&self, path: &str) -> Result<T> {
        let url = format!("{}{}", self.config.base_url, path);
        let response = self
            .http
            .get(&url)
            .header("X-API-Key", &self.config.api_key)
            .send()
            .await
            .map_err(SdkError::Http)?;

        self.handle_response(response).await
    }

    async fn post<B: serde::Serialize, T: DeserializeOwned>(
        &self,
        path: &str,
        body: &B,
    ) -> Result<T> {
        let url = format!("{}{}", self.config.base_url, path);
        let response = self
            .http
            .post(&url)
            .header("X-API-Key", &self.config.api_key)
            .json(body)
            .send()
            .await
            .map_err(SdkError::Http)?;

        self.handle_response(response).await
    }

    async fn patch<B: serde::Serialize, T: DeserializeOwned>(
        &self,
        path: &str,
        body: &B,
    ) -> Result<T> {
        let url = format!("{}{}", self.config.base_url, path);
        let response = self
            .http
            .patch(&url)
            .header("X-API-Key", &self.config.api_key)
            .json(body)
            .send()
            .await
            .map_err(SdkError::Http)?;

        self.handle_response(response).await
    }

    async fn delete<T: DeserializeOwned>(&self, path: &str) -> Result<T> {
        let url = format!("{}{}", self.config.base_url, path);
        let response = self
            .http
            .delete(&url)
            .header("X-API-Key", &self.config.api_key)
            .send()
            .await
            .map_err(SdkError::Http)?;

        self.handle_response(response).await
    }

    async fn handle_response<T: DeserializeOwned>(
        &self,
        response: reqwest::Response,
    ) -> Result<T> {
        let status = response.status();

        if status == StatusCode::NOT_FOUND {
            return Err(SdkError::NotFound("Resource not found".to_string()));
        }

        if status == StatusCode::UNAUTHORIZED {
            return Err(SdkError::Auth("Invalid API key".to_string()));
        }

        if !status.is_success() {
            let message = response.text().await.unwrap_or_default();
            return Err(SdkError::Api {
                status: status.as_u16(),
                message,
            });
        }

        response.json().await.map_err(|e| SdkError::Serialization(
            serde_json::Error::io(std::io::Error::new(std::io::ErrorKind::InvalidData, e))
        ))
    }
}

#[derive(Debug, serde::Deserialize)]
#[allow(dead_code)]
struct JobListResponse {
    jobs: Vec<JobWithDetails>,
    total: i64,
    page: i64,
    limit: i64,
}
