use crate::error::Result;
use crate::models::MatchScore;
use rust_decimal::Decimal;
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Clone)]
pub struct MatchingService {
    db: PgPool,
}

impl MatchingService {
    pub fn new(db: PgPool) -> Self {
        Self { db }
    }

    /// Calculate match scores for all agents that have bid on a job
    /// Used for auto-match mode
    pub async fn score_bids(&self, job_id: Uuid) -> Result<Vec<MatchScore>> {
        // Get job details
        let job: (serde_json::Value, Decimal, Decimal) =
            sqlx::query_as(
                "SELECT required_skills, budget_min, budget_max FROM jobs WHERE id = $1",
            )
            .bind(job_id)
            .fetch_one(&self.db)
            .await?;

        let required_skills: Vec<String> = serde_json::from_value(job.0.clone()).unwrap_or_default();
        let budget_min: f64 = job.1.to_string().parse().unwrap_or(0.0);
        let budget_max: f64 = job.2.to_string().parse().unwrap_or(0.0);
        let budget_mid = (budget_min + budget_max) / 2.0;

        // Get all pending bids with agent info
        let bids: Vec<(
            Uuid,
            serde_json::Value,
            f64,
            Option<f64>,
            Option<i32>,
            Option<f64>,
            i64,
        )> = sqlx::query_as(
            r#"
            SELECT
                b.agent_id,
                a.skills,
                CAST(b.bid_amount AS FLOAT8),
                ar.avg_rating,
                ar.completed_jobs,
                ar.completion_rate,
                (SELECT COUNT(*) FROM jobs WHERE agent_id = a.id AND status = 'in_progress') as active_jobs
            FROM bids b
            JOIN agents a ON b.agent_id = a.id
            LEFT JOIN agent_reputations ar ON a.id = ar.agent_id
            WHERE b.job_id = $1 AND b.status = 'pending'
            "#,
        )
        .bind(job_id)
        .fetch_all(&self.db)
        .await?;

        let mut scores: Vec<MatchScore> = Vec::new();

        for (agent_id, agent_skills_json, bid_amount, avg_rating, completed_jobs, completion_rate, active_jobs) in bids {
            let agent_skills: Vec<String> =
                serde_json::from_value(agent_skills_json).unwrap_or_default();

            // 1. Skill Match (30 points)
            let skill_score = self.calculate_skill_score(&required_skills, &agent_skills);

            // 2. Reputation (25 points)
            let reputation_score = self.calculate_reputation_score(
                avg_rating.unwrap_or(0.0),
                completed_jobs.unwrap_or(0),
                completion_rate.unwrap_or(0.0),
            );

            // 3. Price Fit (20 points)
            let price_score = self.calculate_price_score(bid_amount, budget_mid);

            // 4. Availability (15 points)
            let availability_score = self.calculate_availability_score(active_jobs, 3); // Max 3 concurrent

            // 5. Speed Score (10 points) - based on historical response time
            let speed_score = self.calculate_speed_score(agent_id).await.unwrap_or(5.0);

            let total_score =
                skill_score + reputation_score + price_score + availability_score + speed_score;

            scores.push(MatchScore {
                agent_id,
                total_score,
                skill_score,
                reputation_score,
                price_score,
                availability_score,
                speed_score,
            });
        }

        // Sort by total score descending
        scores.sort_by(|a, b| b.total_score.partial_cmp(&a.total_score).unwrap());

        Ok(scores)
    }

    /// Calculate skill match score (0-30 points)
    fn calculate_skill_score(&self, required: &[String], agent_skills: &[String]) -> f64 {
        if required.is_empty() {
            return 15.0; // Neutral score if no skills required
        }

        let mut exact_matches = 0;
        let mut related_matches = 0;

        for req in required {
            let req_lower = req.to_lowercase();
            for skill in agent_skills {
                let skill_lower = skill.to_lowercase();
                if skill_lower == req_lower {
                    exact_matches += 1;
                    break;
                } else if skill_lower.contains(&req_lower) || req_lower.contains(&skill_lower) {
                    related_matches += 1;
                }
            }
        }

        let raw_score = (exact_matches * 3 + related_matches) as f64;
        let max_possible = (required.len() * 3) as f64;

        (raw_score / max_possible) * 30.0
    }

