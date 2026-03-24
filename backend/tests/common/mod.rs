//! Common test utilities and fixtures for WishMaster backend tests.
//!
//! This module provides:
//! - Test database setup and cleanup
//! - Mock user and agent creation helpers
//! - Test app builder for route testing
//! - Common fixtures and test data generators

#![allow(dead_code)]

use axum::{
    body::Body,
    http::{header, Method, Request, StatusCode},
};
use serde_json::Value;
use sqlx::{postgres::PgPoolOptions, PgPool};
use std::sync::Arc;
use tokio::sync::OnceCell;
use uuid::Uuid;
use wishmaster_backend::{
    config::Config,
    services::{AuthService, Services},
};

// ============================================================================
// Test Configuration
// ============================================================================

/// Test configuration with safe defaults.
/// Uses environment variables if available, falls back to test defaults.
pub fn test_config() -> Config {
    Config {
        server_addr: "127.0.0.1:3001".to_string(),
        database_url: std::env::var("TEST_DATABASE_URL")
            .unwrap_or_else(|_| "postgres://postgres:postgres@localhost:5432/wishmaster_test".to_string()),
        db_max_connections: 5,
        redis_url: None,
        jwt_secret: "test_secret_key_for_testing_purposes_min_32_chars".to_string(),
        jwt_expiry_hours: 24,
        evm_rpc_url: "https://testrpc.xlayer.tech".to_string(),
        chain_id: Some(1952),
        escrow_contract_address: Some("0x0000000000000000000000000000000000000001".to_string()),
        usdc_token_address: "0x0000000000000000000000000000000000000002".to_string(),
        platform_wallet: "0x0000000000000000000000000000000000000003".to_string(),
        identity_registry_address: None,
        reputation_registry_address: None,
        validation_registry_address: None,
        okx_api_key: None,
        okx_api_secret: None,
        okx_passphrase: None,
        fee_new_agent_bps: 1500,
        fee_rising_agent_bps: 1200,
        fee_established_agent_bps: 1000,
        fee_top_rated_agent_bps: 800,
        cors_allowed_origins: vec!["http://localhost:3000".to_string()],
        rate_limit_requests_per_minute: 60,
        rate_limit_burst: 10,
    }
}

// ============================================================================
// Database Setup
// ============================================================================

/// Global test database pool (created once per test run).
static TEST_DB_POOL: OnceCell<PgPool> = OnceCell::const_new();

/// Initialize the test database pool.
/// This creates the pool once and reuses it across all tests.
pub async fn init_test_db() -> PgPool {
    TEST_DB_POOL
        .get_or_init(|| async {
            let config = test_config();
            let pool = PgPoolOptions::new()
                .max_connections(config.db_max_connections)
                .connect(&config.database_url)
                .await
                .expect("Failed to connect to test database. Make sure TEST_DATABASE_URL is set or default database exists.");

            // Run migrations
            sqlx::migrate!("./migrations")
                .run(&pool)
                .await
                .expect("Failed to run migrations on test database");

            pool
        })
        .await
        .clone()
}

/// Test context that holds database pool and services.
/// Use this for tests that need database access.
pub struct TestContext {
    pub pool: PgPool,
    pub services: Arc<Services>,
    pub config: Config,
}

impl TestContext {
    /// Create a new test context with a fresh database connection.
    pub async fn new() -> Self {
        let pool = init_test_db().await;
        let config = test_config();
        let services = Arc::new(Services::new(pool.clone(), None, config.clone()));

        Self {
            pool,
            services,
            config,
        }
    }

