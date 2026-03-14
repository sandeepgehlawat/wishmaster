use crate::error::{AppError, Result};
use crate::models::User;
use crate::services::Services;
use axum::{Extension, Json};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct ChallengeRequest {
    pub wallet_address: String,
}

#[derive(Debug, Serialize)]
pub struct ChallengeResponse {
    pub message: String,
    pub message_hash: String,
}

#[derive(Debug, Deserialize)]
pub struct VerifyRequest {
    pub wallet_address: String,
    pub message: String,
    pub signature: String,
    pub display_name: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: User,
    pub is_new: bool,
}

#[derive(Debug, Deserialize)]
pub struct RefreshRequest {
    pub token: String,
}

/// Generate a challenge message for wallet signing
pub async fn get_challenge(
    Extension(services): Extension<Arc<Services>>,
    Json(req): Json<ChallengeRequest>,
) -> Result<Json<ChallengeResponse>> {
    let (message, message_hash) = services.auth.generate_challenge(&req.wallet_address);

    Ok(Json(ChallengeResponse {
        message,
        message_hash,
    }))
}

/// Verify wallet signature and issue JWT
pub async fn verify_signature(
    Extension(services): Extension<Arc<Services>>,
    Json(req): Json<VerifyRequest>,
) -> Result<Json<AuthResponse>> {
    // Verify the signature
    let is_valid = services.auth.verify_signature(
        &req.wallet_address,
        &req.message,
        &req.signature,
    )?;

    if !is_valid {
        return Err(AppError::Unauthorized("Invalid signature".to_string()));
    }

    // Find or create user
    let existing: Option<User> = sqlx::query_as(
        "SELECT * FROM users WHERE wallet_address = $1"
    )
    .bind(&req.wallet_address)
    .fetch_optional(&services.db)
    .await?;

    let (user, is_new) = match existing {
        Some(user) => (user, false),
        None => {
            let display_name = req.display_name.unwrap_or_else(|| {
                format!("User_{}", &req.wallet_address[..8])
            });

            let user = sqlx::query_as::<_, User>(
                r#"
                INSERT INTO users (id, wallet_address, display_name)
                VALUES (gen_random_uuid(), $1, $2)
                RETURNING *
                "#,
            )
            .bind(&req.wallet_address)
            .bind(&display_name)
            .fetch_one(&services.db)
            .await?;

            (user, true)
        }
    };

    // Generate JWT
    let token = services.auth.create_user_token(user.id, &user.wallet_address)?;

    Ok(Json(AuthResponse {
        token,
        user,
        is_new,
    }))
}

/// Refresh an existing JWT token
pub async fn refresh_token(
    Extension(services): Extension<Arc<Services>>,
    Json(req): Json<RefreshRequest>,
) -> Result<Json<serde_json::Value>> {
    let claims = services.auth.verify_token(&req.token)?;

    // Generate new token based on type
    let new_token = if claims.typ == "agent" {
        services.auth.create_agent_token(claims.id, &claims.sub)?
    } else {
        services.auth.create_user_token(claims.id, &claims.sub)?
    };

    Ok(Json(serde_json::json!({
        "token": new_token
    })))
}
