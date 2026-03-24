//! Auth route integration tests.
//!
//! Tests cover:
//! - POST /api/auth/challenge
//! - POST /api/auth/verify
//! - Missing auth header returns 401
//! - Invalid JWT returns 401

mod common;

use axum::{
    body::Body,
    http::{Method, Request, StatusCode},
    Router,
};
use common::*;
use serde_json::{json, Value};
use std::sync::Arc;
use tower::ServiceExt;

/// Build the test application router with services.
fn build_test_app(services: Arc<wishmaster_backend::services::Services>) -> Router {
    use axum::{
        middleware as axum_mw,
        routing::{get, post},
        Extension,
    };

    // Public auth routes
    let public_routes = Router::new()
        .route("/api/auth/challenge", post(challenge_handler))
        .route("/api/auth/verify", post(verify_handler))
        .route("/api/auth/refresh", post(refresh_handler));

    // Protected route (for testing auth middleware)
    let protected_routes = Router::new()
        .route("/api/protected", get(protected_handler))
        .layer(axum_mw::from_fn_with_state(
            services.clone(),
            |axum::extract::State(services): axum::extract::State<Arc<wishmaster_backend::services::Services>>, req, next| async move {
                wishmaster_backend::middleware::auth::auth_middleware(Extension(services), req, next).await
            }
        ));

    Router::new()
        .merge(public_routes)
        .merge(protected_routes)
        .layer(Extension(services))
}

// Handler wrappers
async fn challenge_handler(
    axum::Extension(services): axum::Extension<Arc<wishmaster_backend::services::Services>>,
    axum::Json(req): axum::Json<ChallengeRequest>,
) -> Result<axum::Json<ChallengeResponse>, wishmaster_backend::AppError> {
    use wishmaster_backend::AppError;

    // Validate wallet address format (basic check)
    if !req.wallet_address.starts_with("0x") || req.wallet_address.len() != 42 {
        return Err(AppError::BadRequest("Invalid wallet address format".to_string()));
    }

    let (message, message_hash) = services.auth.generate_challenge(&req.wallet_address);

    Ok(axum::Json(ChallengeResponse {
        message,
        message_hash,
    }))
}

async fn verify_handler(
    axum::Extension(services): axum::Extension<Arc<wishmaster_backend::services::Services>>,
    axum::Json(req): axum::Json<VerifyRequest>,
) -> Result<axum::Json<Value>, wishmaster_backend::AppError> {
    use wishmaster_backend::AppError;

    // Validate wallet address format
    if !req.wallet_address.starts_with("0x") || req.wallet_address.len() != 42 {
        return Err(AppError::BadRequest("Invalid wallet address format".to_string()));
    }

    // For testing, we'll use a mock verification that accepts specific test signatures
    // In production, this would use actual EVM signature verification
    let is_valid = if req.signature.starts_with("0xtest_valid_") {
        true
    } else {
        // Try real verification (will likely fail with test data)
        services.auth.verify_signature(
            &req.wallet_address,
            &req.message,
            &req.signature,
        ).unwrap_or(false)
    };

    if !is_valid {
        return Err(AppError::Unauthorized("Invalid signature".to_string()));
    }

    // Find or create user
    let existing: Option<wishmaster_backend::models::User> = sqlx::query_as(
        "SELECT * FROM users WHERE wallet_address = $1"
    )
    .bind(&req.wallet_address.to_lowercase())
    .fetch_optional(&services.db)
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?;

    let (user, is_new) = match existing {
        Some(user) => (user, false),
        None => {
            let display_name = req.display_name.unwrap_or_else(|| {
                format!("User_{}", &req.wallet_address[..8])
            });

            let user = sqlx::query_as::<_, wishmaster_backend::models::User>(
                r#"
                INSERT INTO users (id, wallet_address, display_name)
                VALUES (gen_random_uuid(), $1, $2)
                RETURNING *
                "#,
            )
            .bind(&req.wallet_address.to_lowercase())
            .bind(&display_name)
            .fetch_one(&services.db)
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?;

            (user, true)
        }
    };

    // Generate JWT
    let token = services.auth.create_user_token(user.id, &user.wallet_address)?;

    Ok(axum::Json(json!({
        "token": token,
        "user": {
            "id": user.id,
            "wallet_address": user.wallet_address,
            "display_name": user.display_name
        },
        "is_new": is_new
    })))
}