    /// Clean up test data after test.
    /// Call this in test teardown if needed.
    pub async fn cleanup(&self) {
        // Delete in reverse order of dependencies
        let _ = sqlx::query("DELETE FROM ratings WHERE id IN (SELECT id FROM ratings WHERE created_at > NOW() - INTERVAL '1 hour')")
            .execute(&self.pool)
            .await;
        let _ = sqlx::query("DELETE FROM messages WHERE id IN (SELECT id FROM messages WHERE created_at > NOW() - INTERVAL '1 hour')")
            .execute(&self.pool)
            .await;
        let _ = sqlx::query("DELETE FROM deliverables WHERE id IN (SELECT id FROM deliverables WHERE created_at > NOW() - INTERVAL '1 hour')")
            .execute(&self.pool)
            .await;
        let _ = sqlx::query("DELETE FROM requirements WHERE id IN (SELECT id FROM requirements WHERE created_at > NOW() - INTERVAL '1 hour')")
            .execute(&self.pool)
            .await;
        let _ = sqlx::query("DELETE FROM escrows WHERE id IN (SELECT id FROM escrows WHERE created_at > NOW() - INTERVAL '1 hour')")
            .execute(&self.pool)
            .await;
        let _ = sqlx::query("DELETE FROM bids WHERE id IN (SELECT id FROM bids WHERE created_at > NOW() - INTERVAL '1 hour')")
            .execute(&self.pool)
            .await;
        let _ = sqlx::query("DELETE FROM jobs WHERE id IN (SELECT id FROM jobs WHERE created_at > NOW() - INTERVAL '1 hour')")
            .execute(&self.pool)
            .await;
        let _ = sqlx::query("DELETE FROM agent_reputation WHERE agent_id IN (SELECT id FROM agents WHERE created_at > NOW() - INTERVAL '1 hour')")
            .execute(&self.pool)
            .await;
        let _ = sqlx::query("DELETE FROM agents WHERE id IN (SELECT id FROM agents WHERE created_at > NOW() - INTERVAL '1 hour')")
            .execute(&self.pool)
            .await;
        let _ = sqlx::query("DELETE FROM client_reputation WHERE user_id IN (SELECT id FROM users WHERE created_at > NOW() - INTERVAL '1 hour')")
            .execute(&self.pool)
            .await;
        let _ = sqlx::query("DELETE FROM users WHERE id IN (SELECT id FROM users WHERE created_at > NOW() - INTERVAL '1 hour')")
            .execute(&self.pool)
            .await;
    }
}

// ============================================================================
// Test Data Generators
// ============================================================================

/// Generate a random EVM wallet address for testing.
pub fn random_wallet_address() -> String {
    format!("0x{}", hex::encode(Uuid::new_v4().as_bytes())[..40].to_string())
}

/// Test user creation input.
pub struct TestUserInput {
    pub wallet_address: String,
    pub display_name: String,
    pub email: Option<String>,
    pub company_name: Option<String>,
}

impl Default for TestUserInput {
    fn default() -> Self {
        Self {
            wallet_address: random_wallet_address(),
            display_name: format!("Test User {}", Uuid::new_v4().to_string()[..8].to_string()),
            email: Some(format!("test-{}@example.com", Uuid::new_v4().to_string()[..8].to_string())),
            company_name: Some("Test Company".to_string()),
        }
    }
}

/// Test agent creation input.
pub struct TestAgentInput {
    pub wallet_address: String,
    pub display_name: String,
    pub description: Option<String>,
    pub skills: Vec<String>,
}

impl Default for TestAgentInput {
    fn default() -> Self {
        Self {
            wallet_address: random_wallet_address(),
            display_name: format!("Test Agent {}", Uuid::new_v4().to_string()[..8].to_string()),
            description: Some("A test agent for integration testing".to_string()),
            skills: vec!["coding".to_string(), "research".to_string()],
        }
    }
}

/// Test job creation input.
pub struct TestJobInput {
    pub title: String,
    pub description: String,
    pub task_type: String,
    pub required_skills: Vec<String>,
    pub complexity: String,
    pub budget_min: f64,
    pub budget_max: f64,
    pub urgency: String,
}

impl Default for TestJobInput {
    fn default() -> Self {
        Self {
            title: format!("Test Job {}", Uuid::new_v4().to_string()[..8].to_string()),
            description: "This is a test job for integration testing.".to_string(),
            task_type: "coding".to_string(),
            required_skills: vec!["rust".to_string(), "testing".to_string()],
            complexity: "moderate".to_string(),
            budget_min: 100.0,
            budget_max: 500.0,
            urgency: "standard".to_string(),
        }
    }
}

// ============================================================================
// Database Helpers
// ============================================================================

/// Result of creating a test user.
pub struct CreatedUser {
    pub id: Uuid,
    pub wallet_address: String,
    pub display_name: String,
    pub jwt_token: String,
}

/// Create a test user in the database and return their JWT token.
pub async fn create_test_user(ctx: &TestContext, input: Option<TestUserInput>) -> CreatedUser {
    let input = input.unwrap_or_default();
    let id = Uuid::new_v4();

    sqlx::query(
        r#"
        INSERT INTO users (id, wallet_address, display_name, email, company_name)
        VALUES ($1, $2, $3, $4, $5)
        "#,
    )
    .bind(id)
    .bind(&input.wallet_address)
    .bind(&input.display_name)
    .bind(&input.email)
    .bind(&input.company_name)
    .execute(&ctx.pool)
    .await
    .expect("Failed to create test user");

    let jwt_token = ctx
        .services
        .auth
        .create_user_token(id, &input.wallet_address)
        .expect("Failed to create JWT token");

    CreatedUser {
        id,
        wallet_address: input.wallet_address,
        display_name: input.display_name,
        jwt_token,
    }
}

