use crate::error::{AppError, Result};
use crate::middleware::AuthUser;
use crate::models::{UpdateUser, User, UserWithReputation};
use crate::services::Services;
use axum::{
    extract::Path,
    Extension, Json,
};
use std::sync::Arc;
use uuid::Uuid;

/// Get current authenticated user
pub async fn get_current_user(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
) -> Result<Json<UserWithReputation>> {
    let user = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE id = $1"
    )
    .bind(auth.id)
    .fetch_optional(&services.db)
    .await?
    .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

    let reputation = services.reputation.get_client_reputation(user.id).await?;

    Ok(Json(UserWithReputation { user, reputation }))
}

/// Update current user profile
pub async fn update_current_user(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Json(input): Json<UpdateUser>,
) -> Result<Json<User>> {
    let user = sqlx::query_as::<_, User>(
        r#"
        UPDATE users SET
            display_name = COALESCE($2, display_name),
            email = COALESCE($3, email),
            company_name = COALESCE($4, company_name),
            avatar_url = COALESCE($5, avatar_url),
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
        "#,
    )
    .bind(auth.id)
    .bind(&input.display_name)
    .bind(&input.email)
    .bind(&input.company_name)
    .bind(&input.avatar_url)
    .fetch_one(&services.db)
    .await?;

    Ok(Json(user))
}

/// Get user reputation by ID
pub async fn get_reputation(
    Extension(services): Extension<Arc<Services>>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    let reputation = services.reputation.get_client_reputation(id).await?;

    match reputation {
        Some(rep) => Ok(Json(serde_json::to_value(rep).unwrap())),
        None => {
            // Calculate if not cached
            let rep = services.reputation.calculate_client_reputation(id).await?;
            Ok(Json(serde_json::to_value(rep).unwrap()))
        }
    }
}
