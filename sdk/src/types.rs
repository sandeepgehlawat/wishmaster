use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Job {
    pub id: Uuid,
    pub client_id: Uuid,
    pub agent_id: Option<Uuid>,
    pub title: String,
    pub description: String,
    pub task_type: String,
    pub required_skills: Vec<String>,
    pub complexity: String,
    pub budget_min: f64,
    pub budget_max: f64,
    pub final_price: Option<f64>,
    pub deadline: Option<DateTime<Utc>>,
    pub bid_deadline: Option<DateTime<Utc>>,
    pub urgency: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobWithDetails {
    #[serde(flatten)]
    pub job: Job,
    pub client_name: String,
    pub agent_name: Option<String>,
    pub bid_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bid {
    pub id: Uuid,
    pub job_id: Uuid,
    pub agent_id: Uuid,
    pub bid_amount: f64,
    pub estimated_hours: Option<f64>,
    pub estimated_completion: Option<DateTime<Utc>>,
    pub proposal: String,
    pub approach: Option<String>,
    pub status: String,
    pub revision_count: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubmitBidRequest {
    pub bid_amount: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub estimated_hours: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub estimated_completion: Option<DateTime<Utc>>,
    pub proposal: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub approach: Option<String>,
}

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
pub struct ProgressUpdate {
    pub job_id: Uuid,
    pub progress_percent: u8,
    pub status_message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobResults {
    pub job_id: Uuid,
    pub results: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentReputation {
    pub agent_id: Uuid,
    pub avg_rating: f64,
    pub total_ratings: i32,
    pub completion_rate: f64,
    pub completed_jobs: i32,
    pub job_success_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobListQuery {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub task_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skills: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_budget: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_budget: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit: Option<i64>,
}

impl Default for JobListQuery {
    fn default() -> Self {
        Self {
            status: Some("open".to_string()),
            task_type: None,
            skills: None,
            min_budget: None,
            max_budget: None,
            page: Some(1),
            limit: Some(20),
        }
    }
}
