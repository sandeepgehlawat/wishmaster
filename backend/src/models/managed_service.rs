use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use rust_decimal::Decimal;
use uuid::Uuid;
use validator::Validate;

/// Custom validator for positive decimal values
fn validate_positive_decimal(value: &Decimal) -> Result<(), validator::ValidationError> {
    if *value <= Decimal::ZERO {
        let mut err = validator::ValidationError::new("positive_value");
        err.message = Some(std::borrow::Cow::Borrowed("Value must be greater than 0"));
        return Err(err);
    }
    if *value > Decimal::new(1_000_000_000, 0) {
        let mut err = validator::ValidationError::new("max_value");
        err.message = Some(std::borrow::Cow::Borrowed("Value exceeds maximum allowed"));
        return Err(err);
    }
    Ok(())
}

// ========== Managed Service ==========

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ServiceStatus {
    Pending,
    Active,
    Paused,
    Cancelled,
}

impl Default for ServiceStatus {
    fn default() -> Self {
        Self::Pending
    }
}

impl std::fmt::Display for ServiceStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Pending => write!(f, "pending"),
            Self::Active => write!(f, "active"),
            Self::Paused => write!(f, "paused"),
            Self::Cancelled => write!(f, "cancelled"),
        }
    }
}

impl TryFrom<&str> for ServiceStatus {
    type Error = String;
    fn try_from(s: &str) -> Result<Self, Self::Error> {
        match s {
            "pending" => Ok(Self::Pending),
            "active" => Ok(Self::Active),
            "paused" => Ok(Self::Paused),
            "cancelled" => Ok(Self::Cancelled),
            _ => Err(format!("Invalid status: {}", s)),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ManagedService {
    pub id: Uuid,
    pub original_job_id: Uuid,
    pub client_id: Uuid,
    pub agent_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub monthly_rate_usd: Decimal,
    pub status: String,
    pub started_at: Option<DateTime<Utc>>,
    pub next_billing_at: Option<DateTime<Utc>>,
    pub paused_at: Option<DateTime<Utc>>,
    pub cancelled_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct ManagedServiceWithDetails {
    // Service fields
    pub id: Uuid,
    pub original_job_id: Uuid,
    pub client_id: Uuid,
    pub agent_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub monthly_rate_usd: Decimal,
    pub status: String,
    pub started_at: Option<DateTime<Utc>>,
    pub next_billing_at: Option<DateTime<Utc>>,
    pub paused_at: Option<DateTime<Utc>>,
    pub cancelled_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    // Joined fields
    pub client_name: String,
    pub agent_name: String,
    pub job_title: String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateManagedService {
    #[validate(length(min = 1, max = 255, message = "Name must be 1-255 characters"))]
    pub name: String,
    #[validate(length(max = 5000, message = "Description must be under 5000 characters"))]
    pub description: Option<String>,
    #[validate(custom(function = "validate_positive_decimal", message = "Monthly rate must be positive"))]
    pub monthly_rate_usd: Decimal,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateManagedService {
    #[validate(length(min = 1, max = 255, message = "Name must be 1-255 characters"))]
    pub name: Option<String>,
    #[validate(length(max = 5000, message = "Description must be under 5000 characters"))]
    pub description: Option<String>,
    // Note: monthly_rate_usd validation happens in service layer since it's Optional
    pub monthly_rate_usd: Option<Decimal>,
}

#[derive(Debug, Serialize)]
pub struct ServiceListResponse {
    pub services: Vec<ManagedServiceWithDetails>,
    pub total: i64,
}

// ========== Service Update ==========

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum UpdateChangeType {
    Feature,
    Fix,
    Upgrade,
    Security,
    Other,
}

impl std::fmt::Display for UpdateChangeType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Feature => write!(f, "feature"),
            Self::Fix => write!(f, "fix"),
            Self::Upgrade => write!(f, "upgrade"),
            Self::Security => write!(f, "security"),
            Self::Other => write!(f, "other"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum UpdateStatus {
    Pending,
    Approved,
    Rejected,
    Deployed,
}

impl Default for UpdateStatus {
    fn default() -> Self {
        Self::Pending
    }
}

impl std::fmt::Display for UpdateStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Pending => write!(f, "pending"),
            Self::Approved => write!(f, "approved"),
            Self::Rejected => write!(f, "rejected"),
            Self::Deployed => write!(f, "deployed"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ServiceUpdate {
    pub id: Uuid,
    pub service_id: Uuid,
    pub agent_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub change_type: Option<String>,
    pub status: String,
    pub file_url: Option<String>,
    pub file_name: Option<String>,
    pub client_feedback: Option<String>,
    pub created_at: DateTime<Utc>,
    pub reviewed_at: Option<DateTime<Utc>>,
    pub deployed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateServiceUpdate {
    #[validate(length(min = 1, max = 255, message = "Title must be 1-255 characters"))]
    pub title: String,
    #[validate(length(max = 10000, message = "Description must be under 10000 characters"))]
    pub description: Option<String>,
    pub change_type: Option<String>,
    #[validate(url(message = "Invalid file URL"))]
    pub file_url: Option<String>,
    #[validate(length(max = 255, message = "File name must be under 255 characters"))]
    pub file_name: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RejectServiceUpdate {
    pub feedback: String,
}

#[derive(Debug, Serialize)]
pub struct ServiceUpdateListResponse {
    pub updates: Vec<ServiceUpdate>,
    pub total: i64,
    pub pending: i64,
}

// ========== Service Billing ==========

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum BillingStatus {
    Pending,
    Paid,
    Failed,
    Refunded,
}

impl Default for BillingStatus {
    fn default() -> Self {
        Self::Pending
    }
}

impl std::fmt::Display for BillingStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Pending => write!(f, "pending"),
            Self::Paid => write!(f, "paid"),
            Self::Failed => write!(f, "failed"),
            Self::Refunded => write!(f, "refunded"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ServiceBilling {
    pub id: Uuid,
    pub service_id: Uuid,
    pub period_start: DateTime<Utc>,
    pub period_end: DateTime<Utc>,
    pub amount_usd: Decimal,
    pub status: String,
    pub escrow_pda: Option<String>,
    pub payment_tx: Option<String>,
    pub paid_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct BillingListResponse {
    pub records: Vec<ServiceBilling>,
    pub total: i64,
    pub total_paid_usd: Decimal,
}
