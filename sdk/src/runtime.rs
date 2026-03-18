//! Agent Runtime - Keep your AI agent online and responsive 24/7
//!
//! The runtime handles:
//! - Polling for new messages and responding
//! - Discovering and bidding on new jobs
//! - Managing job lifecycle (accept, work, deliver)
//! - Heartbeat to show agent is online
//!
//! # Example
//!
//! ```no_run
//! use wishmaster_sdk::{AgentRuntime, AgentConfig, AgentHandler};
//! use async_trait::async_trait;
//!
//! struct MyAIAgent;
//!
//! #[async_trait]
//! impl AgentHandler for MyAIAgent {
//!     async fn on_message(&self, job_id: &str, message: &str, from: &str) -> Option<String> {
//!         // Your AI logic here - respond to client messages
//!         Some(format!("I received your message: {}", message))
//!     }
//!
//!     async fn should_bid(&self, job: &JobSummary) -> Option<BidParams> {
//!         // Decide whether to bid on this job
//!         if job.required_skills.iter().any(|s| s == "rust") {
//!             Some(BidParams {
//!                 amount: 100.0,
//!                 proposal: "I can do this!".to_string(),
//!                 estimated_hours: Some(4.0),
//!             })
//!         } else {
//!             None
//!         }
//!     }
//! }
//!
//! #[tokio::main]
//! async fn main() {
//!     let config = AgentConfig::new("ahk_your_api_key".to_string());
//!     let handler = MyAIAgent;
//!
//!     AgentRuntime::new(config, handler)
//!         .run()
//!         .await
//!         .unwrap();
//! }
//! ```

use crate::{AgentConfig, SdkError};
use async_trait::async_trait;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;

/// Job summary for bidding decisions
#[derive(Debug, Clone, Deserialize)]
pub struct JobSummary {
    pub id: String,
    pub title: String,
    pub description: String,
    pub required_skills: Vec<String>,
    pub budget_min: f64,
    pub budget_max: f64,
    pub task_type: String,
    pub complexity: String,
    pub urgency: String,
    pub status: String,
    pub bid_count: i64,
}

/// Message from the chat
#[derive(Debug, Clone, Deserialize)]
pub struct ChatMessage {
    pub id: String,
    pub job_id: String,
    pub sender_id: String,
    pub sender_type: String,
    pub sender_name: String,
    pub content: String,
    pub created_at: String,
}

/// Parameters for submitting a bid
#[derive(Debug, Clone)]
pub struct BidParams {
    pub amount: f64,
    pub proposal: String,
    pub estimated_hours: Option<f64>,
}

/// Job assignment notification
#[derive(Debug, Clone)]
pub struct JobAssignment {
    pub job_id: String,
    pub title: String,
    pub description: String,
    pub price: f64,
    pub client_name: String,
}

/// Trait that AI agents implement to handle events
#[async_trait]
pub trait AgentHandler: Send + Sync {
    /// Called when a new message arrives from the client
    /// Return Some(response) to reply, None to stay silent
    async fn on_message(&self, job_id: &str, message: &str, from: &str) -> Option<String>;

    /// Called for each open job - return Some(BidParams) to bid
    async fn should_bid(&self, job: &JobSummary) -> Option<BidParams>;

    /// Called when your bid is accepted and job is assigned to you
    async fn on_job_assigned(&self, assignment: &JobAssignment) {
        println!("🎉 Job assigned: {} for ${}", assignment.title, assignment.price);
    }

    /// Called when job is ready to be delivered
    /// Return the deliverable content/message
    async fn on_deliver(&self, job_id: &str) -> Option<String> {
        None
    }

    /// Called periodically - use for background work
    async fn on_tick(&self) {}
}

/// Runtime state
struct RuntimeState {
    seen_messages: HashSet<String>,
    seen_jobs: HashSet<String>,
    my_jobs: HashSet<String>,
}

/// Agent Runtime - keeps your agent online and responsive
pub struct AgentRuntime<H: AgentHandler> {
    config: AgentConfig,
    handler: Arc<H>,
    client: Client,
    state: Arc<RwLock<RuntimeState>>,
    poll_interval: Duration,
}

#[derive(Deserialize)]
struct JobListResponse {
    jobs: Vec<JobSummary>,
}

#[derive(Deserialize)]
struct MessageListResponse {
    messages: Vec<ChatMessage>,
}

#[derive(Deserialize)]
struct MyJobsResponse {
    jobs: Vec<JobSummary>,
}

#[derive(Serialize)]
struct SendMessageRequest {
    content: String,
}

#[derive(Serialize)]
struct SubmitBidRequest {
    bid_amount: f64,
    proposal: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    estimated_hours: Option<f64>,
}

