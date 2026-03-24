//! Authentication middleware and service tests.
//!
//! Tests cover:
//! - JWT token creation and verification
//! - API key authentication
//! - Auth middleware behavior
//! - Token expiration
//! - Invalid credentials handling

mod common;

use common::*;
use uuid::Uuid;
use wishmaster_backend::services::AuthService;

// ============================================================================
// JWT Token Tests
// ============================================================================

#[tokio::test]
async fn test_create_user_jwt_token() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;

    // Token should be non-empty and have 3 parts (header.payload.signature)
    assert!(!user.jwt_token.is_empty());
    let parts: Vec<&str> = user.jwt_token.split('.').collect();
    assert_eq!(parts.len(), 3, "JWT should have 3 parts");
}

#[tokio::test]
async fn test_verify_valid_user_token() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;

    let claims = ctx.services.auth.verify_token(&user.jwt_token).unwrap();

    assert_eq!(claims.id, user.id);
    assert_eq!(claims.sub, user.wallet_address.to_lowercase());
    assert_eq!(claims.typ, "user");
}

#[tokio::test]
async fn test_create_agent_jwt_token() {
    let ctx = TestContext::new().await;
    let agent = create_test_agent(&ctx, None).await;

    assert!(!agent.jwt_token.is_empty());
    let parts: Vec<&str> = agent.jwt_token.split('.').collect();
    assert_eq!(parts.len(), 3);
}

#[tokio::test]
async fn test_verify_valid_agent_token() {
    let ctx = TestContext::new().await;
    let agent = create_test_agent(&ctx, None).await;

    let claims = ctx.services.auth.verify_token(&agent.jwt_token).unwrap();

    assert_eq!(claims.id, agent.id);
    assert_eq!(claims.sub, agent.wallet_address.to_lowercase());
    assert_eq!(claims.typ, "agent");
}

#[tokio::test]
async fn test_verify_invalid_token() {
    let ctx = TestContext::new().await;

    let result = ctx.services.auth.verify_token("invalid.token.here");

    assert!(result.is_err(), "Invalid token should fail verification");
}

#[tokio::test]
async fn test_verify_tampered_token() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;

    // Tamper with the token by changing a character in the signature
    let mut tampered = user.jwt_token.clone();
    if let Some(last) = tampered.pop() {
        // Change the last character
        tampered.push(if last == 'a' { 'b' } else { 'a' });
    }

    let result = ctx.services.auth.verify_token(&tampered);
    assert!(result.is_err(), "Tampered token should fail verification");
}

#[tokio::test]
async fn test_token_with_wrong_secret() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;

    // Create a new config with a different secret
    let mut different_config = test_config();
    different_config.jwt_secret = "completely_different_secret_for_testing".to_string();
    let different_auth = AuthService::new(different_config);

    let result = different_auth.verify_token(&user.jwt_token);
    assert!(result.is_err(), "Token should fail with different secret");
}

// ============================================================================
// API Key Tests
// ============================================================================

#[tokio::test]
async fn test_api_key_generation() {
    let key1 = AuthService::generate_api_key();
    let key2 = AuthService::generate_api_key();

    // Keys should start with the prefix
    assert!(key1.starts_with("ahk_"), "API key should start with 'ahk_'");
    assert!(key2.starts_with("ahk_"), "API key should start with 'ahk_'");

    // Keys should be unique
    assert_ne!(key1, key2, "Generated API keys should be unique");

    // Keys should have correct length: "ahk_" (4) + 64 hex chars (32 bytes)
    assert_eq!(key1.len(), 68, "API key should be 68 characters");
}

#[tokio::test]
async fn test_api_key_hashing() {
    let api_key = AuthService::generate_api_key();
    let hash = AuthService::hash_api_key(&api_key);

    // Hash should be 64 characters (SHA256 hex)
    assert_eq!(hash.len(), 64, "Hash should be 64 hex characters");

    // Verification should work
    assert!(
        AuthService::verify_api_key(&api_key, &hash),
        "Correct API key should verify"
    );

    // Wrong key should fail
    assert!(
        !AuthService::verify_api_key("wrong_key", &hash),
        "Wrong API key should not verify"
    );
}

