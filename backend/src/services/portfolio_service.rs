use crate::error::{AppError, Result};
use crate::models::{
    CreatePortfolioItem, PortfolioItem, PortfolioListParams, PortfolioListResponse,
    UpdatePortfolioItem, MAX_PORTFOLIO_ITEMS_PER_AGENT,
};
use sqlx::PgPool;
use uuid::Uuid;
use validator::Validate;

#[derive(Clone)]
pub struct PortfolioService {
    db: PgPool,
}

impl PortfolioService {
    pub fn new(db: PgPool) -> Self {
        Self { db }
    }

    /// Create a portfolio item
    pub async fn create(&self, agent_id: Uuid, input: CreatePortfolioItem) -> Result<PortfolioItem> {
        // Validate input
        input.validate().map_err(|e| {
            AppError::Validation(format!("Invalid input: {}", e))
        })?;

        // Check portfolio item limit
        let count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM portfolio_items WHERE agent_id = $1"
        )
        .bind(agent_id)
        .fetch_one(&self.db)
        .await?;

        if count.0 >= MAX_PORTFOLIO_ITEMS_PER_AGENT {
            return Err(AppError::BadRequest(format!(
                "Maximum portfolio items limit reached ({}). Please delete some items first.",
                MAX_PORTFOLIO_ITEMS_PER_AGENT
            )));
        }

        // If linked to a job, get testimonial and rating
        let (client_testimonial, client_rating): (Option<String>, Option<rust_decimal::Decimal>) =
            if let Some(job_id) = input.job_id {
                // Get rating from the job
                let rating: Option<(Option<String>, i32)> = sqlx::query_as(
                    r#"
                    SELECT review_text, overall
                    FROM ratings
                    WHERE job_id = $1 AND ratee_type = 'agent' AND ratee_id = $2
                    "#,
                )
                .bind(job_id)
                .bind(agent_id)
                .fetch_optional(&self.db)
                .await?;

                match rating {
                    Some((text, score)) => (text, Some(rust_decimal::Decimal::from(score))),
                    None => (None, None),
                }
            } else {
                (None, None)
            };

        let item = sqlx::query_as::<_, PortfolioItem>(
            r#"
            INSERT INTO portfolio_items (
                agent_id, job_id, title, description, category,
                thumbnail_url, demo_url, github_url, client_testimonial,
                client_rating, is_featured
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
            "#,
        )
        .bind(agent_id)
        .bind(input.job_id)
        .bind(&input.title)
        .bind(&input.description)
        .bind(&input.category)
        .bind(&input.thumbnail_url)
        .bind(&input.demo_url)
        .bind(&input.github_url)
        .bind(&client_testimonial)
        .bind(client_rating)
        .bind(input.is_featured)
        .fetch_one(&self.db)
        .await?;

        Ok(item)
    }

    /// List portfolio items for an agent
    pub async fn list_for_agent(
        &self,
        agent_id: Uuid,
        params: PortfolioListParams,
    ) -> Result<PortfolioListResponse> {
        let limit = params.limit.unwrap_or(20).min(50);
        let offset = params.offset.unwrap_or(0);

        let items: Vec<PortfolioItem> = match (params.category, params.featured_only) {
            (Some(category), Some(true)) => {
                sqlx::query_as(
                    r#"
                    SELECT * FROM portfolio_items
                    WHERE agent_id = $1 AND category = $2 AND is_featured = true
                    ORDER BY is_featured DESC, created_at DESC
                    LIMIT $3 OFFSET $4
                    "#,
                )
                .bind(agent_id)
                .bind(&category)
                .bind(limit)
                .bind(offset)
                .fetch_all(&self.db)
                .await?
            }
            (Some(category), _) => {
                sqlx::query_as(
                    r#"
                    SELECT * FROM portfolio_items
                    WHERE agent_id = $1 AND category = $2
                    ORDER BY is_featured DESC, created_at DESC
                    LIMIT $3 OFFSET $4
                    "#,
                )
                .bind(agent_id)
                .bind(&category)
                .bind(limit)
                .bind(offset)
                .fetch_all(&self.db)
                .await?
            }
            (None, Some(true)) => {
                sqlx::query_as(
                    r#"
                    SELECT * FROM portfolio_items
                    WHERE agent_id = $1 AND is_featured = true
                    ORDER BY created_at DESC
                    LIMIT $2 OFFSET $3
                    "#,
                )
                .bind(agent_id)
                .bind(limit)
                .bind(offset)
                .fetch_all(&self.db)
                .await?
            }
            (None, _) => {
                sqlx::query_as(
                    r#"
                    SELECT * FROM portfolio_items
                    WHERE agent_id = $1
                    ORDER BY is_featured DESC, created_at DESC
                    LIMIT $2 OFFSET $3
                    "#,
                )
                .bind(agent_id)
                .bind(limit)
                .bind(offset)
                .fetch_all(&self.db)
                .await?
            }
        };

        let total: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM portfolio_items WHERE agent_id = $1"
        )
        .bind(agent_id)
        .fetch_one(&self.db)
        .await?;

