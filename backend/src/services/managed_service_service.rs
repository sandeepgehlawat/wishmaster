use crate::error::{AppError, Result};
use crate::models::{
    BillingListResponse, CreateManagedService, CreateServiceUpdate, ManagedService,
    ManagedServiceWithDetails, RejectServiceUpdate, ServiceBilling, ServiceListResponse,
    ServiceUpdate, ServiceUpdateListResponse, UpdateManagedService,
};
use chrono::{Duration, Utc};
use rust_decimal::Decimal;
use sqlx::PgPool;
use uuid::Uuid;
use validator::Validate;

#[derive(Clone)]
pub struct ManagedServiceService {
    db: PgPool,
}

impl ManagedServiceService {
    pub fn new(db: PgPool) -> Self {
        Self { db }
    }

    // ==================== Managed Services ====================

    /// Convert a completed job to a managed service (client initiates)
    pub async fn create(
        &self,
        job_id: Uuid,
        client_id: Uuid,
        agent_id: Uuid,
        input: CreateManagedService,
    ) -> Result<ManagedService> {
        // Validate input
        input.validate().map_err(|e| {
            AppError::Validation(format!("Invalid input: {}", e))
        })?;

        // Verify job is completed
        let job: Option<(String, Uuid, Option<Uuid>)> = sqlx::query_as(
            "SELECT status, client_id, agent_id FROM jobs WHERE id = $1"
        )
        .bind(job_id)
        .fetch_optional(&self.db)
        .await?;

        let Some((status, job_client, job_agent)) = job else {
            return Err(AppError::NotFound("Job not found".to_string()));
        };

        if status != "completed" {
            return Err(AppError::BadRequest(
                "Can only create managed service from completed jobs".to_string(),
            ));
        }

        if job_client != client_id {
            return Err(AppError::Forbidden("Not your job".to_string()));
        }

        if job_agent != Some(agent_id) {
            return Err(AppError::BadRequest(
                "Agent must be the one who completed the job".to_string(),
            ));
        }

        let service = sqlx::query_as::<_, ManagedService>(
            r#"
            INSERT INTO managed_services (
                original_job_id, client_id, agent_id, name, description, monthly_rate_usd
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
            "#,
        )
        .bind(job_id)
        .bind(client_id)
        .bind(agent_id)
        .bind(&input.name)
        .bind(&input.description)
        .bind(&input.monthly_rate_usd)
        .fetch_one(&self.db)
        .await?;

        Ok(service)
    }

    /// Agent accepts the service offer
    pub async fn accept(&self, id: Uuid, agent_id: Uuid) -> Result<ManagedService> {
        let service = self.get_by_id(id).await?;

        if service.agent_id != agent_id {
            return Err(AppError::Forbidden("Not your service offer".to_string()));
        }

        if service.status != "pending" {
            return Err(AppError::BadRequest("Service is not pending".to_string()));
        }

        let now = Utc::now();
        let next_billing = now + Duration::days(30);

        let service = sqlx::query_as::<_, ManagedService>(
            r#"
            UPDATE managed_services
            SET status = 'active', started_at = $2, next_billing_at = $3, updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(now)
        .bind(next_billing)
        .fetch_one(&self.db)
        .await?;

        // Create first billing record
        self.create_billing_record(id, now, next_billing, service.monthly_rate_usd)
            .await?;

        Ok(service)
    }

    /// List services for a user (client or agent)
    pub async fn list_for_user(
        &self,
        user_id: Uuid,
        user_type: &str,
    ) -> Result<ServiceListResponse> {
        let services: Vec<ManagedServiceWithDetails> = if user_type == "client" {
            sqlx::query_as(
                r#"
                SELECT
                    s.*,
                    u.display_name as client_name,
                    a.display_name as agent_name,
                    j.title as job_title
                FROM managed_services s
                JOIN users u ON s.client_id = u.id
                JOIN agents a ON s.agent_id = a.id
                JOIN jobs j ON s.original_job_id = j.id
                WHERE s.client_id = $1
                ORDER BY s.created_at DESC
                "#,
            )
            .bind(user_id)
            .fetch_all(&self.db)
            .await?
        } else {
            sqlx::query_as(
                r#"
                SELECT
                    s.*,
                    u.display_name as client_name,
                    a.display_name as agent_name,
                    j.title as job_title
                FROM managed_services s
                JOIN users u ON s.client_id = u.id
                JOIN agents a ON s.agent_id = a.id
                JOIN jobs j ON s.original_job_id = j.id
                WHERE s.agent_id = $1
                ORDER BY s.created_at DESC
                "#,
            )
            .bind(user_id)
            .fetch_all(&self.db)
            .await?
        };

        let total = services.len() as i64;

        Ok(ServiceListResponse { services, total })
    }

    /// Get service by ID
    pub async fn get_by_id(&self, id: Uuid) -> Result<ManagedService> {
        sqlx::query_as::<_, ManagedService>("SELECT * FROM managed_services WHERE id = $1")
            .bind(id)
            .fetch_optional(&self.db)
            .await?
            .ok_or_else(|| AppError::NotFound("Managed service not found".to_string()))
    }

    /// Get service with details
    pub async fn get_with_details(&self, id: Uuid) -> Result<ManagedServiceWithDetails> {
        sqlx::query_as::<_, ManagedServiceWithDetails>(
            r#"
            SELECT
                s.*,
                u.display_name as client_name,
                a.display_name as agent_name,
                j.title as job_title
            FROM managed_services s
            JOIN users u ON s.client_id = u.id
            JOIN agents a ON s.agent_id = a.id
            JOIN jobs j ON s.original_job_id = j.id
            WHERE s.id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Managed service not found".to_string()))
    }

    /// Update service details
    pub async fn update(&self, id: Uuid, input: UpdateManagedService) -> Result<ManagedService> {
        // Validate input
        input.validate().map_err(|e| {
            AppError::Validation(format!("Invalid input: {}", e))
        })?;

        // Validate monthly_rate_usd if provided
        if let Some(rate) = &input.monthly_rate_usd {
            if *rate <= Decimal::ZERO {
                return Err(AppError::Validation(
                    "Monthly rate must be greater than 0".to_string()
                ));
            }
        }

        sqlx::query_as::<_, ManagedService>(
            r#"
            UPDATE managed_services SET
                name = COALESCE($2, name),
                description = COALESCE($3, description),
                monthly_rate_usd = COALESCE($4, monthly_rate_usd),
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(&input.name)
        .bind(&input.description)
        .bind(input.monthly_rate_usd)
        .fetch_one(&self.db)
        .await
        .map_err(|_| AppError::NotFound("Managed service not found".to_string()))
    }

    /// Pause a service
    pub async fn pause(&self, id: Uuid) -> Result<ManagedService> {
        sqlx::query_as::<_, ManagedService>(
            r#"
            UPDATE managed_services
            SET status = 'paused', paused_at = NOW(), updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .fetch_one(&self.db)
        .await
        .map_err(|_| AppError::NotFound("Managed service not found".to_string()))
    }

    /// Resume a paused service
    pub async fn resume(&self, id: Uuid) -> Result<ManagedService> {
        let service = self.get_by_id(id).await?;

        if service.status != "paused" {
            return Err(AppError::BadRequest("Service is not paused".to_string()));
        }

        let now = Utc::now();
        let next_billing = now + Duration::days(30);

        sqlx::query_as::<_, ManagedService>(
            r#"
            UPDATE managed_services
            SET status = 'active', paused_at = NULL, next_billing_at = $2, updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(next_billing)
        .fetch_one(&self.db)
        .await
        .map_err(|_| AppError::NotFound("Managed service not found".to_string()))
    }

    /// Cancel a service
    pub async fn cancel(&self, id: Uuid) -> Result<ManagedService> {
        sqlx::query_as::<_, ManagedService>(
            r#"
            UPDATE managed_services
            SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .fetch_one(&self.db)
        .await
        .map_err(|_| AppError::NotFound("Managed service not found".to_string()))
    }

    /// Check if user can access service
    pub async fn can_access(&self, service_id: Uuid, user_id: Uuid, user_type: &str) -> Result<bool> {
        let service = self.get_by_id(service_id).await?;

        if user_type == "client" && service.client_id == user_id {
            return Ok(true);
        }
        if user_type == "agent" && service.agent_id == user_id {
            return Ok(true);
        }

        Err(AppError::Forbidden("Not authorized".to_string()))
    }

    // ==================== Service Updates ====================

    /// Create a service update (agent pushes)
    pub async fn create_update(
        &self,
        service_id: Uuid,
        agent_id: Uuid,
        input: CreateServiceUpdate,
    ) -> Result<ServiceUpdate> {
        // Validate input
        input.validate().map_err(|e| {
            AppError::Validation(format!("Invalid input: {}", e))
        })?;

        let service = self.get_by_id(service_id).await?;

        if service.agent_id != agent_id {
            return Err(AppError::Forbidden("Not your service".to_string()));
        }

        if service.status != "active" {
            return Err(AppError::BadRequest("Service is not active".to_string()));
        }

        let update = sqlx::query_as::<_, ServiceUpdate>(
            r#"
            INSERT INTO service_updates (
                service_id, agent_id, title, description, change_type, file_url, file_name
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
            "#,
        )
        .bind(service_id)
        .bind(agent_id)
        .bind(&input.title)
        .bind(&input.description)
        .bind(&input.change_type)
        .bind(&input.file_url)
        .bind(&input.file_name)
        .fetch_one(&self.db)
        .await?;

        Ok(update)
    }

    /// List updates for a service
    pub async fn list_updates(&self, service_id: Uuid) -> Result<ServiceUpdateListResponse> {
        let updates: Vec<ServiceUpdate> = sqlx::query_as(
            r#"
            SELECT * FROM service_updates
            WHERE service_id = $1
            ORDER BY created_at DESC
            "#,
        )
        .bind(service_id)
        .fetch_all(&self.db)
        .await?;

        let total = updates.len() as i64;
        let pending = updates.iter().filter(|u| u.status == "pending").count() as i64;

        Ok(ServiceUpdateListResponse {
            updates,
            total,
            pending,
        })
    }

    /// Get update by ID
    pub async fn get_update_by_id(&self, id: Uuid) -> Result<ServiceUpdate> {
        sqlx::query_as::<_, ServiceUpdate>("SELECT * FROM service_updates WHERE id = $1")
            .bind(id)
            .fetch_optional(&self.db)
            .await?
            .ok_or_else(|| AppError::NotFound("Service update not found".to_string()))
    }

    /// Approve an update (client)
    pub async fn approve_update(&self, id: Uuid) -> Result<ServiceUpdate> {
        sqlx::query_as::<_, ServiceUpdate>(
            r#"
            UPDATE service_updates
            SET status = 'approved', reviewed_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .fetch_one(&self.db)
        .await
        .map_err(|_| AppError::NotFound("Service update not found".to_string()))
    }

    /// Reject an update (client)
    pub async fn reject_update(&self, id: Uuid, input: RejectServiceUpdate) -> Result<ServiceUpdate> {
        sqlx::query_as::<_, ServiceUpdate>(
            r#"
            UPDATE service_updates
            SET status = 'rejected', client_feedback = $2, reviewed_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(&input.feedback)
        .fetch_one(&self.db)
        .await
        .map_err(|_| AppError::NotFound("Service update not found".to_string()))
    }

    /// Mark update as deployed (agent)
    pub async fn deploy_update(&self, id: Uuid, agent_id: Uuid) -> Result<ServiceUpdate> {
        let update = self.get_update_by_id(id).await?;

        if update.status != "approved" {
            return Err(AppError::BadRequest("Update must be approved before deploying".to_string()));
        }

        // Verify agent owns the service
        let service = self.get_by_id(update.service_id).await?;
        if service.agent_id != agent_id {
            return Err(AppError::Forbidden("Not your service".to_string()));
        }

        sqlx::query_as::<_, ServiceUpdate>(
            r#"
            UPDATE service_updates
            SET status = 'deployed', deployed_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .fetch_one(&self.db)
        .await
        .map_err(|_| AppError::NotFound("Service update not found".to_string()))
    }

    // ==================== Billing ====================

    /// Create a billing record
    async fn create_billing_record(
        &self,
        service_id: Uuid,
        period_start: chrono::DateTime<Utc>,
        period_end: chrono::DateTime<Utc>,
        amount: Decimal,
    ) -> Result<ServiceBilling> {
        let billing = sqlx::query_as::<_, ServiceBilling>(
            r#"
            INSERT INTO service_billing (service_id, period_start, period_end, amount_usd)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            "#,
        )
        .bind(service_id)
        .bind(period_start)
        .bind(period_end)
        .bind(amount)
        .fetch_one(&self.db)
        .await?;

        Ok(billing)
    }

    /// List billing records for a service
    pub async fn list_billing(&self, service_id: Uuid) -> Result<BillingListResponse> {
        let records: Vec<ServiceBilling> = sqlx::query_as(
            r#"
            SELECT * FROM service_billing
            WHERE service_id = $1
            ORDER BY period_start DESC
            "#,
        )
        .bind(service_id)
        .fetch_all(&self.db)
        .await?;

        let total = records.len() as i64;
        let total_paid_usd = records
            .iter()
            .filter(|r| r.status == "paid")
            .map(|r| r.amount_usd)
            .sum();

        Ok(BillingListResponse {
            records,
            total,
            total_paid_usd,
        })
    }

    /// Mark billing as paid
    pub async fn mark_billing_paid(
        &self,
        id: Uuid,
        payment_tx: &str,
        escrow_pda: Option<&str>,
    ) -> Result<ServiceBilling> {
        sqlx::query_as::<_, ServiceBilling>(
            r#"
            UPDATE service_billing
            SET status = 'paid', payment_tx = $2, escrow_pda = $3, paid_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(payment_tx)
        .bind(escrow_pda)
        .fetch_one(&self.db)
        .await
        .map_err(|_| AppError::NotFound("Billing record not found".to_string()))
    }
}
