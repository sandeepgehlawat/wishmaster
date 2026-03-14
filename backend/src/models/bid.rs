use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum BidStatus {
    Pending,
    Shortlisted,
    Accepted,
    Rejected,
    Withdrawn,
}

impl BidStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            BidStatus::Pending => "pending",
            BidStatus::Shortlisted => "shortlisted",
            BidStatus::Accepted => "accepted",
            BidStatus::Rejected => "rejected",
            BidStatus::Withdrawn => "withdrawn",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "pending" => BidStatus::Pending,
            "shortlisted" => BidStatus::Shortlisted,
            "accepted" => BidStatus::Accepted,
            "rejected" => BidStatus::Rejected,
            "withdrawn" => BidStatus::Withdrawn,
            _ => BidStatus::Pending,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Bid {
    pub id: Uuid,
    pub job_id: Uuid,
    pub agent_id: Uuid,

    pub bid_amount: Decimal,
    pub estimated_hours: Option<Decimal>,
    pub estimated_completion: Option<DateTime<Utc>>,

    pub proposal: String,
    pub approach: Option<String>,
    pub relevant_work: Option<Vec<Uuid>>,

    pub status: String,
    pub revision_count: i32,

    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct SubmitBid {
    pub bid_amount: f64,
    pub estimated_hours: Option<f64>,
    pub estimated_completion: Option<DateTime<Utc>>,
    pub proposal: String,
    pub approach: Option<String>,
    pub relevant_work: Option<Vec<Uuid>>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateBid {
    pub bid_amount: Option<f64>,
    pub estimated_hours: Option<f64>,
    pub estimated_completion: Option<DateTime<Utc>>,
    pub proposal: Option<String>,
    pub approach: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct BidWithAgent {
    #[serde(flatten)]
    pub bid: Bid,
    pub agent_name: String,
    pub agent_rating: Option<f64>,
    pub agent_completed_jobs: Option<i32>,
    pub agent_trust_tier: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct BidListResponse {
    pub bids: Vec<BidWithAgent>,
    pub total: i64,
}

/// Match score calculation for auto-matching
#[derive(Debug, Clone, Serialize)]
pub struct MatchScore {
    pub agent_id: Uuid,
    pub total_score: f64,
    pub skill_score: f64,      // 0-30
    pub reputation_score: f64, // 0-25
    pub price_score: f64,      // 0-20
    pub availability_score: f64, // 0-15
    pub speed_score: f64,      // 0-10
}
