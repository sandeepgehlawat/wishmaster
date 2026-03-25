use crate::error::AppError;
use crate::services::{AuthService, Services};
use axum::{
    extract::{Request, Extension},
    middleware::Next,
    response::Response,
    http::header::AUTHORIZATION,
};
use std::sync::Arc;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct AuthUser {
    pub id: Uuid,
    pub wallet_address: String,
    pub user_type: String, // "user" or "agent"
}

/// Extract and verify JWT token from Authorization header
pub async fn auth_middleware(
    Extension(services): Extension<Arc<Services>>,
    mut request: Request,
    next: Next,
) -> Result<Response, AppError> {
    let auth_header = request
        .headers()
        .get(AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
        .ok_or_else(|| AppError::Unauthorized("Missing authorization header".to_string()))?;

    let token = auth_header
        .strip_prefix("Bearer ")
        .ok_or_else(|| AppError::Unauthorized("Invalid authorization format".to_string()))?;

    let claims = services.auth.verify_token(token)?;

    let auth_user = AuthUser {
        id: claims.id,
        wallet_address: claims.sub,
        user_type: claims.typ,
    };

    request.extensions_mut().insert(auth_user);

    Ok(next.run(request).await)
}

/// Extract API key from X-API-Key header (for agent SDK)
pub async fn agent_auth_middleware(
    Extension(services): Extension<Arc<Services>>,
    mut request: Request,
    next: Next,
) -> Result<Response, AppError> {
    // First try JWT auth
    if let Some(auth_header) = request.headers().get(AUTHORIZATION) {
        if let Ok(header_str) = auth_header.to_str() {
            if let Some(token) = header_str.strip_prefix("Bearer ") {
                if let Ok(claims) = services.auth.verify_token(token) {
                    let auth_user = AuthUser {
                        id: claims.id,
                        wallet_address: claims.sub,
                        user_type: claims.typ,
                    };
                    request.extensions_mut().insert(auth_user);
                    return Ok(next.run(request).await);
                }
            }
        }
    }

    // Try API key auth
    let api_key = request
        .headers()
        .get("X-API-Key")
        .and_then(|h| h.to_str().ok())
        .ok_or_else(|| AppError::Unauthorized("Missing API key".to_string()))?;

    // Look up agent by API key hash
    let api_key_hash = AuthService::hash_api_key(api_key);

    let agent: Option<(Uuid, String)> = sqlx::query_as(
        "SELECT id, wallet_address FROM agents WHERE api_key_hash = $1 AND is_active = true"
    )
    .bind(&api_key_hash)
    .fetch_optional(&services.db)
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?;

    let (agent_id, wallet) = agent
        .ok_or_else(|| AppError::Unauthorized("Invalid API key".to_string()))?;

    let auth_user = AuthUser {
        id: agent_id,
        wallet_address: wallet,
        user_type: "agent".to_string(),
    };

    request.extensions_mut().insert(auth_user);

    Ok(next.run(request).await)
}

/// Optional auth middleware - extracts auth if present but doesn't require it
/// Use for public routes that want to show extra data to authenticated users
pub async fn optional_auth_middleware(
    Extension(services): Extension<Arc<Services>>,
    mut request: Request,
    next: Next,
) -> Response {
    // Try to extract JWT if present
    if let Some(auth_header) = request.headers().get(AUTHORIZATION) {
        if let Ok(header_str) = auth_header.to_str() {
            if let Some(token) = header_str.strip_prefix("Bearer ") {
                if let Ok(claims) = services.auth.verify_token(token) {
                    let auth_user = AuthUser {
                        id: claims.id,
                        wallet_address: claims.sub,
                        user_type: claims.typ,
                    };
                    request.extensions_mut().insert(auth_user);
                }
            }
        }
    }

    // Always continue, whether auth succeeded or not
    next.run(request).await
}
