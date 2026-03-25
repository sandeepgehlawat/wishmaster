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

/// Admin: List all users (for debugging)
/// GET /api/admin/users
pub async fn list_all_users(
    Extension(services): Extension<Arc<Services>>,
) -> Result<Json<serde_json::Value>> {
    let users: Vec<User> = sqlx::query_as(
        "SELECT * FROM users ORDER BY created_at DESC LIMIT 20"
    )
    .fetch_all(&services.db)
    .await?;

    Ok(Json(serde_json::json!({
        "count": users.len(),
        "users": users.iter().map(|u| serde_json::json!({
            "id": u.id,
            "wallet": u.wallet_address,
            "display_name": u.display_name,
            "created_at": u.created_at
        })).collect::<Vec<_>>()
    })))
}

/// Debug: Check auth vs job ownership
/// GET /api/debug/auth-check/:job_id
pub async fn debug_auth_check(
    Extension(services): Extension<Arc<Services>>,
    headers: axum::http::HeaderMap,
    Path(job_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    let job = services.jobs.get(job_id).await?;

    // Manually parse JWT from Authorization header
    let auth_info = if let Some(auth_header) = headers.get("authorization") {
        if let Ok(header_str) = auth_header.to_str() {
            if let Some(token) = header_str.strip_prefix("Bearer ") {
                match services.auth.verify_token(token) {
                    Ok(claims) => Some(serde_json::json!({
                        "user_id": claims.id,
                        "wallet": claims.sub,
                        "user_type": claims.typ,
                        "token_valid": true
                    })),
                    Err(e) => Some(serde_json::json!({
                        "error": format!("{:?}", e),
                        "token_valid": false
                    }))
                }
            } else {
                Some(serde_json::json!({"error": "Invalid Bearer format"}))
            }
        } else {
            Some(serde_json::json!({"error": "Invalid header encoding"}))
        }
    } else {
        None
    };

    let client_info: Option<(String, String)> = if let Some(client_id) = job.client_id {
        sqlx::query_as(
            "SELECT wallet_address, display_name FROM users WHERE id = $1"
        )
        .bind(client_id)
        .fetch_optional(&services.db)
        .await?
    } else {
        None
    };

    let ids_match = auth_info.as_ref().and_then(|a| {
        a.get("user_id").and_then(|v| {
            let token_id = Uuid::parse_str(v.as_str()?).ok()?;
            Some(job.client_id == Some(token_id))
        })
    });

    Ok(Json(serde_json::json!({
        "job_id": job.id,
        "job_status": job.status,
        "job_client_id": job.client_id,
        "job_client_wallet": client_info.as_ref().map(|(w, _)| w),
        "auth_from_token": auth_info,
        "ids_match": ids_match
    })))
}

/// Admin: Check job ownership
/// GET /api/admin/job/:id
pub async fn admin_get_job(
    Extension(services): Extension<Arc<Services>>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    let job = services.jobs.get(id).await?;

    // Get client info if exists
    let client_info: Option<(String, String)> = if let Some(client_id) = job.client_id {
        sqlx::query_as(
            "SELECT wallet_address, display_name FROM users WHERE id = $1"
        )
        .bind(client_id)
        .fetch_optional(&services.db)
        .await?
    } else {
        None
    };

    Ok(Json(serde_json::json!({
        "job_id": job.id,
        "title": job.title,
        "status": job.status,
        "client_id": job.client_id,
        "client_wallet": client_info.as_ref().map(|(w, _)| w),
        "client_name": client_info.as_ref().map(|(_, n)| n),
        "created_at": job.created_at
    })))
}

/// DEV ONLY: Merge duplicate users with same wallet address (different case)
/// GET /api/admin/merge-duplicate-users
pub async fn merge_duplicate_users(
    Extension(services): Extension<Arc<Services>>,
) -> Result<Json<serde_json::Value>> {
    // Find all wallets that have duplicates (case-insensitive)
    let duplicates: Vec<(String, i64)> = sqlx::query_as(
        r#"
        SELECT LOWER(wallet_address) as wallet, COUNT(*) as cnt
        FROM users
        GROUP BY LOWER(wallet_address)
        HAVING COUNT(*) > 1
        "#
    )
    .fetch_all(&services.db)
    .await?;

    let mut merged_count = 0;
    let mut details = Vec::new();

    for (wallet, count) in duplicates {
        // Get all users with this wallet, ordered by created_at (keep oldest)
        let users: Vec<User> = sqlx::query_as(
            r#"
            SELECT * FROM users
            WHERE LOWER(wallet_address) = $1
            ORDER BY created_at ASC
            "#
        )
        .bind(&wallet)
        .fetch_all(&services.db)
        .await?;

        if users.len() < 2 {
            continue;
        }

        let canonical_user = &users[0]; // Keep the oldest
        let duplicate_ids: Vec<Uuid> = users[1..].iter().map(|u| u.id).collect();

        // Update all jobs to point to canonical user
        let jobs_updated = sqlx::query(
            "UPDATE jobs SET client_id = $1 WHERE client_id = ANY($2)"
        )
        .bind(canonical_user.id)
        .bind(&duplicate_ids)
        .execute(&services.db)
        .await?
        .rows_affected();

        // Update escrows
        let escrows_updated = sqlx::query(
            "UPDATE escrows SET client_wallet = $1 WHERE client_wallet = ANY($2)"
        )
        .bind(&canonical_user.wallet_address)
        .bind(&users[1..].iter().map(|u| u.wallet_address.clone()).collect::<Vec<_>>())
        .execute(&services.db)
        .await?
        .rows_affected();

        // Delete duplicate users
        let deleted = sqlx::query(
            "DELETE FROM users WHERE id = ANY($1)"
        )
        .bind(&duplicate_ids)
        .execute(&services.db)
        .await?
        .rows_affected();

        // Normalize the canonical user's wallet to lowercase
        sqlx::query(
            "UPDATE users SET wallet_address = LOWER(wallet_address) WHERE id = $1"
        )
        .bind(canonical_user.id)
        .execute(&services.db)
        .await?;

        merged_count += 1;
        details.push(serde_json::json!({
            "wallet": wallet,
            "kept_user_id": canonical_user.id,
            "deleted_users": duplicate_ids.len(),
            "jobs_updated": jobs_updated,
            "escrows_updated": escrows_updated,
        }));
    }

    Ok(Json(serde_json::json!({
        "merged": merged_count,
        "details": details
    })))
}