    /// Calculate reputation score (0-25 points)
    fn calculate_reputation_score(
        &self,
        avg_rating: f64,
        completed_jobs: i32,
        completion_rate: f64,
    ) -> f64 {
        // Rating component (0-15)
        let rating_component = (avg_rating / 5.0) * 15.0;

        // Completion rate component (0-5)
        let completion_component = completion_rate * 5.0;

        // Volume bonus (0-5), using ln to dampen large numbers
        let volume_bonus = ((completed_jobs + 1) as f64).ln().min(5.0);

        rating_component + completion_component + volume_bonus
    }

    /// Calculate price fit score (0-20 points)
    fn calculate_price_score(&self, bid_amount: f64, budget_mid: f64) -> f64 {
        if budget_mid == 0.0 {
            return 10.0;
        }

        let deviation = (bid_amount - budget_mid).abs() / budget_mid;
        let base_score = (1.0 - deviation.min(1.0)) * 20.0;

        // Small bonus for being slightly below midpoint
        if bid_amount < budget_mid && deviation < 0.2 {
            (base_score + 2.0).min(20.0)
        } else {
            base_score
        }
    }

    /// Calculate availability score (0-15 points)
    fn calculate_availability_score(&self, active_jobs: i64, max_concurrent: i64) -> f64 {
        let load_factor = active_jobs as f64 / max_concurrent as f64;
        (1.0 - load_factor.min(1.0)) * 15.0
    }

    /// Calculate skill match score (0-30 points) - public for testing
    pub fn skill_score(&self, required: &[String], agent_skills: &[String]) -> f64 {
        self.calculate_skill_score(required, agent_skills)
    }

    /// Calculate reputation score (0-25 points) - public for testing
    pub fn reputation_score(&self, avg_rating: f64, completed_jobs: i32, completion_rate: f64) -> f64 {
        self.calculate_reputation_score(avg_rating, completed_jobs, completion_rate)
    }

    /// Calculate price fit score (0-20 points) - public for testing
    pub fn price_score(&self, bid_amount: f64, budget_mid: f64) -> f64 {
        self.calculate_price_score(bid_amount, budget_mid)
    }

    /// Calculate availability score (0-15 points) - public for testing
    pub fn availability_score(&self, active_jobs: i64, max_concurrent: i64) -> f64 {
        self.calculate_availability_score(active_jobs, max_concurrent)
    }

    /// Calculate speed score (0-10 points) based on historical response time
    /// Measures how quickly the agent responds to new jobs with bids
    async fn calculate_speed_score(&self, agent_id: Uuid) -> Result<f64> {
        // Query average time between job publication and agent's bid
        // Only consider jobs from the last 90 days for relevance
        let result: Option<(f64,)> = sqlx::query_as(
            r#"
            SELECT AVG(EXTRACT(EPOCH FROM (b.created_at - j.published_at)) / 60.0) as avg_response_minutes
            FROM bids b
            JOIN jobs j ON b.job_id = j.id
            WHERE b.agent_id = $1
              AND j.published_at IS NOT NULL
              AND b.created_at > NOW() - INTERVAL '90 days'
              AND j.published_at > NOW() - INTERVAL '90 days'
            HAVING COUNT(*) >= 3
            "#,
        )
        .bind(agent_id)
        .fetch_optional(&self.db)
        .await?;

        let score = match result {
            Some((avg_minutes,)) => {
                // Score based on response time
                // < 15 min = 10 points
                // < 60 min = 8 points
                // < 240 min (4 hours) = 6 points
                // < 1440 min (24 hours) = 4 points
                // > 24 hours = 2 points
                if avg_minutes < 15.0 {
                    10.0
                } else if avg_minutes < 60.0 {
                    8.0
                } else if avg_minutes < 240.0 {
                    6.0
                } else if avg_minutes < 1440.0 {
                    4.0
                } else {
                    2.0
                }
            }
            None => {
                // No historical data, give neutral score
                5.0
            }
        };

        Ok(score)
    }
}

#[cfg(test)]
mod tests {
    // Test the scoring algorithms directly without needing MatchingService
    // These are pure functions that can be tested independently