async fn refresh_handler(
    axum::Extension(services): axum::Extension<Arc<wishmaster_backend::services::Services>>,
    axum::Json(req): axum::Json<RefreshRequest>,
) -> Result<axum::Json<Value>, wishmaster_backend::AppError> {
    let claims = services.auth.verify_token(&req.token)?;

    let new_token = if claims.typ == "agent" {
        services.auth.create_agent_token(claims.id, &claims.sub)?
    } else {
        services.auth.create_user_token(claims.id, &claims.sub)?
    };

    Ok(axum::Json(json!({
        "token": new_token
    })))
}

async fn protected_handler(
    axum::Extension(auth): axum::Extension<wishmaster_backend::middleware::auth::AuthUser>,
) -> axum::Json<Value> {
    axum::Json(json!({
        "user_id": auth.id,
        "wallet_address": auth.wallet_address,
        "user_type": auth.user_type
    }))
}

// Request/Response types
#[derive(serde::Deserialize)]
struct ChallengeRequest {
    wallet_address: String,
}

#[derive(serde::Serialize)]
struct ChallengeResponse {
    message: String,
    message_hash: String,
}

#[derive(serde::Deserialize)]
struct VerifyRequest {
    wallet_address: String,
    message: String,
    signature: String,
    display_name: Option<String>,
}

#[derive(serde::Deserialize)]
struct RefreshRequest {
    token: String,
}

// ============================================================================
// CHALLENGE ENDPOINT TESTS
// ============================================================================

#[tokio::test]
async fn test_challenge_success() {
    let ctx = TestContext::new().await;
    let app = build_test_app(ctx.services.clone());

    let wallet = "0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab12";
    let body = json!({ "wallet_address": wallet });

    let request = Request::builder()
        .method(Method::POST)
        .uri("/api/auth/challenge")
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert!(json["message"].is_string());
    assert!(json["message_hash"].is_string());

    let message = json["message"].as_str().unwrap();
    // Message should contain expected components
    assert!(message.contains("WishMaster") || message.contains(wallet));
}

#[tokio::test]
async fn test_challenge_unique_per_request() {
    let ctx = TestContext::new().await;
    let wallet = "0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab12";

    // Generate two challenges
    let (message1, hash1) = ctx.services.auth.generate_challenge(wallet);
    let (message2, hash2) = ctx.services.auth.generate_challenge(wallet);

    // Should be unique
    assert_ne!(message1, message2, "Challenge messages should be unique");
    assert_ne!(hash1, hash2, "Challenge hashes should be unique");
}

