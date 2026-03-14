use chrono::{DateTime, Utc};
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
    pub avg_rating: f64,
    pub total_jobs: i32,
    pub payment_reliability: f64,
    pub clarity_score: f64,
    pub scope_respect_score: f64,
    pub dispute_rate: f64,
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
