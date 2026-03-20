use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum RequirementPriority {
    MustHave,
    ShouldHave,
    NiceToHave,
}

impl Default for RequirementPriority {
    fn default() -> Self {
        Self::MustHave
    }
}

impl std::fmt::Display for RequirementPriority {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::MustHave => write!(f, "must_have"),
            Self::ShouldHave => write!(f, "should_have"),
            Self::NiceToHave => write!(f, "nice_to_have"),
        }
    }
}

impl TryFrom<&str> for RequirementPriority {
    type Error = String;
    fn try_from(s: &str) -> Result<Self, Self::Error> {
        match s {
            "must_have" => Ok(Self::MustHave),
            "should_have" => Ok(Self::ShouldHave),
            "nice_to_have" => Ok(Self::NiceToHave),
            _ => Err(format!("Invalid priority: {}", s)),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum RequirementStatus {
    Pending,
    InProgress,
    Delivered,
    Accepted,
    Rejected,
}

impl Default for RequirementStatus {
    fn default() -> Self {
        Self::Pending
    }
}

impl std::fmt::Display for RequirementStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Pending => write!(f, "pending"),
            Self::InProgress => write!(f, "in_progress"),
            Self::Delivered => write!(f, "delivered"),
            Self::Accepted => write!(f, "accepted"),
            Self::Rejected => write!(f, "rejected"),
        }
    }
}

impl TryFrom<&str> for RequirementStatus {
    type Error = String;
    fn try_from(s: &str) -> Result<Self, Self::Error> {
        match s {
            "pending" => Ok(Self::Pending),
            "in_progress" => Ok(Self::InProgress),
            "delivered" => Ok(Self::Delivered),
            "accepted" => Ok(Self::Accepted),
            "rejected" => Ok(Self::Rejected),
            _ => Err(format!("Invalid status: {}", s)),
        }
    }
}

impl RequirementStatus {
    /// Returns the valid transitions from the current status
    pub fn valid_transitions(&self) -> Vec<RequirementStatus> {
        match self {
            Self::Pending => vec![Self::InProgress, Self::Delivered],
            Self::InProgress => vec![Self::Delivered],
            Self::Delivered => vec![Self::Accepted, Self::Rejected],
            Self::Rejected => vec![Self::Delivered], // Agent must re-deliver after rejection
            Self::Accepted => vec![], // Terminal state
        }
    }

    /// Check if transition to new status is valid
    pub fn can_transition_to(&self, new_status: &RequirementStatus) -> bool {
        self.valid_transitions().contains(new_status)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Requirement {
    pub id: Uuid,
    pub job_id: Uuid,
    pub created_by: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub acceptance_criteria: Option<String>,
    pub priority: String,
    pub status: String,
    pub rejection_feedback: Option<String>,
    pub position: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub accepted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateRequirement {
    #[validate(length(min = 1, max = 255, message = "Title must be 1-255 characters"))]
    pub title: String,
    #[validate(length(max = 10000, message = "Description must be under 10000 characters"))]
    pub description: Option<String>,
    #[validate(length(max = 5000, message = "Acceptance criteria must be under 5000 characters"))]
    pub acceptance_criteria: Option<String>,
    #[serde(default)]
    pub priority: Option<String>,
    #[serde(default)]
    #[validate(range(min = 0, max = 1000, message = "Position must be 0-1000"))]
    pub position: Option<i32>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateRequirement {
    #[validate(length(min = 1, max = 255, message = "Title must be 1-255 characters"))]
    pub title: Option<String>,
    #[validate(length(max = 10000, message = "Description must be under 10000 characters"))]
    pub description: Option<String>,
    #[validate(length(max = 5000, message = "Acceptance criteria must be under 5000 characters"))]
    pub acceptance_criteria: Option<String>,
    pub priority: Option<String>,
    pub status: Option<String>,
    #[validate(range(min = 0, max = 1000, message = "Position must be 0-1000"))]
    pub position: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct RejectRequirement {
    pub feedback: String,
}

#[derive(Debug, Serialize)]
pub struct RequirementListResponse {
    pub requirements: Vec<Requirement>,
    pub total: i64,
    pub completed: i64,
}