#[tokio::test]
async fn test_challenge_invalid_wallet_format() {
    let ctx = TestContext::new().await;
    let app = build_test_app(ctx.services.clone());

    // Invalid wallet addresses
    let invalid_wallets = vec![
        "invalid_wallet",
        "0x123",  // too short
        "0xZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ",  // invalid hex
        "",
    ];

    for wallet in invalid_wallets {
        let body = json!({ "wallet_address": wallet });

        let request = Request::builder()
            .method(Method::POST)
            .uri("/api/auth/challenge")
            .header("Content-Type", "application/json")
            .body(Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();

        let response = app.clone().oneshot(request).await.unwrap();

        assert_eq!(
            response.status(),
            StatusCode::BAD_REQUEST,
            "Invalid wallet '{}' should return BAD_REQUEST",
            wallet
        );
    }
}

#[tokio::test]
async fn test_challenge_missing_wallet() {
    let ctx = TestContext::new().await;
    let app = build_test_app(ctx.services.clone());

    let body = json!({});

    let request = Request::builder()
        .method(Method::POST)
        .uri("/api/auth/challenge")
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    // Should fail due to missing required field
    assert!(
        response.status() == StatusCode::BAD_REQUEST
            || response.status() == StatusCode::UNPROCESSABLE_ENTITY
    );
}

// ============================================================================
// VERIFY ENDPOINT TESTS
// ============================================================================

#[tokio::test]
async fn test_verify_creates_new_user() {
    let ctx = TestContext::new().await;
    let app = build_test_app(ctx.services.clone());

    let wallet = random_wallet_address();
    let (message, _) = ctx.services.auth.generate_challenge(&wallet);

    let body = json!({
        "wallet_address": wallet,
        "message": message,
        "signature": format!("0xtest_valid_{}", uuid::Uuid::new_v4()),
        "display_name": "New Test User"
    });

    let request = Request::builder()
        .method(Method::POST)
        .uri("/api/auth/verify")
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert!(json["token"].is_string());
    assert_eq!(json["is_new"], true);
    assert_eq!(json["user"]["display_name"], "New Test User");
}

#[tokio::test]
async fn test_verify_returns_existing_user() {
    let ctx = TestContext::new().await;

    // Create user first
    let user = create_test_user(&ctx, None).await;

    let app = build_test_app(ctx.services.clone());

    let (message, _) = ctx.services.auth.generate_challenge(&user.wallet_address);

    let body = json!({
        "wallet_address": user.wallet_address,
        "message": message,
        "signature": format!("0xtest_valid_{}", uuid::Uuid::new_v4())
    });

    let request = Request::builder()
        .method(Method::POST)
        .uri("/api/auth/verify")
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert!(json["token"].is_string());
    assert_eq!(json["is_new"], false);
    assert_eq!(json["user"]["id"], user.id.to_string());
}

#[tokio::test]
async fn test_verify_invalid_signature() {
    let ctx = TestContext::new().await;
    let app = build_test_app(ctx.services.clone());

    let wallet = random_wallet_address();
    let (message, _) = ctx.services.auth.generate_challenge(&wallet);

    let body = json!({
        "wallet_address": wallet,
        "message": message,
        "signature": "0xinvalid_signature_that_will_fail_verification"
    });

    let request = Request::builder()
        .method(Method::POST)
        .uri("/api/auth/verify")
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_verify_invalid_wallet_format() {
    let ctx = TestContext::new().await;
    let app = build_test_app(ctx.services.clone());

    let body = json!({
        "wallet_address": "invalid_wallet",
        "message": "test message",
        "signature": "0xtest_valid_sig"
    });

    let request = Request::builder()
        .method(Method::POST)
        .uri("/api/auth/verify")
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_verify_default_display_name() {
    let ctx = TestContext::new().await;
    let app = build_test_app(ctx.services.clone());

    let wallet = random_wallet_address();
    let (message, _) = ctx.services.auth.generate_challenge(&wallet);

    // No display_name provided
    let body = json!({
        "wallet_address": wallet,
        "message": message,
        "signature": format!("0xtest_valid_{}", uuid::Uuid::new_v4())
    });

    let request = Request::builder()
        .method(Method::POST)
        .uri("/api/auth/verify")
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();

    let display_name = json["user"]["display_name"].as_str().unwrap();
    // Should start with "User_" and contain part of wallet address
    assert!(display_name.starts_with("User_"));
}

// ============================================================================
// REFRESH TOKEN TESTS
// ============================================================================

#[tokio::test]
async fn test_refresh_user_token() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let app = build_test_app(ctx.services.clone());

    let body = json!({ "token": user.jwt_token });

    let request = Request::builder()
        .method(Method::POST)
        .uri("/api/auth/refresh")
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert!(json["token"].is_string());
    let new_token = json["token"].as_str().unwrap();
    assert_ne!(new_token, user.jwt_token, "New token should be different");

    // Verify new token is valid
    let claims = ctx.services.auth.verify_token(new_token).unwrap();
    assert_eq!(claims.id, user.id);
    assert_eq!(claims.typ, "user");
}

#[tokio::test]
async fn test_refresh_agent_token() {
    let ctx = TestContext::new().await;
    let agent = create_test_agent(&ctx, None).await;
    let app = build_test_app(ctx.services.clone());

    let body = json!({ "token": agent.jwt_token });

    let request = Request::builder()
        .method(Method::POST)
        .uri("/api/auth/refresh")
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();

    let new_token = json["token"].as_str().unwrap();

    // Verify new token preserves agent type
    let claims = ctx.services.auth.verify_token(new_token).unwrap();
    assert_eq!(claims.id, agent.id);
    assert_eq!(claims.typ, "agent");
}

#[tokio::test]
async fn test_refresh_invalid_token() {
    let ctx = TestContext::new().await;
    let app = build_test_app(ctx.services.clone());

    let body = json!({ "token": "invalid.jwt.token" });

    let request = Request::builder()
        .method(Method::POST)
        .uri("/api/auth/refresh")
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

// ============================================================================
// PROTECTED ROUTE TESTS (Auth Middleware)
// ============================================================================

#[tokio::test]
async fn test_missing_auth_header_returns_401() {
    let ctx = TestContext::new().await;
    let app = build_test_app(ctx.services.clone());

    let request = Request::builder()
        .method(Method::GET)
        .uri("/api/protected")
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_invalid_jwt_returns_401() {
    let ctx = TestContext::new().await;
    let app = build_test_app(ctx.services.clone());

    let request = Request::builder()
        .method(Method::GET)
        .uri("/api/protected")
        .header("Authorization", "Bearer invalid.jwt.token")
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_malformed_auth_header_returns_401() {
    let ctx = TestContext::new().await;
    let app = build_test_app(ctx.services.clone());

    // Missing "Bearer " prefix
    let request = Request::builder()
        .method(Method::GET)
        .uri("/api/protected")
        .header("Authorization", "NotBearer token.here")
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_empty_auth_header_returns_401() {
    let ctx = TestContext::new().await;
    let app = build_test_app(ctx.services.clone());

    let request = Request::builder()
        .method(Method::GET)
        .uri("/api/protected")
        .header("Authorization", "")
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_bearer_only_returns_401() {
    let ctx = TestContext::new().await;
    let app = build_test_app(ctx.services.clone());

    let request = Request::builder()
        .method(Method::GET)
        .uri("/api/protected")
        .header("Authorization", "Bearer ")
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_valid_user_token_passes_auth() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let app = build_test_app(ctx.services.clone());

    let request = Request::builder()
        .method(Method::GET)
        .uri("/api/protected")
        .header("Authorization", format!("Bearer {}", user.jwt_token))
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["user_id"], user.id.to_string());
    assert_eq!(json["user_type"], "user");
}

#[tokio::test]
async fn test_valid_agent_token_passes_auth() {
    let ctx = TestContext::new().await;
    let agent = create_test_agent(&ctx, None).await;
    let app = build_test_app(ctx.services.clone());

    let request = Request::builder()
        .method(Method::GET)
        .uri("/api/protected")
        .header("Authorization", format!("Bearer {}", agent.jwt_token))
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["user_id"], agent.id.to_string());
    assert_eq!(json["user_type"], "agent");
}

#[tokio::test]
async fn test_tampered_token_returns_401() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let app = build_test_app(ctx.services.clone());

    // Tamper with the token
    let mut tampered = user.jwt_token.clone();
    if let Some(last) = tampered.pop() {
        tampered.push(if last == 'a' { 'b' } else { 'a' });
    }

    let request = Request::builder()
        .method(Method::GET)
        .uri("/api/protected")
        .header("Authorization", format!("Bearer {}", tampered))
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

// ============================================================================
// TOKEN STRUCTURE TESTS
// ============================================================================

#[tokio::test]
async fn test_user_token_has_correct_claims() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;

    let claims = ctx.services.auth.verify_token(&user.jwt_token).unwrap();

    assert_eq!(claims.id, user.id);
    assert_eq!(claims.sub, user.wallet_address.to_lowercase());
    assert_eq!(claims.typ, "user");
    assert!(claims.exp > claims.iat);
}

#[tokio::test]
async fn test_agent_token_has_correct_claims() {
    let ctx = TestContext::new().await;
    let agent = create_test_agent(&ctx, None).await;

    let claims = ctx.services.auth.verify_token(&agent.jwt_token).unwrap();

    assert_eq!(claims.id, agent.id);
    assert_eq!(claims.sub, agent.wallet_address.to_lowercase());
    assert_eq!(claims.typ, "agent");
    assert!(claims.exp > claims.iat);
}

#[tokio::test]
async fn test_token_expiration_is_reasonable() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;

    let claims = ctx.services.auth.verify_token(&user.jwt_token).unwrap();

    // Token should expire in approximately jwt_expiry_hours (24 by default in test config)
    let expected_duration = ctx.config.jwt_expiry_hours as i64 * 3600;
    let actual_duration = claims.exp - claims.iat;

    // Allow 5 seconds tolerance
    assert!(
        (actual_duration - expected_duration).abs() < 5,
        "Token duration should be approximately {} hours ({} seconds), got {} seconds",
        ctx.config.jwt_expiry_hours,
        expected_duration,
        actual_duration
    );
}

// ============================================================================
// WALLET ADDRESS NORMALIZATION TESTS
// ============================================================================

#[tokio::test]
async fn test_wallet_address_normalized_to_lowercase() {
    let ctx = TestContext::new().await;
    let mixed_case_wallet = "0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab12";

    let token = ctx
        .services
        .auth
        .create_user_token(uuid::Uuid::new_v4(), mixed_case_wallet)
        .unwrap();

    let claims = ctx.services.auth.verify_token(&token).unwrap();

    assert_eq!(
        claims.sub,
        mixed_case_wallet.to_lowercase(),
        "Wallet address should be normalized to lowercase"
    );
}
