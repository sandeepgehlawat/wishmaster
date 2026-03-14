use agenthive_sdk::{AgentClient, AgentConfig, JobListQuery, SubmitBidRequest, SdkError};
use uuid::Uuid;
use wiremock::matchers::{header, method, path, path_regex};
use wiremock::{Mock, MockServer, ResponseTemplate};

// ============================================================================
// Configuration Tests
// ============================================================================

#[test]
fn test_config_new() {
    let config = AgentConfig::new("test_api_key".to_string());
    assert_eq!(config.api_key, "test_api_key");
    assert_eq!(config.base_url, "https://api.agenthive.io");
    assert_eq!(config.timeout_secs, 30);
}

#[test]
fn test_config_with_custom_base_url() {
    let config = AgentConfig::new("test_api_key".to_string())
        .with_base_url("http://localhost:3001");
    assert_eq!(config.base_url, "http://localhost:3001");
}

#[test]
fn test_config_with_timeout() {
    let config = AgentConfig::new("test_api_key".to_string())
        .with_timeout(60);
    assert_eq!(config.timeout_secs, 60);
}

#[test]
fn test_config_default() {
    let config = AgentConfig::default();
    assert_eq!(config.api_key, "");
    assert_eq!(config.base_url, "https://api.agenthive.io");
}

// ============================================================================
// Client Creation Tests
// ============================================================================

#[test]
fn test_client_requires_api_key() {
    let config = AgentConfig::default();
    let result = AgentClient::new(config);
    assert!(result.is_err());

    match result.unwrap_err() {
        SdkError::Config(msg) => assert!(msg.contains("API key")),
        _ => panic!("Expected Config error"),
    }
}

#[test]
fn test_client_creation_success() {
    let config = AgentConfig::new("ahk_test_key_123".to_string());
    let result = AgentClient::new(config);
    assert!(result.is_ok());
}

// ============================================================================
// API Request Tests (with mock server)
// ============================================================================

#[tokio::test]
async fn test_list_jobs() {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .and(path("/api/jobs"))
        .and(header("X-API-Key", "test_key"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "jobs": [
                {
                    "id": "550e8400-e29b-41d4-a716-446655440000",
                    "client_id": "550e8400-e29b-41d4-a716-446655440001",
                    "agent_id": null,
                    "title": "Build REST API",
                    "description": "Create a REST API with authentication",
                    "task_type": "coding",
                    "required_skills": ["rust", "postgresql"],
                    "complexity": "moderate",
                    "budget_min": 100.0,
                    "budget_max": 200.0,
                    "final_price": null,
                    "deadline": null,
                    "bid_deadline": null,
                    "urgency": "standard",
                    "status": "open",
                    "created_at": "2024-01-01T00:00:00Z",
                    "client_name": "Test Client",
                    "agent_name": null,
                    "bid_count": 0
                }
            ],
            "total": 1,
            "page": 1,
            "limit": 20
        })))
        .mount(&mock_server)
        .await;

    let config = AgentConfig::new("test_key".to_string())
        .with_base_url(&mock_server.uri());
    let client = AgentClient::new(config).unwrap();

    let jobs = client.list_jobs(None).await.unwrap();
    assert_eq!(jobs.len(), 1);
    assert_eq!(jobs[0].job.title, "Build REST API");
    assert_eq!(jobs[0].job.status, "open");
}

#[tokio::test]
async fn test_list_jobs_with_query() {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .and(path_regex("/api/jobs.*"))
        .and(header("X-API-Key", "test_key"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "jobs": [],
            "total": 0,
            "page": 1,
            "limit": 10
        })))
        .mount(&mock_server)
        .await;

    let config = AgentConfig::new("test_key".to_string())
        .with_base_url(&mock_server.uri());
    let client = AgentClient::new(config).unwrap();

    let query = JobListQuery {
        status: Some("bidding".to_string()),
        task_type: Some("coding".to_string()),
        skills: Some("rust".to_string()),
        min_budget: Some(50.0),
        max_budget: Some(500.0),
        page: Some(1),
        limit: Some(10),
    };

    let jobs = client.list_jobs(Some(query)).await.unwrap();
    assert_eq!(jobs.len(), 0);
}

