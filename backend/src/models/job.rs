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

/// Creator type for jobs - either a human client or an AI agent
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CreatorType {
    Client,
    Agent,
}

impl CreatorType {
    pub fn as_str(&self) -> &'static str {
        match self {
            CreatorType::Client => "client",
            CreatorType::Agent => "agent",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "agent" => CreatorType::Agent,
            _ => CreatorType::Client,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Job {
    pub id: Uuid,
    pub client_id: Option<Uuid>,  // Now optional for agent-created jobs
    pub agent_id: Option<Uuid>,

    // Creator tracking for agent-to-agent work
    pub creator_type: String,              // "client" or "agent"
    pub agent_creator_id: Option<Uuid>,    // If created by agent

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

    // StackBlitz sandbox fields
    pub sandbox_url: Option<String>,
    pub sandbox_project_id: Option<String>,
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
    pub agent_creator_id: Option<Uuid>,  // For agent-created jobs
    pub creator_type: Option<String>,     // Filter by "client" or "agent"
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
pub struct JobEscrowInfo {
    pub status: String,
    pub amount_usdc: rust_decimal::Decimal,
}

#[derive(Debug, Serialize)]
pub struct JobWithDetails {
    #[serde(flatten)]
    pub job: Job,
    pub client_name: Option<String>,      // Optional for agent-created jobs
    pub agent_creator_name: Option<String>, // Name of creating agent
    pub creator_name: String,             // Either client_name or agent_creator_name
    pub agent_name: Option<String>,
    pub bid_count: i64,
    pub escrow: Option<JobEscrowInfo>,
}

/// Flat row struct for efficient JOIN queries (avoids N+1)
#[derive(Debug, FromRow)]
pub struct JobWithDetailsRow {
    // Job fields
    pub id: Uuid,
    pub client_id: Option<Uuid>,           // Now optional
    pub agent_id: Option<Uuid>,
    // Creator tracking
    pub creator_type: String,
    pub agent_creator_id: Option<Uuid>,
    // Job details
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
    // StackBlitz sandbox fields
    pub sandbox_url: Option<String>,
    pub sandbox_project_id: Option<String>,
    // Joined fields
    pub client_name: Option<String>,       // Optional for agent-created jobs
    pub agent_creator_name: Option<String>, // Name of creating agent
    pub creator_name: String,              // Either client_name or agent_creator_name
    pub agent_name: Option<String>,
    pub bid_count: i64,
    // Escrow fields (from LEFT JOIN)
    pub escrow_status: Option<String>,
    pub escrow_amount: Option<Decimal>,
}

impl From<JobWithDetailsRow> for JobWithDetails {
    fn from(row: JobWithDetailsRow) -> Self {
        JobWithDetails {
            job: Job {
                id: row.id,
                client_id: row.client_id,
                agent_id: row.agent_id,
                creator_type: row.creator_type.clone(),
                agent_creator_id: row.agent_creator_id,
                title: row.title,
                description: row.description,
                task_type: row.task_type,
                required_skills: row.required_skills,
                complexity: row.complexity,
                budget_min: row.budget_min,
                budget_max: row.budget_max,
                final_price: row.final_price,
                pricing_model: row.pricing_model,
                deadline: row.deadline,
                bid_deadline: row.bid_deadline,
                urgency: row.urgency,
                status: row.status,
                created_at: row.created_at,
                published_at: row.published_at,
                started_at: row.started_at,
                delivered_at: row.delivered_at,
                completed_at: row.completed_at,
                sandbox_url: row.sandbox_url,
                sandbox_project_id: row.sandbox_project_id,
            },
            client_name: row.client_name,
            agent_creator_name: row.agent_creator_name,
            creator_name: row.creator_name,
            agent_name: row.agent_name,
            bid_count: row.bid_count,
            escrow: row.escrow_status.map(|status| JobEscrowInfo {
                status,
                amount_usdc: row.escrow_amount.unwrap_or_default(),
            }),
        }
    }
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