        Ok(PortfolioListResponse {
            items,
            total: total.0,
        })
    }

    /// Get a single portfolio item
    pub async fn get_by_id(&self, id: Uuid) -> Result<PortfolioItem> {
        sqlx::query_as::<_, PortfolioItem>("SELECT * FROM portfolio_items WHERE id = $1")
            .bind(id)
            .fetch_optional(&self.db)
            .await?
            .ok_or_else(|| AppError::NotFound("Portfolio item not found".to_string()))
    }

    /// Update a portfolio item
    pub async fn update(&self, id: Uuid, input: UpdatePortfolioItem) -> Result<PortfolioItem> {
        // Validate input
        input.validate().map_err(|e| {
            AppError::Validation(format!("Invalid input: {}", e))
        })?;

        let item = sqlx::query_as::<_, PortfolioItem>(
            r#"
            UPDATE portfolio_items SET
                title = COALESCE($2, title),
                description = COALESCE($3, description),
                category = COALESCE($4, category),
                thumbnail_url = COALESCE($5, thumbnail_url),
                demo_url = COALESCE($6, demo_url),
                github_url = COALESCE($7, github_url),
                is_featured = COALESCE($8, is_featured),
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(&input.title)
        .bind(&input.description)
        .bind(&input.category)
        .bind(&input.thumbnail_url)
        .bind(&input.demo_url)
        .bind(&input.github_url)
        .bind(input.is_featured)
        .fetch_one(&self.db)
        .await
        .map_err(|_| AppError::NotFound("Portfolio item not found".to_string()))?;

        Ok(item)
    }

    /// Delete a portfolio item
    pub async fn delete(&self, id: Uuid) -> Result<()> {
        let result = sqlx::query("DELETE FROM portfolio_items WHERE id = $1")
            .bind(id)
            .execute(&self.db)
            .await?;

        if result.rows_affected() == 0 {
            return Err(AppError::NotFound("Portfolio item not found".to_string()));
        }

        Ok(())
    }

    /// Check if agent owns portfolio item
    pub async fn agent_owns_item(&self, item_id: Uuid, agent_id: Uuid) -> Result<bool> {
        let item: Option<(Uuid,)> = sqlx::query_as(
            "SELECT agent_id FROM portfolio_items WHERE id = $1"
        )
        .bind(item_id)
        .fetch_optional(&self.db)
        .await?;

        match item {
            None => Err(AppError::NotFound("Portfolio item not found".to_string())),
            Some((owner_id,)) => Ok(owner_id == agent_id),
        }
    }

    /// Auto-create portfolio item from completed job
    pub async fn create_from_job(
        &self,
        agent_id: Uuid,
        job_id: Uuid,
    ) -> Result<Option<PortfolioItem>> {
        // Get job details
        let job: Option<(String, String, String)> = sqlx::query_as(
            "SELECT title, description, task_type FROM jobs WHERE id = $1 AND status = 'completed'"
        )
        .bind(job_id)
        .fetch_optional(&self.db)
        .await?;

        let Some((title, description, task_type)) = job else {
            return Ok(None);
        };

        let input = CreatePortfolioItem {
            job_id: Some(job_id),
            title,
            description: Some(description),
            category: Some(task_type),
            thumbnail_url: None,
            demo_url: None,
            github_url: None,
            is_featured: false,
        };

        let item = self.create(agent_id, input).await?;
        Ok(Some(item))
    }
}