#[tokio::test]
async fn test_api_key_hash_consistency() {
    let api_key = "ahk_test_key_12345678901234567890";

    let hash1 = AuthService::hash_api_key(api_key);
    let hash2 = AuthService::hash_api_key(api_key);

    assert_eq!(hash1, hash2, "Hashing same key should produce same hash");
}

#[tokio::test]
async fn test_agent_api_key_stored_correctly() {
    let ctx = TestContext::new().await;
    let agent = create_test_agent(&ctx, None).await;

    // Verify the hash stored in the database matches what we expect
    let stored_hash: (String,) = sqlx::query_as("SELECT api_key_hash FROM agents WHERE id = $1")
        .bind(agent.id)
        .fetch_one(&ctx.pool)
        .await
        .expect("Failed to fetch agent");

    assert_eq!(
        stored_hash.0, agent.api_key_hash,
        "Stored hash should match"
    );

    // The original API key should verify against the stored hash
    assert!(
        AuthService::verify_api_key(&agent.api_key, &stored_hash.0),
        "API key should verify against stored hash"
    );
}

// ============================================================================
// Challenge Generation Tests
// ============================================================================

#[tokio::test]
async fn test_challenge_generation() {
    let ctx = TestContext::new().await;
    let wallet = "0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab12";

    let (message, hash) = ctx.services.auth.generate_challenge(wallet);

    // Message should contain expected components
    assert!(message.contains("WishMaster"), "Message should mention WishMaster");
    assert!(message.contains(wallet), "Message should contain wallet address");
    assert!(message.contains("Nonce:"), "Message should contain nonce");
    assert!(message.contains("Timestamp:"), "Message should contain timestamp");

    // Hash should be valid SHA256 hex (64 characters)
    assert_eq!(hash.len(), 64, "Hash should be 64 hex characters");
}

#[tokio::test]
async fn test_challenge_uniqueness() {
    let ctx = TestContext::new().await;
    let wallet = "0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab12";

    let (message1, hash1) = ctx.services.auth.generate_challenge(wallet);
    let (message2, hash2) = ctx.services.auth.generate_challenge(wallet);

    // Challenges should be unique due to different nonces
    assert_ne!(message1, message2, "Challenge messages should be unique");
    assert_ne!(hash1, hash2, "Challenge hashes should be unique");
}

// ============================================================================
// Authentication Database Integration Tests
// ============================================================================

#[tokio::test]
async fn test_agent_lookup_by_api_key() {
    let ctx = TestContext::new().await;
    let agent = create_test_agent(&ctx, None).await;

    // Simulate what the middleware does: hash the API key and look up the agent
    let api_key_hash = AuthService::hash_api_key(&agent.api_key);

    let result: Option<(Uuid, String)> = sqlx::query_as(
        "SELECT id, wallet_address FROM agents WHERE api_key_hash = $1 AND is_active = true",
    )
    .bind(&api_key_hash)
    .fetch_optional(&ctx.pool)
    .await
    .expect("Database query failed");

    assert!(result.is_some(), "Agent should be found by API key hash");
    let (found_id, found_wallet) = result.unwrap();
    assert_eq!(found_id, agent.id);
    assert_eq!(found_wallet, agent.wallet_address);
}

#[tokio::test]
async fn test_inactive_agent_not_found_by_api_key() {
    let ctx = TestContext::new().await;
    let agent = create_test_agent(&ctx, None).await;

    // Deactivate the agent
    sqlx::query("UPDATE agents SET is_active = false WHERE id = $1")
        .bind(agent.id)
        .execute(&ctx.pool)
        .await
        .expect("Failed to deactivate agent");

    // Try to find the agent
    let api_key_hash = AuthService::hash_api_key(&agent.api_key);

    let result: Option<(Uuid, String)> = sqlx::query_as(
        "SELECT id, wallet_address FROM agents WHERE api_key_hash = $1 AND is_active = true",
    )
    .bind(&api_key_hash)
    .fetch_optional(&ctx.pool)
    .await
    .expect("Database query failed");

    assert!(
        result.is_none(),
        "Inactive agent should not be found by API key"
    );
}

