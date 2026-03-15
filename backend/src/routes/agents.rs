use crate::error::{AppError, Result};
use crate::models::{
    Agent, AgentListQuery, AgentListResponse, AgentWithReputation, RegisterAgent,
    RegisterAgentResponse, GeneratedWalletResponse,
};
use crate::services::{AuthService, Services, WalletService};
use axum::{
    extract::{Path, Query},
    Extension, Json,
};
use rust_decimal::Decimal;
use std::sync::Arc;
use uuid::Uuid;

/// List agents with filtering
pub async fn list_agents(
    Extension(services): Extension<Arc<Services>>,
    Query(query): Query<AgentListQuery>,
) -> Result<Json<AgentListResponse>> {
    let page = query.page.unwrap_or(1).max(1);
    let limit = query.limit.unwrap_or(20).min(100);
    let offset = (page - 1) * limit;

    // Build query with filters
    let agents: Vec<Agent> = sqlx::query_as(
        r#"
        SELECT a.* FROM agents a
        LEFT JOIN agent_reputations ar ON a.id = ar.agent_id
        WHERE a.is_active = true
        ORDER BY ar.job_success_score DESC NULLS LAST, a.created_at DESC
        LIMIT $1 OFFSET $2
        "#,
    )
    .bind(limit)
    .bind(offset)
    .fetch_all(&services.db)
    .await?;

    let total: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM agents WHERE is_active = true"
    )
    .fetch_one(&services.db)
    .await?;

    let mut agents_with_rep = Vec::new();
    for agent in agents {
        let reputation = services.reputation.get_agent_reputation(agent.id).await?;
        agents_with_rep.push(AgentWithReputation { agent, reputation });
    }

    Ok(Json(AgentListResponse {
        agents: agents_with_rep,
        total: total.0,
        page,
        limit,
    }))
}

/// Register a new agent (via SDK)
/// If no wallet_address is provided, a new Solana wallet will be generated
pub async fn register_agent(
    Extension(services): Extension<Arc<Services>>,
    Json(input): Json<RegisterAgent>,
) -> Result<Json<RegisterAgentResponse>> {
    // Determine if we need to generate a wallet
    let should_generate = input.generate_wallet.unwrap_or(input.wallet_address.is_none());

    // Generate or use provided wallet
    let (wallet_address, generated_wallet) = if should_generate && input.wallet_address.is_none() {
        // Generate a new Solana wallet
        let wallet = WalletService::generate_keypair();
        let address = wallet.address.clone();
        let response = GeneratedWalletResponse {
            address: wallet.address,
            private_key: wallet.private_key,
            secret_key: wallet.secret_key,
            warning: "IMPORTANT: Save your private key securely! It cannot be recovered. Never share it with anyone.".to_string(),
        };
        (address, Some(response))
    } else if let Some(addr) = &input.wallet_address {
        // Validate provided wallet address (should be 32-44 chars base58)
        if addr.len() < 32 || addr.len() > 44 {
            return Err(AppError::Validation("Invalid wallet address format".to_string()));
        }
        // Verify it's valid base58
        if bs58::decode(addr).into_vec().is_err() {
            return Err(AppError::Validation("Invalid wallet address: not valid base58".to_string()));
        }
        (addr.clone(), None)
    } else {
        return Err(AppError::Validation("Either wallet_address must be provided or generate_wallet must be true".to_string()));
    };

    // Check if agent already exists
    let existing: Option<Agent> = sqlx::query_as(
        "SELECT * FROM agents WHERE wallet_address = $1"
    )
    .bind(&wallet_address)
    .fetch_optional(&services.db)
    .await?;

    if existing.is_some() {
        return Err(AppError::Conflict("Agent already registered with this wallet".to_string()));
    }

    // Generate API key
    let api_key = AuthService::generate_api_key();
    let api_key_hash = AuthService::hash_api_key(&api_key);

    let skills_json = serde_json::to_value(&input.skills)
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let id = Uuid::new_v4();

    let agent = sqlx::query_as::<_, Agent>(
        r#"
        INSERT INTO agents (
            id, wallet_address, api_key_hash, display_name,
            description, skills, trust_tier, is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'new', true)
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(&wallet_address)
    .bind(&api_key_hash)
    .bind(&input.display_name)
    .bind(&input.description)
    .bind(&skills_json)
    .fetch_one(&services.db)
    .await?;

    // Create initial reputation record
    sqlx::query(
        r#"
        INSERT INTO agent_reputations (agent_id, calculated_at)
        VALUES ($1, NOW())
        "#,
    )
    .bind(id)
    .execute(&services.db)
    .await?;

    tracing::info!(
        agent_id = %id,
        wallet = %wallet_address,
        generated = generated_wallet.is_some(),
        "Agent registered successfully"
    );

    Ok(Json(RegisterAgentResponse {
        agent,
        api_key,
        wallet: generated_wallet,
    }))
}

/// Get agent by ID
pub async fn get_agent(
    Extension(services): Extension<Arc<Services>>,
    Path(id): Path<Uuid>,
) -> Result<Json<AgentWithReputation>> {
    let agent = sqlx::query_as::<_, Agent>(
        "SELECT * FROM agents WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&services.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Agent not found".to_string()))?;

    let reputation = services.reputation.get_agent_reputation(id).await?;

    Ok(Json(AgentWithReputation { agent, reputation }))
}

/// Get agent reputation
pub async fn get_agent_reputation(
    Extension(services): Extension<Arc<Services>>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    let reputation = services.reputation.get_agent_reputation(id).await?;

    match reputation {
        Some(rep) => Ok(Json(serde_json::to_value(rep).unwrap())),
        None => {
            let rep = services.reputation.calculate_agent_reputation(id).await?;
            Ok(Json(serde_json::to_value(rep).unwrap()))
        }
    }
}

/// Get agent's portfolio (past completed jobs)
pub async fn get_portfolio(
    Extension(services): Extension<Arc<Services>>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<serde_json::Value>>> {
    let jobs: Vec<(Uuid, String, String, Decimal, chrono::DateTime<chrono::Utc>)> =
        sqlx::query_as(
            r#"
            SELECT j.id, j.title, j.task_type, j.final_price, j.completed_at
            FROM jobs j
            WHERE j.agent_id = $1 AND j.status = 'completed'
            ORDER BY j.completed_at DESC
            LIMIT 20
            "#,
        )
        .bind(id)
        .fetch_all(&services.db)
        .await?;

    let portfolio: Vec<serde_json::Value> = jobs
        .into_iter()
        .map(|(id, title, task_type, price, completed_at)| {
            serde_json::json!({
                "job_id": id,
                "title": title,
                "task_type": task_type,
                "price": price.to_string(),
                "completed_at": completed_at
            })
        })
        .collect();

    Ok(Json(portfolio))
}
