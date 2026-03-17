use axum::{Json, Extension};
use serde::Serialize;
use std::sync::Arc;

use crate::error::AppError;
use crate::services::Services;

#[derive(Serialize)]
pub struct PlatformStats {
    pub total_jobs: i64,
    pub total_agents: i64,
    pub online_agents: i64,
    pub total_escrow: f64,
    pub completion_rate: f64,
    pub active_jobs: i64,
    pub total_bids: i64,
}

pub async fn get_platform_stats(
    Extension(services): Extension<Arc<Services>>,
) -> Result<Json<PlatformStats>, AppError> {
    // Get total jobs count
    let total_jobs: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM jobs WHERE status != 'DRAFT'"
    )
    .fetch_one(&services.db)
    .await
    .unwrap_or((0,));

    // Get active jobs count
    let active_jobs: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM jobs WHERE status IN ('OPEN', 'BIDDING', 'IN_PROGRESS')"
    )
    .fetch_one(&services.db)
    .await
    .unwrap_or((0,));

    // Get total agents count
    let total_agents: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM agents WHERE status = 'ACTIVE'"
    )
    .fetch_one(&services.db)
    .await
    .unwrap_or((0,));

    // Get online agents (active in last 5 minutes)
    let online_agents: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM agents WHERE status = 'ACTIVE' AND last_seen_at > NOW() - INTERVAL '5 minutes'"
    )
    .fetch_one(&services.db)
    .await
    .unwrap_or((0,));

    // Get total escrow amount
    let total_escrow: (Option<rust_decimal::Decimal>,) = sqlx::query_as(
        "SELECT COALESCE(SUM(amount), 0) FROM escrow_accounts WHERE status IN ('FUNDED', 'LOCKED')"
    )
    .fetch_one(&services.db)
    .await
    .unwrap_or((None,));

    // Get completion rate
    let completed_jobs: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM jobs WHERE status = 'COMPLETED'"
    )
    .fetch_one(&services.db)
    .await
    .unwrap_or((0,));

    let total_finished: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM jobs WHERE status IN ('COMPLETED', 'CANCELLED', 'DISPUTED')"
    )
    .fetch_one(&services.db)
    .await
    .unwrap_or((0,));

    let completion_rate = if total_finished.0 > 0 {
        (completed_jobs.0 as f64 / total_finished.0 as f64) * 100.0
    } else {
        99.0 // Default rate when no data
    };

    // Get total bids
    let total_bids: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM bids"
    )
    .fetch_one(&services.db)
    .await
    .unwrap_or((0,));

    let escrow_amount = total_escrow.0
        .map(|d| d.to_string().parse::<f64>().unwrap_or(0.0))
        .unwrap_or(0.0);

    Ok(Json(PlatformStats {
        total_jobs: total_jobs.0,
        total_agents: total_agents.0,
        online_agents: online_agents.0,
        total_escrow: escrow_amount,
        completion_rate,
        active_jobs: active_jobs.0,
        total_bids: total_bids.0,
    }))
}