#[tokio::test]
async fn test_invalid_api_key_returns_none() {
    let ctx = TestContext::new().await;

    let invalid_hash = AuthService::hash_api_key("ahk_invalid_key_that_does_not_exist");

    let result: Option<(Uuid, String)> = sqlx::query_as(
        "SELECT id, wallet_address FROM agents WHERE api_key_hash = $1 AND is_active = true",
    )
    .bind(&invalid_hash)
    .fetch_optional(&ctx.pool)
    .await
    .expect("Database query failed");

    assert!(result.is_none(), "Invalid API key should return no results");
}

// ============================================================================
// Token Claims Tests
// ============================================================================

#[tokio::test]
async fn test_user_token_claims_structure() {
    let ctx = TestContext::new().await;
    let user_id = Uuid::new_v4();
    let wallet = "0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab12";

    let token = ctx
        .services
        .auth
        .create_user_token(user_id, wallet)
        .expect("Failed to create token");

    let claims = ctx
        .services
        .auth
        .verify_token(&token)
        .expect("Failed to verify token");

    // Verify all claims
    assert_eq!(claims.id, user_id, "User ID should match");
    assert_eq!(
        claims.sub,
        wallet.to_lowercase(),
        "Subject should be lowercase wallet"
    );
    assert_eq!(claims.typ, "user", "Type should be 'user'");
    assert!(claims.exp > claims.iat, "Expiration should be after issued time");

    // Expiration should be within expected range (24 hours by default in test config)
    let expected_duration = ctx.config.jwt_expiry_hours * 3600;
    let actual_duration = claims.exp - claims.iat;
    assert!(
        (actual_duration - expected_duration).abs() < 5,
        "Token duration should be approximately {} hours",
        ctx.config.jwt_expiry_hours
    );
}

#[tokio::test]
async fn test_agent_token_claims_structure() {
    let ctx = TestContext::new().await;
    let agent_id = Uuid::new_v4();
    let wallet = "0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab12";

    let token = ctx
        .services
        .auth
        .create_agent_token(agent_id, wallet)
        .expect("Failed to create token");

    let claims = ctx
        .services
        .auth
        .verify_token(&token)
        .expect("Failed to verify token");

    assert_eq!(claims.id, agent_id, "Agent ID should match");
    assert_eq!(claims.typ, "agent", "Type should be 'agent'");
}

// ============================================================================
// Wallet Address Validation Tests
// ============================================================================

#[tokio::test]
async fn test_wallet_address_lowercase_normalization() {
    let ctx = TestContext::new().await;
    let user_id = Uuid::new_v4();
    let mixed_case_wallet = "0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab12";

    let token = ctx
        .services
        .auth
        .create_user_token(user_id, mixed_case_wallet)
        .expect("Failed to create token");

    let claims = ctx
        .services
        .auth
        .verify_token(&token)
        .expect("Failed to verify token");

    assert_eq!(
        claims.sub,
        mixed_case_wallet.to_lowercase(),
        "Wallet address should be normalized to lowercase"
    );
}

// ============================================================================
// Edge Cases
// ============================================================================

#[tokio::test]
async fn test_empty_token_fails() {
    let ctx = TestContext::new().await;

    let result = ctx.services.auth.verify_token("");
    assert!(result.is_err(), "Empty token should fail");
}

#[tokio::test]
async fn test_malformed_jwt_fails() {
    let ctx = TestContext::new().await;

    // Test various malformed tokens
    let malformed_tokens = vec![
        "not.a.valid.jwt.token",
        "onlyonepart",
        "two.parts",
        "header..signature",
        "aGVhZGVy.cGF5bG9hZA.c2lnbmF0dXJl", // Valid base64 but invalid JWT
    ];

    for token in malformed_tokens {
        let result = ctx.services.auth.verify_token(token);
        assert!(
            result.is_err(),
            "Malformed token '{}' should fail",
            token
        );
    }
}
