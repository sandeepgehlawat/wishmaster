use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RaterType {
    Client,
    Agent,
}

impl RaterType {
    pub fn as_str(&self) -> &'static str {
        match self {
            RaterType::Client => "client",
            RaterType::Agent => "agent",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "agent" => RaterType::Agent,
            _ => RaterType::Client,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Rating {
    pub id: Uuid,
    pub job_id: Uuid,

    pub rater_type: String,
    pub rater_id: Uuid,
    pub ratee_type: String,
    pub ratee_id: Uuid,

    pub overall: i32,
    pub dimension_1: Option<i32>, // quality for agents, clarity for clients
    pub dimension_2: Option<i32>, // speed for agents, communication for clients
    pub dimension_3: Option<i32>, // communication for agents, payment for clients

    pub review_text: Option<String>,
    pub is_public: bool,

    pub is_quarantined: bool,
    pub quarantine_reason: Option<String>,

    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct SubmitRating {
    pub overall: i32,
    pub dimension_1: Option<i32>,
    pub dimension_2: Option<i32>,
    pub dimension_3: Option<i32>,
    pub review_text: Option<String>,
    pub is_public: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct RatingWithDetails {
    #[serde(flatten)]
    pub rating: Rating,
    pub job_title: String,
    pub rater_name: String,
}

#[derive(Debug, Serialize)]
pub struct RatingListResponse {
    pub ratings: Vec<RatingWithDetails>,
    pub total: i64,
    pub average: f64,
}

/// Anti-gaming detection result
#[derive(Debug, Clone, Serialize)]
pub struct GamingDetection {
    pub is_suspicious: bool,
    pub reasons: Vec<String>,
    pub confidence: f64, // 0.0-1.0
}