#[tokio::test]
async fn test_get_job() {
    let mock_server = MockServer::start().await;
    let job_id = Uuid::new_v4();

    Mock::given(method("GET"))
        .and(path(format!("/api/jobs/{}", job_id)))
        .and(header("X-API-Key", "test_key"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "id": job_id.to_string(),
            "client_id": "550e8400-e29b-41d4-a716-446655440001",
            "agent_id": null,
            "title": "Test Job",
            "description": "Test description",
            "task_type": "coding",
            "required_skills": ["rust"],
            "complexity": "simple",
            "budget_min": 50.0,
            "budget_max": 100.0,
            "final_price": null,
            "deadline": null,
            "bid_deadline": null,
            "urgency": "standard",
            "status": "open",
            "created_at": "2024-01-01T00:00:00Z",
            "client_name": "Test Client",
            "agent_name": null,
            "bid_count": 3
        })))
        .mount(&mock_server)
        .await;

    let config = AgentConfig::new("test_key".to_string())
        .with_base_url(&mock_server.uri());
    let client = AgentClient::new(config).unwrap();

    let job = client.get_job(job_id).await.unwrap();
    assert_eq!(job.job.title, "Test Job");
    assert_eq!(job.bid_count, 3);
}

#[tokio::test]
async fn test_get_job_not_found() {
    let mock_server = MockServer::start().await;
    let job_id = Uuid::new_v4();

    Mock::given(method("GET"))
        .and(path(format!("/api/jobs/{}", job_id)))
        .respond_with(ResponseTemplate::new(404))
        .mount(&mock_server)
        .await;

    let config = AgentConfig::new("test_key".to_string())
        .with_base_url(&mock_server.uri());
    let client = AgentClient::new(config).unwrap();

    let result = client.get_job(job_id).await;
    assert!(result.is_err());
    match result.unwrap_err() {
        SdkError::NotFound(_) => {}
        e => panic!("Expected NotFound error, got {:?}", e),
    }
}

#[tokio::test]
async fn test_submit_bid() {
    let mock_server = MockServer::start().await;
    let job_id = Uuid::new_v4();
    let bid_id = Uuid::new_v4();
    let agent_id = Uuid::new_v4();

    Mock::given(method("POST"))
        .and(path(format!("/api/jobs/{}/bids", job_id)))
        .and(header("X-API-Key", "test_key"))
        .respond_with(ResponseTemplate::new(201).set_body_json(serde_json::json!({
            "id": bid_id.to_string(),
            "job_id": job_id.to_string(),
            "agent_id": agent_id.to_string(),
            "bid_amount": 150.0,
            "estimated_hours": 10.0,
            "estimated_completion": null,
            "proposal": "I can build this efficiently",
            "approach": "Start with database schema, then API endpoints",
            "status": "pending",
            "revision_count": 0,
            "created_at": "2024-01-01T00:00:00Z"
        })))
        .mount(&mock_server)
        .await;

    let config = AgentConfig::new("test_key".to_string())
        .with_base_url(&mock_server.uri());
    let client = AgentClient::new(config).unwrap();

    let bid_request = SubmitBidRequest {
        bid_amount: 150.0,
        estimated_hours: Some(10.0),
        estimated_completion: None,
        proposal: "I can build this efficiently".to_string(),
        approach: Some("Start with database schema, then API endpoints".to_string()),
    };

    let bid = client.submit_bid(job_id, bid_request).await.unwrap();
    assert_eq!(bid.bid_amount, 150.0);
    assert_eq!(bid.status, "pending");
}

#[tokio::test]
async fn test_invalid_api_key() {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .and(path("/api/jobs"))
        .respond_with(ResponseTemplate::new(401).set_body_json(serde_json::json!({
            "error": "Invalid API key"
        })))
        .mount(&mock_server)
        .await;

    let config = AgentConfig::new("invalid_key".to_string())
        .with_base_url(&mock_server.uri());
    let client = AgentClient::new(config).unwrap();

    let result = client.list_jobs(None).await;
    assert!(result.is_err());
    match result.unwrap_err() {
        SdkError::Auth(_) => {}
        e => panic!("Expected Auth error, got {:?}", e),
    }
}

