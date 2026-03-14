use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum JobStatus {
    Draft,
    Open,
    Bidding,
    Assigned,
    InProgress,
    Delivered,
    Revision,
    Completed,
    Disputed,
    Cancelled,
    Expired,
}

impl JobStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            JobStatus::Draft => "draft",
            JobStatus::Open => "open",
            JobStatus::Bidding => "bidding",
            JobStatus::Assigned => "assigned",
            JobStatus::InProgress => "in_progress",
            JobStatus::Delivered => "delivered",
            JobStatus::Revision => "revision",
            JobStatus::Completed => "completed",
            JobStatus::Disputed => "disputed",
            JobStatus::Cancelled => "cancelled",
            JobStatus::Expired => "expired",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "draft" => JobStatus::Draft,
            "open" => JobStatus::Open,
            "bidding" => JobStatus::Bidding,
            "assigned" => JobStatus::Assigned,
            "in_progress" => JobStatus::InProgress,
            "delivered" => JobStatus::Delivered,
            "revision" => JobStatus::Revision,
            "completed" => JobStatus::Completed,
            "disputed" => JobStatus::Disputed,
            "cancelled" => JobStatus::Cancelled,
            "expired" => JobStatus::Expired,
            _ => JobStatus::Draft,
        }
    }

    /// Returns valid next states from current state
    pub fn valid_transitions(&self) -> Vec<JobStatus> {
        match self {
            JobStatus::Draft => vec![JobStatus::Open],
            JobStatus::Open => vec![JobStatus::Bidding, JobStatus::Expired, JobStatus::Cancelled],
            JobStatus::Bidding => vec![JobStatus::Assigned, JobStatus::Cancelled],
            JobStatus::Assigned => vec![JobStatus::InProgress, JobStatus::Cancelled],
            JobStatus::InProgress => vec![JobStatus::Delivered, JobStatus::Cancelled],
            JobStatus::Delivered => vec![JobStatus::Completed, JobStatus::Revision, JobStatus::Disputed],
            JobStatus::Revision => vec![JobStatus::Delivered, JobStatus::Disputed],
            JobStatus::Disputed => vec![JobStatus::Completed], // Via resolution
            JobStatus::Completed | JobStatus::Cancelled | JobStatus::Expired => vec![],
        }
    }

    pub fn can_transition_to(&self, next: &JobStatus) -> bool {
        self.valid_transitions().contains(next)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TaskType {
    Coding,
    Research,
    Content,
    Data,
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Complexity {
    Simple,
    Moderate,
    Complex,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Urgency {
    Standard,
    Rush,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Job {
    pub id: Uuid,
    pub client_id: Uuid,
    pub agent_id: Option<Uuid>,

    pub title: String,
    pub description: String,
    pub task_type: String,
    pub required_skills: serde_json::Value,
    pub complexity: String,

    pub budget_min: Decimal,
    pub budget_max: Decimal,
    pub final_price: Option<Decimal>,
    pub pricing_model: String,

    pub deadline: Option<DateTime<Utc>>,
    pub bid_deadline: Option<DateTime<Utc>>,
    pub urgency: String,

    pub status: String,

    pub created_at: DateTime<Utc>,
    pub published_at: Option<DateTime<Utc>>,
    pub started_at: Option<DateTime<Utc>>,
    pub delivered_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct CreateJob {
    pub title: String,
    pub description: String,
    pub task_type: String,
    pub required_skills: Vec<String>,
    pub complexity: Option<String>,
    pub budget_min: f64,
    pub budget_max: f64,
    pub deadline: Option<DateTime<Utc>>,
    pub bid_deadline: Option<DateTime<Utc>>,
    pub urgency: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateJob {
    pub title: Option<String>,
    pub description: Option<String>,
    pub task_type: Option<String>,
    pub required_skills: Option<Vec<String>>,
    pub complexity: Option<String>,
    pub budget_min: Option<f64>,
    pub budget_max: Option<f64>,
    pub deadline: Option<DateTime<Utc>>,
    pub bid_deadline: Option<DateTime<Utc>>,
    pub urgency: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct JobListQuery {
    pub status: Option<String>,
    pub task_type: Option<String>,
    pub skills: Option<String>,
    pub min_budget: Option<f64>,
    pub max_budget: Option<f64>,
    pub search: Option<String>,
    pub client_id: Option<Uuid>,
    pub agent_id: Option<Uuid>,
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct JobListResponse {
    pub jobs: Vec<JobWithDetails>,
    pub total: i64,
    pub page: i64,
    pub limit: i64,
}

#[derive(Debug, Serialize)]
pub struct JobWithDetails {
    #[serde(flatten)]
    pub job: Job,
    pub client_name: String,
    pub agent_name: Option<String>,
    pub bid_count: i64,
}

#[derive(Debug, Deserialize)]
pub struct SelectBidRequest {
    pub bid_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct RevisionRequest {
    pub reason: String,
    pub details: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct DisputeRequest {
    pub reason: String,
    pub details: String,
}
