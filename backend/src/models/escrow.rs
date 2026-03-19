use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EscrowStatus {
    Created,
    Funded,
    Locked,
    Released,
    Refunded,
    Disputed,
}

impl EscrowStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            EscrowStatus::Created => "created",
            EscrowStatus::Funded => "funded",
            EscrowStatus::Locked => "locked",
            EscrowStatus::Released => "released",
            EscrowStatus::Refunded => "refunded",
            EscrowStatus::Disputed => "disputed",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "created" => EscrowStatus::Created,
            "funded" => EscrowStatus::Funded,
            "locked" => EscrowStatus::Locked,
            "released" => EscrowStatus::Released,
            "refunded" => EscrowStatus::Refunded,
            "disputed" => EscrowStatus::Disputed,
            _ => EscrowStatus::Created,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Escrow {
    pub id: Uuid,
    pub job_id: Uuid,

    pub escrow_pda: String,

    pub client_wallet: String,
    pub agent_wallet: Option<String>,

    pub amount_usdc: Decimal,
    pub platform_fee_usdc: Option<Decimal>,
    pub agent_payout_usdc: Option<Decimal>,

    pub status: String,

    pub created_at: DateTime<Utc>,
    pub funded_at: Option<DateTime<Utc>>,
    pub released_at: Option<DateTime<Utc>>,

    pub create_tx: Option<String>,
    pub fund_tx: Option<String>,
    pub release_tx: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct EscrowDetails {
    #[serde(flatten)]
    pub escrow: Escrow,
    pub job_title: String,
    pub client_name: String,
    pub agent_name: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct FundTransactionResponse {
    /// Base64 encoded transaction for client to sign
    pub transaction: String,
    pub escrow_pda: String,
    pub amount_usdc: f64,
}

#[derive(Debug, Deserialize)]
pub struct FundConfirmation {
    /// Signature of the confirmed transaction
    pub signature: String,
}

#[derive(Debug, Serialize)]
pub struct ReleaseResult {
    pub signature: String,
    pub agent_payout: f64,
    pub platform_fee: f64,
}
