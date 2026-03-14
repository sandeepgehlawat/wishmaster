use crate::error::{AppError, Result};
use crate::models::{GamingDetection, Rating, RatingListResponse, RatingWithDetails, SubmitRating};
use chrono::{Duration, Utc};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Clone)]
pub struct RatingService {
    db: PgPool,
}

impl RatingService {
    pub fn new(db: PgPool) -> Self {
        Self { db }
    }

    /// Submit a rating for a completed job
    pub async fn submit(
        &self,
        job_id: Uuid,
        rater_id: Uuid,
        rater_type: &str,
        input: SubmitRating,
    ) -> Result<Rating> {
        // Validate rating values
        if input.overall < 1 || input.overall > 5 {
            return Err(AppError::Validation("Overall rating must be 1-5".to_string()));
        }

        for dim in [input.dimension_1, input.dimension_2, input.dimension_3].iter().flatten() {
            if *dim < 1 || *dim > 5 {
                return Err(AppError::Validation("Dimension ratings must be 1-5".to_string()));
            }
        }

        // Get job and verify it's completed
        let job: (String, Uuid, Option<Uuid>) = sqlx::query_as(
            "SELECT status, client_id, agent_id FROM jobs WHERE id = $1"
        )
        .bind(job_id)
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Job not found".to_string()))?;

        if job.0 != "completed" {
            return Err(AppError::BadRequest("Job must be completed to rate".to_string()));
        }

        // Determine ratee based on rater
        let (ratee_type, ratee_id) = match rater_type {
            "client" => {
                if job.1 != rater_id {
                    return Err(AppError::Forbidden("You are not the client for this job".to_string()));
                }
                let agent_id = job.2.ok_or_else(|| AppError::Internal("No agent assigned".to_string()))?;
                ("agent", agent_id)
            }
            "agent" => {
                let agent_id = job.2.ok_or_else(|| AppError::Internal("No agent assigned".to_string()))?;
                if agent_id != rater_id {
                    return Err(AppError::Forbidden("You are not the agent for this job".to_string()));
                }
                ("client", job.1)
            }
            _ => return Err(AppError::BadRequest("Invalid rater type".to_string())),
        };

        // Check for existing rating
        let existing: Option<Rating> = sqlx::query_as(
            "SELECT * FROM ratings WHERE job_id = $1 AND rater_id = $2"
        )
        .bind(job_id)
        .bind(rater_id)
        .fetch_optional(&self.db)
        .await?;

        if existing.is_some() {
            return Err(AppError::Conflict("You have already rated this job".to_string()));
        }

        // Check rating window (14 days from completion)
        let completed_at: chrono::DateTime<Utc> = sqlx::query_scalar(
            "SELECT completed_at FROM jobs WHERE id = $1"
        )
        .bind(job_id)
        .fetch_one(&self.db)
        .await?;

        if Utc::now() > completed_at + Duration::days(14) {
            return Err(AppError::BadRequest("Rating window has closed (14 days)".to_string()));
        }

        // Check for gaming patterns
        let gaming_check = self.detect_gaming(rater_id, ratee_id, rater_type).await?;

        let id = Uuid::new_v4();

        let rating = sqlx::query_as::<_, Rating>(
            r#"
            INSERT INTO ratings (
                id, job_id, rater_type, rater_id, ratee_type, ratee_id,
                overall, dimension_1, dimension_2, dimension_3,
                review_text, is_public, is_quarantined, quarantine_reason
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(job_id)
        .bind(rater_type)
        .bind(rater_id)
        .bind(ratee_type)
        .bind(ratee_id)
        .bind(input.overall)
        .bind(input.dimension_1)
        .bind(input.dimension_2)
        .bind(input.dimension_3)
        .bind(&input.review_text)
        .bind(input.is_public.unwrap_or(true))
        .bind(gaming_check.is_suspicious)
        .bind(if gaming_check.is_suspicious {
            Some(gaming_check.reasons.join(", "))
        } else {
            None
        })
        .fetch_one(&self.db)
        .await?;

        Ok(rating)
    }

    /// Get ratings for an entity (agent or client)
    pub async fn get_ratings(
        &self,
        ratee_id: Uuid,
        ratee_type: &str,
    ) -> Result<RatingListResponse> {
        // Fetch ratings
        let ratings: Vec<Rating> = sqlx::query_as(
            r#"
            SELECT * FROM ratings
            WHERE ratee_id = $1 AND ratee_type = $2
                AND is_public = true AND is_quarantined = false
            ORDER BY created_at DESC
            "#,
        )
        .bind(ratee_id)
        .bind(ratee_type)
        .fetch_all(&self.db)
        .await?;

        let total = ratings.len() as i64;

        // Calculate average
        let average = if total > 0 {
            ratings.iter().map(|r| r.overall as f64).sum::<f64>() / total as f64
        } else {
            0.0
        };

        // Fetch details for each rating
        let mut ratings_with_details = Vec::new();
        for rating in ratings {
            // Get job title
            let job_title: (String,) = sqlx::query_as(
                "SELECT title FROM jobs WHERE id = $1"
            )
            .bind(rating.job_id)
            .fetch_one(&self.db)
            .await?;

            // Get rater name
            let rater_name = if rating.rater_type == "client" {
                let result: Option<(String,)> = sqlx::query_as(
                    "SELECT display_name FROM users WHERE id = $1"
                )
                .bind(rating.rater_id)
                .fetch_optional(&self.db)
                .await?;
                result.map(|r| r.0).unwrap_or_else(|| "Unknown".to_string())
            } else {
                let result: Option<(String,)> = sqlx::query_as(
                    "SELECT display_name FROM agents WHERE id = $1"
                )
                .bind(rating.rater_id)
                .fetch_optional(&self.db)
                .await?;
                result.map(|r| r.0).unwrap_or_else(|| "Unknown".to_string())
            };

            ratings_with_details.push(RatingWithDetails {
                rating,
                job_title: job_title.0,
                rater_name,
            });
        }

        Ok(RatingListResponse {
            ratings: ratings_with_details,
            total,
            average,
        })
    }

    /// Detect potential rating gaming
    async fn detect_gaming(
        &self,
        rater_id: Uuid,
        _ratee_id: Uuid,
        _rater_type: &str,
    ) -> Result<GamingDetection> {
        let mut reasons = Vec::new();
        let mut confidence = 0.0;

        // Check 1: Sybil detection - same wallet funding
        // Would check on-chain in production

        // Check 2: Too many ratings in short period
        let recent_ratings: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*) FROM ratings
            WHERE rater_id = $1 AND created_at > NOW() - INTERVAL '7 days'
            "#,
        )
        .bind(rater_id)
        .fetch_one(&self.db)
        .await?;

        if recent_ratings > 10 {
            reasons.push("High rating velocity".to_string());
            confidence += 0.3;
        }

        // Check 3: All 5-star ratings (statistically unlikely)
        let rating_dist: Vec<(i32, i64)> = sqlx::query_as(
            r#"
            SELECT overall, COUNT(*) as cnt
            FROM ratings WHERE rater_id = $1
            GROUP BY overall
            "#,
        )
        .bind(rater_id)
        .fetch_all(&self.db)
        .await?;

        let total_given: i64 = rating_dist.iter().map(|(_, c)| c).sum();
        let five_stars: i64 = rating_dist.iter()
            .filter(|(o, _)| *o == 5)
            .map(|(_, c)| *c)
            .sum();

        if total_given >= 10 && five_stars as f64 / total_given as f64 > 0.95 {
            reasons.push("Suspiciously high rating pattern".to_string());
            confidence += 0.3;
        }

        // Check 4: Few unique ratees
        let unique_ratees: i64 = sqlx::query_scalar(
            "SELECT COUNT(DISTINCT ratee_id) FROM ratings WHERE rater_id = $1"
        )
        .bind(rater_id)
        .fetch_one(&self.db)
        .await?;

        if total_given > 10 && unique_ratees < 3 {
            reasons.push("Low ratee diversity".to_string());
            confidence += 0.4;
        }

        Ok(GamingDetection {
            is_suspicious: confidence > 0.5,
            reasons,
            confidence,
        })
    }
}
