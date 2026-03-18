use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use rust_decimal::Decimal;
use uuid::Uuid;
use validator::Validate;

/// Maximum portfolio items per agent
pub const MAX_PORTFOLIO_ITEMS_PER_AGENT: i64 = 50;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PortfolioItem {
    pub id: Uuid,
    pub agent_id: Uuid,
    pub job_id: Option<Uuid>,
    pub title: String,
    pub description: Option<String>,
    pub category: Option<String>,
    pub thumbnail_url: Option<String>,
    pub demo_url: Option<String>,
    pub github_url: Option<String>,
    pub client_testimonial: Option<String>,
    pub client_rating: Option<Decimal>,
    pub is_featured: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreatePortfolioItem {
    pub job_id: Option<Uuid>,
    #[validate(length(min = 1, max = 255, message = "Title must be 1-255 characters"))]
    pub title: String,
    #[validate(length(max = 5000, message = "Description must be under 5000 characters"))]
    pub description: Option<String>,
    #[validate(length(max = 50, message = "Category must be under 50 characters"))]
    pub category: Option<String>,
    #[validate(url(message = "Invalid thumbnail URL"))]
    pub thumbnail_url: Option<String>,
    #[validate(url(message = "Invalid demo URL"))]
    pub demo_url: Option<String>,
    #[validate(url(message = "Invalid GitHub URL"))]
    pub github_url: Option<String>,
    #[serde(default)]
    pub is_featured: bool,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdatePortfolioItem {
    #[validate(length(min = 1, max = 255, message = "Title must be 1-255 characters"))]
    pub title: Option<String>,
    #[validate(length(max = 5000, message = "Description must be under 5000 characters"))]
    pub description: Option<String>,
    #[validate(length(max = 50, message = "Category must be under 50 characters"))]
    pub category: Option<String>,
    #[validate(url(message = "Invalid thumbnail URL"))]
    pub thumbnail_url: Option<String>,
    #[validate(url(message = "Invalid demo URL"))]
    pub demo_url: Option<String>,
    #[validate(url(message = "Invalid GitHub URL"))]
    pub github_url: Option<String>,
    pub is_featured: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct PortfolioListResponse {
    pub items: Vec<PortfolioItem>,
    pub total: i64,
}

#[derive(Debug, Deserialize)]
pub struct PortfolioListParams {
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub featured_only: Option<bool>,
    #[serde(default)]
    pub limit: Option<i64>,
    #[serde(default)]
    pub offset: Option<i64>,
}
