use crate::error::Result;
use serde_json::Value as JsonValue;
use sqlx::PgPool;
use std::net::IpAddr;
use uuid::Uuid;

/// Audit event types for tracking platform activity
#[derive(Debug, Clone, Copy)]
pub enum AuditAction {
    // Authentication
    AuthChallenge,
    AuthSuccess,
    AuthFailure,

    // Job lifecycle
    JobCreated,
    JobPublished,
    JobCancelled,
    JobAssigned,
    JobStarted,
    JobDelivered,
    JobApproved,
    JobDisputed,
    JobCompleted,

    // Bidding
    BidSubmitted,
    BidUpdated,
    BidWithdrawn,
    BidAccepted,

    // Sandbox
    SandboxClaimed,
    SandboxDataAccess,
    SandboxProgressUpdate,
    SandboxResultSubmit,

    // Escrow
    EscrowCreated,
    EscrowFunded,
    EscrowReleased,
    EscrowRefunded,
    EscrowDisputed,

    // Ratings
    RatingSubmitted,

    // Agent
    AgentRegistered,
    AgentUpdated,
    AgentTierChanged,
}

impl AuditAction {
    pub fn as_str(&self) -> &'static str {
        match self {
            AuditAction::AuthChallenge => "auth_challenge",
            AuditAction::AuthSuccess => "auth_success",
            AuditAction::AuthFailure => "auth_failure",
            AuditAction::JobCreated => "job_created",
            AuditAction::JobPublished => "job_published",
            AuditAction::JobCancelled => "job_cancelled",
            AuditAction::JobAssigned => "job_assigned",
            AuditAction::JobStarted => "job_started",
            AuditAction::JobDelivered => "job_delivered",
            AuditAction::JobApproved => "job_approved",
            AuditAction::JobDisputed => "job_disputed",
            AuditAction::JobCompleted => "job_completed",
            AuditAction::BidSubmitted => "bid_submitted",
            AuditAction::BidUpdated => "bid_updated",
            AuditAction::BidWithdrawn => "bid_withdrawn",
            AuditAction::BidAccepted => "bid_accepted",
            AuditAction::SandboxClaimed => "sandbox_claimed",
            AuditAction::SandboxDataAccess => "sandbox_data_access",
            AuditAction::SandboxProgressUpdate => "sandbox_progress_update",
            AuditAction::SandboxResultSubmit => "sandbox_result_submit",
            AuditAction::EscrowCreated => "escrow_created",
            AuditAction::EscrowFunded => "escrow_funded",
            AuditAction::EscrowReleased => "escrow_released",
            AuditAction::EscrowRefunded => "escrow_refunded",
            AuditAction::EscrowDisputed => "escrow_disputed",
            AuditAction::RatingSubmitted => "rating_submitted",
            AuditAction::AgentRegistered => "agent_registered",
            AuditAction::AgentUpdated => "agent_updated",
            AuditAction::AgentTierChanged => "agent_tier_changed",
        }
    }
}

/// Service for recording audit events
#[derive(Clone)]
pub struct AuditService {
    db: PgPool,
}

impl AuditService {
    pub fn new(db: PgPool) -> Self {
        Self { db }
    }

    /// Log an audit event
    pub async fn log(
        &self,
        action: AuditAction,
        agent_id: Option<Uuid>,
        job_id: Option<Uuid>,
        metadata: Option<JsonValue>,
    ) -> Result<()> {
        self.log_with_context(action, agent_id, job_id, None, None, None, metadata).await
    }

    /// Log an audit event with full context
    pub async fn log_with_context(
        &self,
        action: AuditAction,
        agent_id: Option<Uuid>,
        job_id: Option<Uuid>,
        resource_id: Option<&str>,
        bytes_accessed: Option<i64>,
        source_ip: Option<IpAddr>,
        metadata: Option<JsonValue>,
    ) -> Result<()> {
        let ip_str = source_ip.map(|ip| ip.to_string());

        sqlx::query(
            r#"
            INSERT INTO audit_log (agent_id, job_id, action, resource_id, bytes_accessed, source_ip, metadata)
            VALUES ($1, $2, $3, $4, $5, $6::inet, $7)
            "#,
        )
        .bind(agent_id)
        .bind(job_id)
        .bind(action.as_str())
        .bind(resource_id)
        .bind(bytes_accessed)
        .bind(ip_str)
        .bind(metadata)
        .execute(&self.db)
        .await?;

        tracing::info!(
            action = action.as_str(),
            agent_id = ?agent_id,
            job_id = ?job_id,
            "Audit event logged"
        );

        Ok(())
    }

    /// Log data access event (for sandbox)
    pub async fn log_data_access(
        &self,
        agent_id: Uuid,
        job_id: Uuid,
        file_path: &str,
        bytes: i64,
        source_ip: Option<IpAddr>,
    ) -> Result<()> {
        self.log_with_context(
            AuditAction::SandboxDataAccess,
            Some(agent_id),
            Some(job_id),
            Some(file_path),
            Some(bytes),
            source_ip,
            Some(serde_json::json!({ "file": file_path })),
        )
        .await
    }

    /// Query audit logs for a job
    pub async fn get_job_audit_log(&self, job_id: Uuid) -> Result<Vec<AuditEntry>> {
        let entries = sqlx::query_as::<_, AuditEntry>(
            r#"
            SELECT id, timestamp, agent_id, job_id, action, resource_id, bytes_accessed, metadata
            FROM audit_log
            WHERE job_id = $1
            ORDER BY timestamp DESC
            LIMIT 100
            "#,
        )
        .bind(job_id)
        .fetch_all(&self.db)
        .await?;

        Ok(entries)
    }

    /// Query audit logs for an agent
    pub async fn get_agent_audit_log(&self, agent_id: Uuid) -> Result<Vec<AuditEntry>> {
        let entries = sqlx::query_as::<_, AuditEntry>(
            r#"
            SELECT id, timestamp, agent_id, job_id, action, resource_id, bytes_accessed, metadata
            FROM audit_log
            WHERE agent_id = $1
            ORDER BY timestamp DESC
            LIMIT 100
            "#,
        )
        .bind(agent_id)
        .fetch_all(&self.db)
        .await?;

        Ok(entries)
    }
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize)]
pub struct AuditEntry {
    pub id: i64,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub agent_id: Option<Uuid>,
    pub job_id: Option<Uuid>,
    pub action: String,
    pub resource_id: Option<String>,
    pub bytes_accessed: Option<i64>,
    pub metadata: Option<JsonValue>,
}
