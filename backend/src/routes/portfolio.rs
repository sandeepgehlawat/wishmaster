use crate::error::Result;
use crate::middleware::AuthUser;
use crate::models::{
    CreatePortfolioItem, PortfolioItem, PortfolioListParams, PortfolioListResponse,
    UpdatePortfolioItem,
};
use crate::services::Services;
use axum::{
    extract::{Path, Query},
    Extension, Json,
};
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

/// List portfolio items for an agent (public)
pub async fn list_portfolio(
    Extension(services): Extension<Arc<Services>>,
    Path(agent_id): Path<Uuid>,
    Query(params): Query<PortfolioListParams>,
) -> Result<Json<PortfolioListResponse>> {
    let response = services.portfolio.list_for_agent(agent_id, params).await?;
    Ok(Json(response))
}

/// Get a single portfolio item (public)
pub async fn get_portfolio_item(
    Extension(services): Extension<Arc<Services>>,
    Path(id): Path<Uuid>,
) -> Result<Json<PortfolioItem>> {
    let item = services.portfolio.get_by_id(id).await?;
    Ok(Json(item))
}

/// Create a portfolio item (agent only)
pub async fn create_portfolio_item(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Json(input): Json<CreatePortfolioItem>,
) -> Result<Json<PortfolioItem>> {
    if auth.user_type != "agent" {
        return Err(crate::error::AppError::Forbidden(
            "Only agents can create portfolio items".to_string(),
        ));
    }

    let item = services.portfolio.create(auth.id, input).await?;
    Ok(Json(item))
}

/// Update a portfolio item (agent only)
pub async fn update_portfolio_item(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdatePortfolioItem>,
) -> Result<Json<PortfolioItem>> {
    if auth.user_type != "agent" {
        return Err(crate::error::AppError::Forbidden(
            "Only agents can update portfolio items".to_string(),
        ));
    }

    if !services.portfolio.agent_owns_item(id, auth.id).await? {
        return Err(crate::error::AppError::Forbidden(
            "Not your portfolio item".to_string(),
        ));
    }

    let item = services.portfolio.update(id, input).await?;
    Ok(Json(item))
}

/// Delete a portfolio item (agent only)
pub async fn delete_portfolio_item(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    if auth.user_type != "agent" {
        return Err(crate::error::AppError::Forbidden(
            "Only agents can delete portfolio items".to_string(),
        ));
    }

    if !services.portfolio.agent_owns_item(id, auth.id).await? {
        return Err(crate::error::AppError::Forbidden(
            "Not your portfolio item".to_string(),
        ));
    }

    services.portfolio.delete(id).await?;
    Ok(Json(json!({ "deleted": true })))
}

/// Create portfolio item from completed job (agent only)
pub async fn create_from_job(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(job_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    if auth.user_type != "agent" {
        return Err(crate::error::AppError::Forbidden(
            "Only agents can create portfolio items".to_string(),
        ));
    }

    let item = services.portfolio.create_from_job(auth.id, job_id).await?;

    match item {
        Some(item) => Ok(Json(json!({ "created": true, "item": item }))),
        None => Err(crate::error::AppError::BadRequest(
            "Job not found or not completed".to_string(),
        )),
    }
}
