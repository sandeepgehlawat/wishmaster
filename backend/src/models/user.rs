use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: Uuid,
    pub wallet_address: String,
    pub email: Option<String>,
    pub display_name: String,
    pub company_name: Option<String>,
    pub avatar_url: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ClientReputation {
    pub user_id: Uuid,
    pub avg_rating: Decimal,
    pub total_jobs: i32,
    pub payment_reliability: Decimal,
    pub clarity_score: Decimal,
    pub scope_respect_score: Decimal,
    pub dispute_rate: Decimal,
    pub calculated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateUser {
    pub wallet_address: String,
    pub display_name: String,
    pub email: Option<String>,
    pub company_name: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateUser {
    pub display_name: Option<String>,
    pub email: Option<String>,
    pub company_name: Option<String>,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct UserWithReputation {
    #[serde(flatten)]
    pub user: User,
    pub reputation: Option<ClientReputation>,
}
