use axum::{response::IntoResponse, Extension, Json};
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use tokio::sync::RwLock;

use crate::services::Services;

/// Simple metrics collector
#[derive(Default)]
pub struct Metrics {
    pub requests_total: AtomicU64,
    pub requests_success: AtomicU64,
    pub requests_error: AtomicU64,
    pub active_connections: AtomicU64,
}

impl Metrics {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn inc_requests(&self) {
        self.requests_total.fetch_add(1, Ordering::Relaxed);
    }

    pub fn inc_success(&self) {
        self.requests_success.fetch_add(1, Ordering::Relaxed);
    }

    pub fn inc_error(&self) {
        self.requests_error.fetch_add(1, Ordering::Relaxed);
    }
}

/// GET /metrics - Prometheus-compatible metrics endpoint
pub async fn metrics(Extension(services): Extension<Arc<Services>>) -> impl IntoResponse {
    // Query some basic stats from the database
    let job_stats = get_job_stats(&services).await;
    let agent_stats = get_agent_stats(&services).await;

    // Build Prometheus-style metrics
    let mut output = String::new();

    // Job metrics
    output.push_str("# HELP agenthive_jobs_total Total number of jobs by status\n");
    output.push_str("# TYPE agenthive_jobs_total gauge\n");
    for (status, count) in &job_stats {
        output.push_str(&format!(
            "agenthive_jobs_total{{status=\"{}\"}} {}\n",
            status, count
        ));
    }

    // Agent metrics
    output.push_str("\n# HELP agenthive_agents_total Total number of agents by tier\n");
    output.push_str("# TYPE agenthive_agents_total gauge\n");
    for (tier, count) in &agent_stats {
        output.push_str(&format!(
            "agenthive_agents_total{{tier=\"{}\"}} {}\n",
            tier, count
        ));
    }

    // Cache status
    output.push_str("\n# HELP agenthive_cache_available Whether Redis cache is available\n");
    output.push_str("# TYPE agenthive_cache_available gauge\n");
    output.push_str(&format!(
        "agenthive_cache_available {}\n",
        if services.cache.is_available() { 1 } else { 0 }
    ));

    (
        [(axum::http::header::CONTENT_TYPE, "text/plain; charset=utf-8")],
        output
    )
}

async fn get_job_stats(services: &Services) -> Vec<(String, i64)> {
    let result: Result<Vec<(String, i64)>, _> = sqlx::query_as(
        "SELECT status, COUNT(*) as count FROM jobs GROUP BY status"
    )
    .fetch_all(&services.db)
    .await;

    result.unwrap_or_default()
}

async fn get_agent_stats(services: &Services) -> Vec<(String, i64)> {
    let result: Result<Vec<(String, i64)>, _> = sqlx::query_as(
        "SELECT trust_tier, COUNT(*) as count FROM agents WHERE is_active = true GROUP BY trust_tier"
    )
    .fetch_all(&services.db)
    .await;

    result.unwrap_or_default()
}

/// GET /health/ready - Readiness probe for Kubernetes
pub async fn readiness(Extension(services): Extension<Arc<Services>>) -> impl IntoResponse {
    // Check database connection
    let db_ok = sqlx::query("SELECT 1")
        .fetch_one(&services.db)
        .await
        .is_ok();

    // Check Redis if configured
    let redis_ok = if let Some(ref client) = services.redis {
        client.get_connection().is_ok()
    } else {
        true // Redis is optional
    };

    if db_ok && redis_ok {
        Json(serde_json::json!({
            "status": "ready",
            "database": "ok",
            "redis": if services.redis.is_some() { "ok" } else { "not_configured" }
        }))
    } else {
        Json(serde_json::json!({
            "status": "not_ready",
            "database": if db_ok { "ok" } else { "error" },
            "redis": if redis_ok { "ok" } else { "error" }
        }))
    }
}

/// GET /health/live - Liveness probe for Kubernetes
pub async fn liveness() -> impl IntoResponse {
    Json(serde_json::json!({
        "status": "alive"
    }))
}
