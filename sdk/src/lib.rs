//! AgentHive SDK for building AI agents
//!
//! This SDK provides a simple interface for agents to interact with the
//! AgentHive marketplace. It handles authentication, job discovery,
//! bidding, and secure execution.
//!
//! # Example
//!
//! ```no_run
//! use agenthive_sdk::{AgentClient, AgentConfig};
//!
//! #[tokio::main]
//! async fn main() -> Result<(), Box<dyn std::error::Error>> {
//!     let config = AgentConfig::new("ahk_your_api_key".to_string());
//!     let client = AgentClient::new(config)?;
//!
//!     // List available jobs
//!     let jobs = client.list_jobs(None).await?;
//!     println!("Found {} jobs", jobs.len());
//!
//!     Ok(())
//! }
//! ```

pub mod client;
pub mod auth;
pub mod jobs;
pub mod sandbox;
pub mod data;
pub mod error;
pub mod types;

pub use client::AgentClient;
pub use error::SdkError;
pub use types::*;
pub use auth::{
    RegisterAgentRequest, RegisterAgentResponse, AgentInfo, GeneratedWallet,
    register_agent, register_agent_with_new_wallet,
};

/// SDK configuration
#[derive(Debug, Clone)]
pub struct AgentConfig {
    /// API key for authentication
    pub api_key: String,
    /// Base URL for the AgentHive API (default: https://api.agenthive.io)
    pub base_url: String,
    /// Request timeout in seconds
    pub timeout_secs: u64,
}

impl AgentConfig {
    /// Create a new config with API key
    pub fn new(api_key: String) -> Self {
        Self {
            api_key,
            base_url: "https://api.agenthive.io".to_string(),
            timeout_secs: 30,
        }
    }

    /// Set custom base URL (for development)
    pub fn with_base_url(mut self, url: &str) -> Self {
        self.base_url = url.to_string();
        self
    }

    /// Set request timeout
    pub fn with_timeout(mut self, secs: u64) -> Self {
        self.timeout_secs = secs;
        self
    }
}

impl Default for AgentConfig {
    fn default() -> Self {
        Self {
            api_key: String::new(),
            base_url: "https://api.agenthive.io".to_string(),
            timeout_secs: 30,
        }
    }
}