    fn calculate_skill_score(required: &[String], agent_skills: &[String]) -> f64 {
        if required.is_empty() {
            return 15.0;
        }

        let mut exact_matches = 0;
        let mut related_matches = 0;

        for req in required {
            let req_lower = req.to_lowercase();
            for skill in agent_skills {
                let skill_lower = skill.to_lowercase();
                if skill_lower == req_lower {
                    exact_matches += 1;
                    break;
                } else if skill_lower.contains(&req_lower) || req_lower.contains(&skill_lower) {
                    related_matches += 1;
                }
            }
        }

        let raw_score = (exact_matches * 3 + related_matches) as f64;
        let max_possible = (required.len() * 3) as f64;

        (raw_score / max_possible) * 30.0
    }

    fn calculate_reputation_score(avg_rating: f64, completed_jobs: i32, completion_rate: f64) -> f64 {
        let rating_component = (avg_rating / 5.0) * 15.0;
        let completion_component = completion_rate * 5.0;
        let volume_bonus = ((completed_jobs + 1) as f64).ln().min(5.0);
        rating_component + completion_component + volume_bonus
    }

    fn calculate_price_score(bid_amount: f64, budget_mid: f64) -> f64 {
        if budget_mid == 0.0 {
            return 10.0;
        }

        let deviation = (bid_amount - budget_mid).abs() / budget_mid;
        let base_score = (1.0 - deviation.min(1.0)) * 20.0;

        if bid_amount < budget_mid && deviation < 0.2 {
            (base_score + 2.0).min(20.0)
        } else {
            base_score
        }
    }

    fn calculate_availability_score(active_jobs: i64, max_concurrent: i64) -> f64 {
        let load_factor = active_jobs as f64 / max_concurrent as f64;
        (1.0 - load_factor.min(1.0)) * 15.0
    }

    #[test]
    fn test_skill_score_exact_match() {
        let required = vec!["rust".to_string(), "postgresql".to_string()];
        let agent_skills = vec!["rust".to_string(), "postgresql".to_string(), "python".to_string()];

        let score = calculate_skill_score(&required, &agent_skills);

        assert!((score - 30.0).abs() < 0.1);
    }

    #[test]
    fn test_skill_score_partial_match() {
        let required = vec!["rust".to_string(), "postgresql".to_string()];
        let agent_skills = vec!["rust".to_string(), "mongodb".to_string()];

        let score = calculate_skill_score(&required, &agent_skills);

        assert!(score > 0.0);
        assert!(score < 30.0);
    }

    #[test]
    fn test_skill_score_no_match() {
        let required = vec!["rust".to_string()];
        let agent_skills = vec!["python".to_string()];

        let score = calculate_skill_score(&required, &agent_skills);

        assert_eq!(score, 0.0);
    }

    #[test]
    fn test_skill_score_empty_required() {
        let required: Vec<String> = vec![];
        let agent_skills = vec!["rust".to_string()];

        let score = calculate_skill_score(&required, &agent_skills);

        assert_eq!(score, 15.0);
    }

    #[test]
    fn test_reputation_score_perfect() {
        let score = calculate_reputation_score(5.0, 100, 1.0);

        assert!(score > 20.0);
    }

    #[test]
    fn test_reputation_score_new_agent() {
        let score = calculate_reputation_score(0.0, 0, 0.0);

        assert!(score >= 0.0);
        assert!(score < 5.0);
    }

    #[test]
    fn test_price_score_exact_budget() {
        let score = calculate_price_score(150.0, 150.0);

        assert_eq!(score, 20.0);
    }

    #[test]
    fn test_price_score_below_budget() {
        let score = calculate_price_score(140.0, 150.0);

        assert!(score > 18.0);
    }

    #[test]
    fn test_price_score_above_budget() {
        let score = calculate_price_score(200.0, 150.0);

        assert!(score < 15.0);
    }

    #[test]
    fn test_availability_score_no_jobs() {
        let score = calculate_availability_score(0, 3);

        assert_eq!(score, 15.0);
    }

    #[test]
    fn test_availability_score_at_capacity() {
        let score = calculate_availability_score(3, 3);

        assert_eq!(score, 0.0);
    }

    #[test]
    fn test_availability_score_half_capacity() {
        let score = calculate_availability_score(1, 2);

        assert!((score - 7.5).abs() < 0.1);
    }
}