#[tokio::test]
async fn test_report_progress() {
    let mock_server = MockServer::start().await;
    let job_id = Uuid::new_v4();

    Mock::given(method("POST"))
        .and(path("/api/sandbox/progress"))
        .and(header("X-API-Key", "test_key"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "success": true
        })))
        .mount(&mock_server)
        .await;

    let config = AgentConfig::new("test_key".to_string())
        .with_base_url(&mock_server.uri());
    let client = AgentClient::new(config).unwrap();

    let update = agenthive_sdk::ProgressUpdate {
        job_id,
        progress_percent: 50,
        status_message: "Halfway done".to_string(),
    };

    let result = client.report_progress(update).await;
    assert!(result.is_ok());
}

#[tokio::test]
async fn test_submit_results() {
    let mock_server = MockServer::start().await;
    let job_id = Uuid::new_v4();

    Mock::given(method("POST"))
        .and(path("/api/sandbox/submit"))
        .and(header("X-API-Key", "test_key"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "success": true
        })))
        .mount(&mock_server)
        .await;

    let config = AgentConfig::new("test_key".to_string())
        .with_base_url(&mock_server.uri());
    let client = AgentClient::new(config).unwrap();

    let results = agenthive_sdk::JobResults {
        job_id,
        results: serde_json::json!({
            "code_url": "https://github.com/example/repo",
            "documentation": "README.md included",
            "tests_passed": true
        }),
    };

    let result = client.submit_results(results).await;
    assert!(result.is_ok());
}

#[tokio::test]
async fn test_heartbeat() {
    let mock_server = MockServer::start().await;
    let job_id = Uuid::new_v4();

    Mock::given(method("POST"))
        .and(path("/api/sandbox/heartbeat"))
        .and(header("X-API-Key", "test_key"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "success": true
        })))
        .mount(&mock_server)
        .await;

    let config = AgentConfig::new("test_key".to_string())
        .with_base_url(&mock_server.uri());
    let client = AgentClient::new(config).unwrap();

    let result = client.heartbeat(job_id).await;
    assert!(result.is_ok());
}

#[tokio::test]
async fn test_get_reputation() {
    let mock_server = MockServer::start().await;
    let agent_id = Uuid::new_v4();

    Mock::given(method("GET"))
        .and(path(format!("/api/agents/{}/reputation", agent_id)))
        .and(header("X-API-Key", "test_key"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "agent_id": agent_id.to_string(),
            "avg_rating": 4.8,
            "total_ratings": 25,
            "completion_rate": 0.96,
            "completed_jobs": 48,
            "job_success_score": 92.5
        })))
        .mount(&mock_server)
        .await;

    let config = AgentConfig::new("test_key".to_string())
        .with_base_url(&mock_server.uri());
    let client = AgentClient::new(config).unwrap();

    let reputation = client.get_reputation(agent_id).await.unwrap();
    assert_eq!(reputation.avg_rating, 4.8);
    assert_eq!(reputation.completed_jobs, 48);
    assert_eq!(reputation.job_success_score, 92.5);
}

// ============================================================================
// Type Tests
// ============================================================================

#[test]
fn test_job_list_query_default() {
    let query = JobListQuery::default();
    assert_eq!(query.status, Some("open".to_string()));
    assert_eq!(query.page, Some(1));
    assert_eq!(query.limit, Some(20));
    assert!(query.task_type.is_none());
    assert!(query.skills.is_none());
}

#[test]
fn test_submit_bid_request_serialization() {
    let bid = SubmitBidRequest {
        bid_amount: 150.0,
        estimated_hours: Some(8.0),
        estimated_completion: None,
        proposal: "Test proposal".to_string(),
        approach: None,
    };

    let json = serde_json::to_string(&bid).unwrap();
    assert!(json.contains("150"));
    assert!(json.contains("Test proposal"));
    // estimated_completion and approach should be skipped when None
    assert!(!json.contains("estimated_completion"));
    assert!(!json.contains("approach"));
}

#[test]
fn test_progress_update_serialization() {
    let update = agenthive_sdk::ProgressUpdate {
        job_id: Uuid::new_v4(),
        progress_percent: 75,
        status_message: "Almost done".to_string(),
    };

    let json = serde_json::to_string(&update).unwrap();
    assert!(json.contains("75"));
    assert!(json.contains("Almost done"));
}
