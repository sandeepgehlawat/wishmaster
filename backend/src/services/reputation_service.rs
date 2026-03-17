use crate::error::Result;
use crate::models::{AgentReputation, ClientReputation};
use rust_decimal::Decimal;
use rust_decimal::prelude::FromPrimitive;
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Clone)]
pub struct ReputationService {
    db: PgPool,
}

impl ReputationService {
    pub fn new(db: PgPool) -> Self {
        Self { db }
    }

    /// Calculate and update agent reputation (JSS)
    pub async fn calculate_agent_reputation(&self, agent_id: Uuid) -> Result<AgentReputation> {
        // Get all public, non-quarantined ratings
        let ratings: Vec<(i32, Option<i32>, Option<i32>, Option<i32>, chrono::DateTime<chrono::Utc>)> =
            sqlx::query_as(
                r#"
                SELECT overall, dimension_1, dimension_2, dimension_3, created_at
                FROM ratings
                WHERE ratee_id = $1 AND ratee_type = 'agent'
                    AND is_public = true AND is_quarantined = false
                ORDER BY created_at DESC
                "#,
            )
            .bind(agent_id)
            .fetch_all(&self.db)
            .await?;

        // Get job outcomes
        let job_stats: (i64, i64, i64) = sqlx::query_as(
            r#"
            SELECT
                COUNT(*) FILTER (WHERE status = 'completed') as completed,
                COUNT(*) FILTER (WHERE status IN ('in_progress', 'delivered', 'revision', 'completed')) as started,
                COUNT(*) FILTER (WHERE status = 'disputed') as disputed
            FROM jobs WHERE agent_id = $1
            "#,
        )
        .bind(agent_id)
        .fetch_one(&self.db)
        .await?;

        let total_ratings = ratings.len() as i32;
        let completed_jobs = job_stats.0 as i32;
        let started_jobs = job_stats.1.max(1) as f64;

        // Calculate weighted average rating (recent ratings weighted more)
        let avg_rating = if total_ratings > 0 {
            let now = chrono::Utc::now();
            let mut weighted_sum = 0.0;
            let mut weight_sum = 0.0;

            for (overall, _, _, _, created_at) in &ratings {
                let days_ago = (now - *created_at).num_days() as f64;
                let weight = (-0.01 * days_ago).exp(); // Exponential decay
                weighted_sum += *overall as f64 * weight;
                weight_sum += weight;
            }

            weighted_sum / weight_sum
        } else {
            0.0
        };

        // Dimension scores
        let quality_score = ratings.iter()
            .filter_map(|(_, d1, _, _, _)| *d1)
            .map(|d| d as f64)
            .sum::<f64>() / total_ratings.max(1) as f64;

        let speed_score = ratings.iter()
            .filter_map(|(_, _, d2, _, _)| *d2)
            .map(|d| d as f64)
            .sum::<f64>() / total_ratings.max(1) as f64;

        let communication_score = ratings.iter()
            .filter_map(|(_, _, _, d3, _)| *d3)
            .map(|d| d as f64)
            .sum::<f64>() / total_ratings.max(1) as f64;

        // Completion rate
        let completion_rate = completed_jobs as f64 / started_jobs;

        // Calculate JSS (Job Success Score)
        // 1. Public ratings (40%)
        let rating_component = if avg_rating >= 4.5 {
            40.0
        } else if avg_rating >= 4.0 {
            35.0
        } else if avg_rating >= 3.5 {
            30.0
        } else if avg_rating >= 3.0 {
            20.0
        } else {
            avg_rating / 5.0 * 40.0
        };

        // 2. Job outcomes (40%)
        let outcome_component = completion_rate * 40.0;

        // 3. Volume bonus (20%)
        let volume_bonus = ((completed_jobs + 1) as f64).ln().min(5.0) * 4.0;

        let job_success_score = (rating_component + outcome_component + volume_bonus).min(100.0);

        // Get total earnings
        let total_earnings: Decimal = sqlx::query_scalar(
            "SELECT COALESCE(SUM(agent_payout_usdc), 0) FROM escrows WHERE agent_wallet = (SELECT wallet_address FROM agents WHERE id = $1)"
        )
        .bind(agent_id)
        .fetch_one(&self.db)
        .await?;

        // Convert f64 to Decimal for database
        let avg_rating_dec = Decimal::from_f64(avg_rating).unwrap_or_default();
        let completion_rate_dec = Decimal::from_f64(completion_rate).unwrap_or_default();
        let quality_score_dec = Decimal::from_f64(quality_score).unwrap_or_default();
        let speed_score_dec = Decimal::from_f64(speed_score).unwrap_or_default();
        let communication_score_dec = Decimal::from_f64(communication_score).unwrap_or_default();
        let job_success_score_dec = Decimal::from_f64(job_success_score).unwrap_or_default();

        // Upsert reputation
        let reputation = sqlx::query_as::<_, AgentReputation>(
            r#"
            INSERT INTO agent_reputations (
                agent_id, avg_rating, total_ratings, completion_rate, completed_jobs,
                quality_score, speed_score, communication_score, job_success_score,
                total_earnings_usdc, calculated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
            ON CONFLICT (agent_id) DO UPDATE SET
                avg_rating = EXCLUDED.avg_rating,
                total_ratings = EXCLUDED.total_ratings,
                completion_rate = EXCLUDED.completion_rate,
                completed_jobs = EXCLUDED.completed_jobs,
                quality_score = EXCLUDED.quality_score,
                speed_score = EXCLUDED.speed_score,
                communication_score = EXCLUDED.communication_score,
                job_success_score = EXCLUDED.job_success_score,
                total_earnings_usdc = EXCLUDED.total_earnings_usdc,
                calculated_at = NOW()
            RETURNING *
            "#,
        )
        .bind(agent_id)
        .bind(avg_rating_dec)
        .bind(total_ratings)
        .bind(completion_rate_dec)
        .bind(completed_jobs)
        .bind(quality_score_dec)
        .bind(speed_score_dec)
        .bind(communication_score_dec)
        .bind(job_success_score_dec)
        .bind(total_earnings)
        .fetch_one(&self.db)
        .await?;

        // Update trust tier based on JSS
        let new_tier = if job_success_score >= 90.0 && completed_jobs >= 100 {
            "top_rated"
        } else if job_success_score >= 80.0 && completed_jobs >= 20 {
            "established"
        } else if job_success_score >= 70.0 && completed_jobs >= 5 {
            "rising"
        } else {
            "new"
        };

        sqlx::query("UPDATE agents SET trust_tier = $2 WHERE id = $1")
            .bind(agent_id)
            .bind(new_tier)
            .execute(&self.db)
            .await?;

        Ok(reputation)
    }

    /// Calculate client reputation
    pub async fn calculate_client_reputation(&self, user_id: Uuid) -> Result<ClientReputation> {
        // Get all ratings for this client
        let ratings: Vec<(i32, Option<i32>, Option<i32>, Option<i32>)> = sqlx::query_as(
            r#"
            SELECT overall, dimension_1, dimension_2, dimension_3
            FROM ratings
            WHERE ratee_id = $1 AND ratee_type = 'client'
                AND is_public = true AND is_quarantined = false
            "#,
        )
        .bind(user_id)
        .fetch_all(&self.db)
        .await?;

        let total_ratings = ratings.len() as i32;

        let avg_rating = if total_ratings > 0 {
            ratings.iter().map(|(o, _, _, _)| *o as f64).sum::<f64>() / total_ratings as f64
        } else {
            0.0
        };

        // clarity = dimension_1, communication = dimension_2, scope_respect = dimension_3
        let clarity_score = ratings.iter()
            .filter_map(|(_, d1, _, _)| *d1)
            .map(|d| d as f64)
            .sum::<f64>() / total_ratings.max(1) as f64;

        // Get job stats
        let job_stats: (i64, i64) = sqlx::query_as(
            r#"
            SELECT
                COUNT(*) as total_jobs,
                COUNT(*) FILTER (WHERE status = 'disputed') as disputed
            FROM jobs WHERE client_id = $1
            "#,
        )
        .bind(user_id)
        .fetch_one(&self.db)
        .await?;

        let total_jobs = job_stats.0 as i32;
        let dispute_rate = if total_jobs > 0 {
            job_stats.1 as f64 / total_jobs as f64
        } else {
            0.0
        };

        // Payment reliability (based on escrow releases)
        let payment_stats: (i64, i64) = sqlx::query_as(
            r#"
            SELECT
                COUNT(*) FILTER (WHERE status = 'released') as released,
                COUNT(*) as total
            FROM escrows e
            JOIN jobs j ON e.job_id = j.id
            WHERE j.client_id = $1
            "#,
        )
        .bind(user_id)
        .fetch_one(&self.db)
        .await?;

        let payment_reliability = if payment_stats.1 > 0 {
            payment_stats.0 as f64 / payment_stats.1 as f64
        } else {
            1.0
        };

        // Convert f64 to Decimal
        let avg_rating_dec = Decimal::from_f64(avg_rating).unwrap_or_default();
        let payment_reliability_dec = Decimal::from_f64(payment_reliability).unwrap_or_default();
        let clarity_score_dec = Decimal::from_f64(clarity_score).unwrap_or_default();
        let dispute_rate_dec = Decimal::from_f64(dispute_rate).unwrap_or_default();

        // Upsert
        let reputation = sqlx::query_as::<_, ClientReputation>(
            r#"
            INSERT INTO client_reputations (
                user_id, avg_rating, total_jobs, payment_reliability,
                clarity_score, scope_respect_score, dispute_rate, calculated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            ON CONFLICT (user_id) DO UPDATE SET
                avg_rating = EXCLUDED.avg_rating,
                total_jobs = EXCLUDED.total_jobs,
                payment_reliability = EXCLUDED.payment_reliability,
                clarity_score = EXCLUDED.clarity_score,
                scope_respect_score = EXCLUDED.scope_respect_score,
                dispute_rate = EXCLUDED.dispute_rate,
                calculated_at = NOW()
            RETURNING *
            "#,
        )
        .bind(user_id)
        .bind(avg_rating_dec)
        .bind(total_jobs)
        .bind(payment_reliability_dec)
        .bind(clarity_score_dec)
        .bind(Decimal::ZERO) // scope_respect_score placeholder
        .bind(dispute_rate_dec)
        .fetch_one(&self.db)
        .await?;

        Ok(reputation)
    }

    /// Get agent reputation (cached or calculate)
    pub async fn get_agent_reputation(&self, agent_id: Uuid) -> Result<Option<AgentReputation>> {
        let rep = sqlx::query_as::<_, AgentReputation>(
            "SELECT * FROM agent_reputations WHERE agent_id = $1"
        )
        .bind(agent_id)
        .fetch_optional(&self.db)
        .await?;

        Ok(rep)
    }

    /// Get client reputation (cached or calculate)
    pub async fn get_client_reputation(&self, user_id: Uuid) -> Result<Option<ClientReputation>> {
        let rep = sqlx::query_as::<_, ClientReputation>(
            "SELECT * FROM client_reputations WHERE user_id = $1"
        )
        .bind(user_id)
        .fetch_optional(&self.db)
        .await?;

        Ok(rep)
    }
}
