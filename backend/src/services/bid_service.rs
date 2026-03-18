use crate::error::{AppError, Result};
use crate::models::{Bid, BidListResponse, BidWithAgent, SubmitBid, UpdateBid};
use rust_decimal::Decimal;
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Clone)]
pub struct BidService {
    db: PgPool,
}

impl BidService {
    pub fn new(db: PgPool) -> Self {
        Self { db }
    }

    pub async fn submit(&self, job_id: Uuid, agent_id: Uuid, input: SubmitBid) -> Result<Bid> {
        // Check if agent already has a bid on this job
        let existing: Option<Bid> = sqlx::query_as(
            "SELECT * FROM bids WHERE job_id = $1 AND agent_id = $2 AND status != 'withdrawn'",
        )
        .bind(job_id)
        .bind(agent_id)
        .fetch_optional(&self.db)
        .await?;

        if existing.is_some() {
            return Err(AppError::Conflict(
                "You already have a bid on this job".to_string(),
            ));
        }

        // Validate bid amount against job budget
        let job_budget: (Decimal, Decimal) = sqlx::query_as(
            "SELECT budget_min, budget_max FROM jobs WHERE id = $1 AND status IN ('open', 'bidding')",
        )
        .bind(job_id)
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| AppError::BadRequest("Job not accepting bids".to_string()))?;

        // Allow bids 50% below min to 150% above max
        let min_allowed = job_budget.0.to_string().parse::<f64>().unwrap_or(0.0) * 0.5;
        let max_allowed = job_budget.1.to_string().parse::<f64>().unwrap_or(0.0) * 1.5;

        if input.bid_amount < min_allowed || input.bid_amount > max_allowed {
            return Err(AppError::Validation(format!(
                "Bid must be between ${:.2} and ${:.2}",
                min_allowed, max_allowed
            )));
        }

        let id = Uuid::new_v4();

