//! Paid API endpoints - require x402 payment to access
//!
//! These endpoints are protected by the x402 middleware which requires
//! payment proof before allowing access.

use axum::{
    Extension,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::error::Result;
use crate::services::Services;
use crate::middleware::auth::AuthUser;

/// Response for compute task
#[derive(Debug, Serialize)]
pub struct ComputeResponse {
    pub task_id: String,
    pub result: String,
    pub credits_used: f64,
}

/// Response for data query
#[derive(Debug, Serialize)]
pub struct DataQueryResponse {
    pub query_id: String,
    pub data: serde_json::Value,
    pub records_returned: usize,
    pub credits_used: f64,
}

/// Response for analysis task
#[derive(Debug, Serialize)]
pub struct AnalysisResponse {
    pub analysis_id: String,
    pub summary: String,
    pub insights: Vec<String>,
    pub credits_used: f64,
}

/// Request for compute task
#[derive(Debug, Deserialize)]
pub struct ComputeRequest {
    pub task_type: String,
    pub parameters: serde_json::Value,
}

/// Request for data query
#[derive(Debug, Deserialize)]
pub struct DataQueryRequest {
    pub query: String,
    pub filters: Option<serde_json::Value>,
}

/// Request for analysis
#[derive(Debug, Deserialize)]
pub struct AnalysisRequest {
    pub target: String,
    pub analysis_type: String,
}

/// Execute a compute task (requires $10 payment)
/// POST /api/agent/paid/compute
pub async fn execute_compute(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Json(request): Json<ComputeRequest>,
) -> Result<Json<ComputeResponse>> {
    tracing::info!(
        agent_id = %auth.id,
        task_type = %request.task_type,
        "Executing paid compute task"
    );

    // Simulate compute task execution
    let task_id = Uuid::new_v4().to_string();

    // In production, this would execute actual compute logic
    let result = format!(
        "Computed {} with parameters: {}",
        request.task_type,
        request.parameters
    );

    Ok(Json(ComputeResponse {
        task_id,
        result,
        credits_used: 10.0,
    }))
}

/// Query data (requires $5 payment)
/// POST /api/agent/paid/data/query
pub async fn query_data(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Json(request): Json<DataQueryRequest>,
) -> Result<Json<DataQueryResponse>> {
    tracing::info!(
        agent_id = %auth.id,
        query = %request.query,
        "Executing paid data query"
    );

    let query_id = Uuid::new_v4().to_string();

    // Simulate data query - in production this would query actual data sources
    let sample_data = serde_json::json!({
        "results": [
            {"id": 1, "value": "sample_data_1"},
            {"id": 2, "value": "sample_data_2"},
        ]
    });

    Ok(Json(DataQueryResponse {
        query_id,
        data: sample_data,
        records_returned: 2,
        credits_used: 5.0,
    }))
}

/// Run analysis (requires $7.50 payment)
/// POST /api/agent/paid/analysis
pub async fn run_analysis(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Json(request): Json<AnalysisRequest>,
) -> Result<Json<AnalysisResponse>> {
    tracing::info!(
        agent_id = %auth.id,
        target = %request.target,
        analysis_type = %request.analysis_type,
        "Executing paid analysis"
    );

    let analysis_id = Uuid::new_v4().to_string();

    // Simulate analysis - in production this would run actual analysis
    let summary = format!(
        "Analysis of {} using {} method completed",
        request.target,
        request.analysis_type
    );

    let insights = vec![
        "Insight 1: Pattern detected in data".to_string(),
        "Insight 2: Anomaly found at timestamp X".to_string(),
        "Insight 3: Correlation with market events".to_string(),
    ];

    Ok(Json(AnalysisResponse {
        analysis_id,
        summary,
        insights,
        credits_used: 7.5,
    }))
}

/// Health check for paid API (requires $1 payment - for testing)
/// GET /api/agent/paid/health
pub async fn paid_health_check(
    Extension(auth): Extension<AuthUser>,
) -> Result<Json<serde_json::Value>> {
    Ok(Json(serde_json::json!({
        "status": "ok",
        "message": "Payment verified successfully",
        "agent_id": auth.id.to_string(),
        "credits_used": 1.0
    })))
}