/// Result of creating a test agent.
pub struct CreatedAgent {
    pub id: Uuid,
    pub wallet_address: String,
    pub display_name: String,
    pub api_key: String,
    pub api_key_hash: String,
    pub jwt_token: String,
}

/// Create a test agent in the database and return their API key and JWT token.
pub async fn create_test_agent(ctx: &TestContext, input: Option<TestAgentInput>) -> CreatedAgent {
    let input = input.unwrap_or_default();
    let id = Uuid::new_v4();
    let api_key = AuthService::generate_api_key();
    let api_key_hash = AuthService::hash_api_key(&api_key);
    let skills_json = serde_json::to_value(&input.skills).unwrap();

    sqlx::query(
        r#"
        INSERT INTO agents (id, wallet_address, api_key_hash, display_name, description, skills, trust_tier, is_active, is_sandbox_required, security_deposit_usdc)
        VALUES ($1, $2, $3, $4, $5, $6, 'new', true, true, 0)
        "#,
    )
    .bind(id)
    .bind(&input.wallet_address)
    .bind(&api_key_hash)
    .bind(&input.display_name)
    .bind(&input.description)
    .bind(&skills_json)
    .execute(&ctx.pool)
    .await
    .expect("Failed to create test agent");

    let jwt_token = ctx
        .services
        .auth
        .create_agent_token(id, &input.wallet_address)
        .expect("Failed to create agent JWT token");

    CreatedAgent {
        id,
        wallet_address: input.wallet_address,
        display_name: input.display_name,
        api_key,
        api_key_hash,
        jwt_token,
    }
}

/// Result of creating a test job.
pub struct CreatedJob {
    pub id: Uuid,
    pub title: String,
    pub status: String,
}

/// Create a test job in the database.
pub async fn create_test_job(
    ctx: &TestContext,
    client_id: Uuid,
    input: Option<TestJobInput>,
) -> CreatedJob {
    let input = input.unwrap_or_default();
    let id = Uuid::new_v4();
    let skills_json = serde_json::to_value(&input.required_skills).unwrap();

    sqlx::query(
        r#"
        INSERT INTO jobs (id, client_id, creator_type, title, description, task_type, required_skills, complexity, budget_min, budget_max, urgency, status, pricing_model)
        VALUES ($1, $2, 'client', $3, $4, $5, $6, $7, $8, $9, $10, 'draft', 'fixed')
        "#,
    )
    .bind(id)
    .bind(client_id)
    .bind(&input.title)
    .bind(&input.description)
    .bind(&input.task_type)
    .bind(&skills_json)
    .bind(&input.complexity)
    .bind(input.budget_min)
    .bind(input.budget_max)
    .bind(&input.urgency)
    .execute(&ctx.pool)
    .await
    .expect("Failed to create test job");

    CreatedJob {
        id,
        title: input.title,
        status: "draft".to_string(),
    }
}

/// Create a test escrow for a job.
pub async fn create_test_escrow(
    ctx: &TestContext,
    job_id: Uuid,
    client_wallet: &str,
    amount: f64,
) -> Uuid {
    let id = Uuid::new_v4();
    let escrow_pda = format!("0x{}", hex::encode(Uuid::new_v4().as_bytes()));

    sqlx::query(
        r#"
        INSERT INTO escrows (id, job_id, escrow_pda, client_wallet, amount_usdc, status)
        VALUES ($1, $2, $3, $4, $5, 'created')
        "#,
    )
    .bind(id)
    .bind(job_id)
    .bind(&escrow_pda)
    .bind(client_wallet.to_lowercase())
    .bind(amount)
    .execute(&ctx.pool)
    .await
    .expect("Failed to create test escrow");

    id
}

/// Update job status directly (for test setup).
pub async fn set_job_status(ctx: &TestContext, job_id: Uuid, status: &str) {
    sqlx::query("UPDATE jobs SET status = $2 WHERE id = $1")
        .bind(job_id)
        .bind(status)
        .execute(&ctx.pool)
        .await
        .expect("Failed to update job status");
}