        let bid = sqlx::query_as::<_, Bid>(
            r#"
            INSERT INTO bids (
                id, job_id, agent_id, bid_amount, estimated_hours,
                estimated_completion, proposal, approach, status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(job_id)
        .bind(agent_id)
        .bind(input.bid_amount)
        .bind(input.estimated_hours)
        .bind(input.estimated_completion)
        .bind(&input.proposal)
        .bind(&input.approach)
        .fetch_one(&self.db)
        .await?;

        // Transition job to bidding if it was open
        sqlx::query("UPDATE jobs SET status = 'bidding' WHERE id = $1 AND status = 'open'")
            .bind(job_id)
            .execute(&self.db)
            .await?;

        Ok(bid)
    }

    pub async fn get(&self, id: Uuid) -> Result<Bid> {
        sqlx::query_as::<_, Bid>("SELECT * FROM bids WHERE id = $1")
            .bind(id)
            .fetch_optional(&self.db)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Bid {} not found", id)))
    }

    pub async fn list_for_job(&self, job_id: Uuid) -> Result<BidListResponse> {
        // Fetch bids first
        let bids: Vec<Bid> = sqlx::query_as(
            r#"
            SELECT * FROM bids
            WHERE job_id = $1 AND status != 'withdrawn'
            ORDER BY bid_amount ASC
            "#,
        )
        .bind(job_id)
        .fetch_all(&self.db)
        .await?;

        let total = bids.len() as i64;

        // Fetch agent details for each bid
        let mut bids_with_agent = Vec::new();
        for bid in bids {
            let agent_info: (String, String, Option<f64>, Option<i32>) = sqlx::query_as(
                r#"
                SELECT
                    a.display_name,
                    a.trust_tier,
                    CAST(ar.avg_rating AS DOUBLE PRECISION),
                    ar.completed_jobs
                FROM agents a
                LEFT JOIN agent_reputations ar ON a.id = ar.agent_id
                WHERE a.id = $1
                "#,
            )
            .bind(bid.agent_id)
            .fetch_one(&self.db)
            .await?;

            bids_with_agent.push(BidWithAgent {
                bid,
                agent_name: agent_info.0,
                agent_rating: agent_info.2,
                agent_completed_jobs: agent_info.3,
                agent_trust_tier: agent_info.1,
            });
        }

        Ok(BidListResponse {
            bids: bids_with_agent,
            total,
        })
    }

    pub async fn update(&self, id: Uuid, agent_id: Uuid, input: UpdateBid) -> Result<Bid> {
        // ATOMIC: Single query that checks ownership, status, and revision_count
        // This prevents race conditions where multiple updates could exceed revision limit
        let updated = sqlx::query_as::<_, Bid>(
            r#"
            UPDATE bids SET
                bid_amount = COALESCE($3, bid_amount),
                estimated_hours = COALESCE($4, estimated_hours),
                estimated_completion = COALESCE($5, estimated_completion),
                proposal = COALESCE($6, proposal),
                approach = COALESCE($7, approach),
                revision_count = revision_count + 1,
                updated_at = NOW()
            WHERE id = $1
              AND agent_id = $2
              AND status = 'pending'
              AND revision_count < 1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(agent_id)
        .bind(input.bid_amount)
        .bind(input.estimated_hours)
        .bind(input.estimated_completion)
        .bind(&input.proposal)
        .bind(&input.approach)
        .fetch_optional(&self.db)
        .await?;

        match updated {
            Some(bid) => Ok(bid),
            None => {
                // Determine the specific error by fetching the bid
                let bid: Option<Bid> = sqlx::query_as(
                    "SELECT * FROM bids WHERE id = $1"
                )
                .bind(id)
                .fetch_optional(&self.db)
                .await?;

                match bid {
                    None => Err(AppError::NotFound(format!("Bid {} not found", id))),
                    Some(b) if b.agent_id != agent_id => {
                        Err(AppError::Forbidden("Not authorized to update this bid".to_string()))
                    }
                    Some(b) if b.status != "pending" => {
                        Err(AppError::BadRequest("Can only update pending bids".to_string()))
                    }
                    Some(_) => {
                        Err(AppError::BadRequest("Maximum bid revisions (1) reached".to_string()))
                    }
                }
            }
        }
    }

    pub async fn withdraw(&self, id: Uuid, agent_id: Uuid) -> Result<Bid> {
        // ATOMIC: Single query that checks ownership and status
        let updated = sqlx::query_as::<_, Bid>(
            r#"
            UPDATE bids SET status = 'withdrawn', updated_at = NOW()
            WHERE id = $1 AND agent_id = $2 AND status != 'accepted'
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(agent_id)
        .fetch_optional(&self.db)
        .await?;

        match updated {
            Some(bid) => Ok(bid),
            None => {
                // Determine specific error
                let bid: Option<Bid> = sqlx::query_as(
                    "SELECT * FROM bids WHERE id = $1"
                )
                .bind(id)
                .fetch_optional(&self.db)
                .await?;

                match bid {
                    None => Err(AppError::NotFound(format!("Bid {} not found", id))),
                    Some(b) if b.agent_id != agent_id => {
                        Err(AppError::Forbidden("Not authorized to withdraw this bid".to_string()))
                    }
                    Some(_) => {
                        Err(AppError::BadRequest("Cannot withdraw an accepted bid".to_string()))
                    }
                }
            }
        }
    }

    pub async fn accept(&self, id: Uuid) -> Result<Bid> {
        // ATOMIC: Accept this bid only if it's still pending (prevents double-accept race condition)
        let accepted = sqlx::query_as::<_, Bid>(
            r#"
            UPDATE bids SET status = 'accepted', updated_at = NOW()
            WHERE id = $1 AND status = 'pending'
            RETURNING *
            "#,
        )
        .bind(id)
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| AppError::Conflict("Bid is no longer pending or not found".to_string()))?;

        // Reject all other pending bids for this job
        sqlx::query(
            "UPDATE bids SET status = 'rejected', updated_at = NOW() WHERE job_id = $1 AND id != $2 AND status = 'pending'"
        )
        .bind(accepted.job_id)
        .bind(id)
        .execute(&self.db)
        .await?;

        Ok(accepted)
    }
}
