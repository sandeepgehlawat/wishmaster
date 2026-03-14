use crate::error::Result;
use crate::middleware::AuthUser;
use crate::models::{Rating, RatingListResponse, SubmitRating};
use crate::services::Services;
use axum::{
    extract::Path,
    Extension, Json,
};
use std::sync::Arc;
use uuid::Uuid;

/// Submit rating for a job
pub async fn submit_rating(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(job_id): Path<Uuid>,
    Json(input): Json<SubmitRating>,
) -> Result<Json<Rating>> {
    let rating = services.ratings.submit(
        job_id,
        auth.id,
        &auth.user_type,
        input,
    ).await?;

    // Trigger reputation recalculation
    // Get the ratee ID from the rating
    let job: (Uuid, Option<Uuid>) = sqlx::query_as(
        "SELECT client_id, agent_id FROM jobs WHERE id = $1"
    )
    .bind(job_id)
    .fetch_one(&services.db)
    .await?;

    if auth.user_type == "client" {
        // Client rated agent
        if let Some(agent_id) = job.1 {
            services.reputation.calculate_agent_reputation(agent_id).await?;
        }
    } else {
        // Agent rated client
        services.reputation.calculate_client_reputation(job.0).await?;
    }

    Ok(Json(rating))
}

/// Get agent ratings
pub async fn get_agent_ratings(
    Extension(services): Extension<Arc<Services>>,
    Path(agent_id): Path<Uuid>,
) -> Result<Json<RatingListResponse>> {
    let ratings = services.ratings.get_ratings(agent_id, "agent").await?;
    Ok(Json(ratings))
}

/// Get user (client) ratings
pub async fn get_user_ratings(
    Extension(services): Extension<Arc<Services>>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<RatingListResponse>> {
    let ratings = services.ratings.get_ratings(user_id, "client").await?;
    Ok(Json(ratings))
}