/// Update escrow status directly (for test setup).
pub async fn set_escrow_status(ctx: &TestContext, job_id: Uuid, status: &str) {
    sqlx::query("UPDATE escrows SET status = $2 WHERE job_id = $1")
        .bind(job_id)
        .bind(status)
        .execute(&ctx.pool)
        .await
        .expect("Failed to update escrow status");
}

// ============================================================================
// HTTP Test Helpers
// ============================================================================

/// Create an authenticated request with JWT bearer token.
pub fn auth_request(method: Method, uri: &str, token: &str) -> Request<Body> {
    Request::builder()
        .method(method)
        .uri(uri)
        .header(header::AUTHORIZATION, format!("Bearer {}", token))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::empty())
        .unwrap()
}

/// Create an authenticated request with JSON body.
pub fn auth_request_with_body(method: Method, uri: &str, token: &str, body: Value) -> Request<Body> {
    Request::builder()
        .method(method)
        .uri(uri)
        .header(header::AUTHORIZATION, format!("Bearer {}", token))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap()
}

/// Create a request with API key authentication.
pub fn api_key_request(method: Method, uri: &str, api_key: &str) -> Request<Body> {
    Request::builder()
        .method(method)
        .uri(uri)
        .header("X-API-Key", api_key)
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::empty())
        .unwrap()
}

/// Create a request with API key and JSON body.
pub fn api_key_request_with_body(
    method: Method,
    uri: &str,
    api_key: &str,
    body: Value,
) -> Request<Body> {
    Request::builder()
        .method(method)
        .uri(uri)
        .header("X-API-Key", api_key)
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap()
}

/// Create a public (unauthenticated) request.
pub fn public_request(method: Method, uri: &str) -> Request<Body> {
    Request::builder()
        .method(method)
        .uri(uri)
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::empty())
        .unwrap()
}

/// Create a public request with JSON body.
pub fn public_request_with_body(method: Method, uri: &str, body: Value) -> Request<Body> {
    Request::builder()
        .method(method)
        .uri(uri)
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap()
}

// ============================================================================
// Response Helpers
// ============================================================================

/// Parse response body as JSON.
pub async fn response_json(response: axum::response::Response) -> Value {
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("Failed to read response body");
    serde_json::from_slice(&body).expect("Failed to parse response as JSON")
}

/// Assert response status code.
pub fn assert_status(response: &axum::response::Response, expected: StatusCode) {
    assert_eq!(
        response.status(),
        expected,
        "Expected status {} but got {}",
        expected,
        response.status()
    );
}

// ============================================================================
// Test Fixtures
// ============================================================================

/// Common test fixtures that can be reused across tests.
pub struct TestFixtures {
    pub user: CreatedUser,
    pub agent: CreatedAgent,
    pub job: CreatedJob,
}

impl TestFixtures {
    /// Create a standard set of test fixtures.
    pub async fn new(ctx: &TestContext) -> Self {
        let user = create_test_user(ctx, None).await;
        let agent = create_test_agent(ctx, None).await;
        let job = create_test_job(ctx, user.id, None).await;

        Self { user, agent, job }
    }
}

// ============================================================================
// Mock HTTP Server Helpers (using wiremock)
// ============================================================================

use serde_json::json;
use wiremock::{Mock, MockServer, ResponseTemplate};
use wiremock::matchers::method;

/// Create a mock EVM RPC server that returns success for transaction receipts.
pub async fn mock_evm_rpc_success() -> MockServer {
    let mock_server = MockServer::start().await;

    Mock::given(method("POST"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "jsonrpc": "2.0",
            "id": 1,
            "result": {
                "status": "0x1",
                "blockNumber": "0x100",
                "transactionHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
            }
        })))
        .mount(&mock_server)
        .await;

    mock_server
}

/// Create a mock EVM RPC server that returns failure for transaction receipts.
pub async fn mock_evm_rpc_failure() -> MockServer {
    let mock_server = MockServer::start().await;

    Mock::given(method("POST"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "jsonrpc": "2.0",
            "id": 1,
            "result": {
                "status": "0x0",
                "blockNumber": "0x100",
                "transactionHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
            }
        })))
        .mount(&mock_server)
        .await;

    mock_server
}

/// Create a mock EVM RPC server that returns transaction not found.
pub async fn mock_evm_rpc_not_found() -> MockServer {
    let mock_server = MockServer::start().await;

    Mock::given(method("POST"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "jsonrpc": "2.0",
            "id": 1,
            "result": null
        })))
        .mount(&mock_server)
        .await;

    mock_server
}
