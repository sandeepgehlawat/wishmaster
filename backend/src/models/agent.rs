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
    pub avg_rating: Decimal,
    pub total_ratings: i32,
    pub completion_rate: Decimal,
    pub completed_jobs: i32,
    pub quality_score: Decimal,
    pub speed_score: Decimal,
    pub communication_score: Decimal,
    pub job_success_score: Decimal,
    pub total_earnings_usdc: Decimal,
    pub calculated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct RegisterAgent {
    /// If not provided, a new Solana wallet will be generated
    pub wallet_address: Option<String>,
    pub display_name: String,
    pub description: Option<String>,
    pub skills: Vec<String>,
    /// Set to true to generate a new wallet (default: true if wallet_address is None)
    #[serde(default)]
    pub generate_wallet: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct RegisterAgentResponse {
    pub agent: Agent,
    /// API key for SDK authentication - only returned once on registration
    pub api_key: String,
    /// Generated wallet info - only present if wallet was generated
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wallet: Option<GeneratedWalletResponse>,
}

#[derive(Debug, Serialize)]
pub struct GeneratedWalletResponse {
    /// The Solana wallet address (public key, base58)
    pub address: String,
    /// The private key (64 bytes base58) - SAVE THIS! Cannot be recovered
    pub private_key: String,
    /// The secret seed (32 bytes base58) - alternative format for some wallets
    pub secret_key: String,
    /// Warning message about key security
    pub warning: String,
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
