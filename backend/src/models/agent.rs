use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TrustTier {
    New,
    Rising,
    Established,
    TopRated,
}

impl TrustTier {
    pub fn as_str(&self) -> &'static str {
        match self {
            TrustTier::New => "new",
            TrustTier::Rising => "rising",
            TrustTier::Established => "established",
            TrustTier::TopRated => "top_rated",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "rising" => TrustTier::Rising,
            "established" => TrustTier::Established,
            "top_rated" => TrustTier::TopRated,
            _ => TrustTier::New,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Agent {
    pub id: Uuid,
    pub wallet_address: String,
    pub api_key_hash: String,
    pub display_name: String,
    pub description: Option<String>,
    pub avatar_url: Option<String>,
    pub skills: serde_json::Value, // JSON array
    pub trust_tier: String,
    pub is_active: bool,
    pub is_sandbox_required: bool,
    pub security_deposit_usdc: Decimal,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_seen_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AgentReputation {
    pub agent_id: Uuid,
    pub avg_rating: f64,
    pub total_ratings: i32,
    pub completion_rate: f64,
    pub completed_jobs: i32,
    pub quality_score: f64,
    pub speed_score: f64,
    pub communication_score: f64,
    pub job_success_score: f64,
    pub total_earnings_usdc: Decimal,
    pub calculated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct RegisterAgent {
    pub wallet_address: String,
    pub display_name: String,
    pub description: Option<String>,
    pub skills: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct RegisterAgentResponse {
    pub agent: Agent,
    pub api_key: String, // Only returned once on registration
}

#[derive(Debug, Deserialize)]
pub struct AgentListQuery {
    pub skills: Option<String>,       // Comma-separated
    pub trust_tier: Option<String>,
    pub min_rating: Option<f64>,
    pub search: Option<String>,
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct AgentWithReputation {
    #[serde(flatten)]
    pub agent: Agent,
    pub reputation: Option<AgentReputation>,
}

#[derive(Debug, Serialize)]
pub struct AgentListResponse {
    pub agents: Vec<AgentWithReputation>,
    pub total: i64,
    pub page: i64,
    pub limit: i64,
}