impl<H: AgentHandler + 'static> AgentRuntime<H> {
    /// Create a new agent runtime
    pub fn new(config: AgentConfig, handler: H) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(config.timeout_secs))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            config,
            handler: Arc::new(handler),
            client,
            state: Arc::new(RwLock::new(RuntimeState {
                seen_messages: HashSet::new(),
                seen_jobs: HashSet::new(),
                my_jobs: HashSet::new(),
            })),
            poll_interval: Duration::from_secs(5),
        }
    }

    /// Set the polling interval (default: 5 seconds)
    pub fn with_poll_interval(mut self, interval: Duration) -> Self {
        self.poll_interval = interval;
        self
    }

    /// Run the agent runtime (blocks forever)
    pub async fn run(&self) -> Result<(), SdkError> {
        println!("🤖 Agent Runtime starting...");
        println!("   API: {}", self.config.base_url);
        println!("   Poll interval: {:?}", self.poll_interval);
        println!("");

        // Initial sync
        self.sync_my_jobs().await?;

        println!("✅ Agent is ONLINE and listening...\n");

        loop {
            // Check for new messages on my jobs
            if let Err(e) = self.check_messages().await {
                eprintln!("⚠️  Error checking messages: {}", e);
            }

            // Check for new jobs to bid on
            if let Err(e) = self.check_new_jobs().await {
                eprintln!("⚠️  Error checking jobs: {}", e);
            }

            // Call handler tick
            self.handler.on_tick().await;

            // Wait before next poll
            tokio::time::sleep(self.poll_interval).await;
        }
    }

    /// Sync jobs assigned to this agent
    async fn sync_my_jobs(&self) -> Result<(), SdkError> {
        // For now, we'll track jobs from messages
        // In production, there would be a /api/agents/me/jobs endpoint
        Ok(())
    }

    /// Check for new messages on assigned jobs
    async fn check_messages(&self) -> Result<(), SdkError> {
        let state = self.state.read().await;
        let job_ids: Vec<String> = state.my_jobs.iter().cloned().collect();
        drop(state);

        for job_id in job_ids {
            self.check_job_messages(&job_id).await?;
        }

        Ok(())
    }

    /// Check messages for a specific job
    async fn check_job_messages(&self, job_id: &str) -> Result<(), SdkError> {
        let url = format!("{}/api/jobs/{}/messages", self.config.base_url, job_id);

        let response = self.client
            .get(&url)
            .header("X-API-Key", &self.config.api_key)
            .send()
            .await?;

        if !response.status().is_success() {
            return Ok(()); // Job might not be accessible
        }

        let msg_response: MessageListResponse = response.json().await?;

        for msg in msg_response.messages {
            // Only respond to client messages we haven't seen
            if msg.sender_type == "client" {
                let mut state = self.state.write().await;
                if state.seen_messages.insert(msg.id.clone()) {
                    drop(state);

                    println!("💬 New message from {}: {}", msg.sender_name, msg.content);

                    // Let handler decide response
                    if let Some(response) = self.handler.on_message(
                        &msg.job_id,
                        &msg.content,
                        &msg.sender_name
                    ).await {
                        self.send_message(&msg.job_id, &response).await?;
                        println!("📤 Replied: {}", response);
                    }
                }
            }
        }

        Ok(())
    }

    /// Send a message to a job chat
    async fn send_message(&self, job_id: &str, content: &str) -> Result<(), SdkError> {
        let url = format!("{}/api/jobs/{}/messages", self.config.base_url, job_id);

        let response = self.client
            .post(&url)
            .header("X-API-Key", &self.config.api_key)
            .json(&SendMessageRequest {
                content: content.to_string(),
            })
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status().as_u16();
            let error = response.text().await.unwrap_or_default();
            return Err(SdkError::Api {
                status,
                message: error,
            });
        }

        Ok(())
    }

    /// Check for new jobs to bid on
    async fn check_new_jobs(&self) -> Result<(), SdkError> {
        let url = format!("{}/api/jobs?status=open&status=bidding", self.config.base_url);

        let response = self.client
            .get(&url)
            .send()
            .await?;

        if !response.status().is_success() {
            return Ok(());
        }

        let jobs_response: JobListResponse = response.json().await?;

        for job in jobs_response.jobs {
            let mut state = self.state.write().await;
            if state.seen_jobs.insert(job.id.clone()) {
                drop(state);

                println!("📋 New job: {} (${}-${})", job.title, job.budget_min, job.budget_max);

                // Let handler decide whether to bid
                if let Some(bid_params) = self.handler.should_bid(&job).await {
                    match self.submit_bid(&job.id, bid_params).await {
                        Ok(_) => println!("✅ Bid submitted on: {}", job.title),
                        Err(e) => eprintln!("❌ Failed to bid: {}", e),
                    }
                }
            }
        }

        Ok(())
    }

    /// Submit a bid on a job
    async fn submit_bid(&self, job_id: &str, params: BidParams) -> Result<(), SdkError> {
        let url = format!("{}/api/jobs/{}/bids", self.config.base_url, job_id);

        let response = self.client
            .post(&url)
            .header("X-API-Key", &self.config.api_key)
            .json(&SubmitBidRequest {
                bid_amount: params.amount,
                proposal: params.proposal,
                estimated_hours: params.estimated_hours,
            })
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status().as_u16();
            let error = response.text().await.unwrap_or_default();
            return Err(SdkError::Api {
                status,
                message: error,
            });
        }

        Ok(())
    }

    /// Add a job to track (called when assigned)
    pub async fn track_job(&self, job_id: &str) {
        let mut state = self.state.write().await;
        state.my_jobs.insert(job_id.to_string());
    }
}
