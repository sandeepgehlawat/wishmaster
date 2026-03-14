use crate::config::Config;
use crate::error::{AppError, Result};
use crate::models::{Escrow, EscrowDetails, FundTransactionResponse, ReleaseResult};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Clone)]
pub struct EscrowService {
    db: PgPool,
    config: Config,
}

impl EscrowService {
    pub fn new(db: PgPool, config: Config) -> Self {
        Self { db, config }
    }

    /// Create escrow record when job is published
    pub async fn create_escrow(
        &self,
        job_id: Uuid,
        client_wallet: &str,
        amount: f64,
    ) -> Result<Escrow> {
        let id = Uuid::new_v4();

        // Generate PDA address (placeholder - would use Solana SDK)
        let escrow_pda = self.derive_escrow_pda(job_id);

        let escrow = sqlx::query_as::<_, Escrow>(
            r#"
            INSERT INTO escrows (id, job_id, escrow_pda, client_wallet, amount_usdc, status)
            VALUES ($1, $2, $3, $4, $5, 'created')
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(job_id)
        .bind(&escrow_pda)
        .bind(client_wallet)
        .bind(amount)
        .fetch_one(&self.db)
        .await?;

        Ok(escrow)
    }

    /// Get escrow with details
    pub async fn get_escrow(&self, job_id: Uuid) -> Result<EscrowDetails> {
        // Fetch escrow
        let escrow: Escrow = sqlx::query_as(
            "SELECT * FROM escrows WHERE job_id = $1"
        )
        .bind(job_id)
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Escrow not found".to_string()))?;

        // Fetch job details
        let job_info: (String, Uuid, Option<Uuid>) = sqlx::query_as(
            "SELECT title, client_id, agent_id FROM jobs WHERE id = $1"
        )
        .bind(job_id)
        .fetch_one(&self.db)
        .await?;

        // Fetch client name
        let client_name: (String,) = sqlx::query_as(
            "SELECT display_name FROM users WHERE id = $1"
        )
        .bind(job_info.1)
        .fetch_one(&self.db)
        .await?;

        // Fetch agent name if assigned
        let agent_name: Option<String> = if let Some(agent_id) = job_info.2 {
            let result: Option<(String,)> = sqlx::query_as(
                "SELECT display_name FROM agents WHERE id = $1"
            )
            .bind(agent_id)
            .fetch_optional(&self.db)
            .await?;
            result.map(|r| r.0)
        } else {
            None
        };

        Ok(EscrowDetails {
            escrow,
            job_title: job_info.0,
            client_name: client_name.0,
            agent_name,
        })
    }

    /// Generate fund transaction for client to sign
    pub async fn generate_fund_transaction(
        &self,
        job_id: Uuid,
        client_wallet: &str,
    ) -> Result<FundTransactionResponse> {
        let escrow = sqlx::query_as::<_, Escrow>(
            "SELECT * FROM escrows WHERE job_id = $1"
        )
        .bind(job_id)
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Escrow not found".to_string()))?;

        // Verify client owns this escrow
        if escrow.client_wallet != client_wallet {
            return Err(AppError::Forbidden("Not your escrow".to_string()));
        }

        if escrow.status != "created" {
            return Err(AppError::BadRequest("Escrow already funded".to_string()));
        }

        let amount: f64 = escrow.amount_usdc.to_string().parse().unwrap_or(0.0);

        // In production, this would:
        // 1. Create Solana transaction using anchor-client
        // 2. Build deposit instruction
        // 3. Serialize and return base64

        // Placeholder transaction
        let mock_tx = format!(
            "MOCK_TX:{}:{}:{}",
            escrow.escrow_pda, client_wallet, amount
        );
        let tx_base64 = base64::Engine::encode(
            &base64::engine::general_purpose::STANDARD,
            mock_tx.as_bytes(),
        );

        Ok(FundTransactionResponse {
            transaction: tx_base64,
            escrow_pda: escrow.escrow_pda,
            amount_usdc: amount,
        })
    }

    /// Confirm escrow funding (called after client signs tx)
    pub async fn confirm_funding(&self, job_id: Uuid, signature: &str) -> Result<Escrow> {
        // In production, would verify signature on Solana
        // For now, just update status

        let escrow = sqlx::query_as::<_, Escrow>(
            r#"
            UPDATE escrows SET
                status = 'funded',
                funded_at = NOW(),
                fund_tx = $2
            WHERE job_id = $1 AND status = 'created'
            RETURNING *
            "#,
        )
        .bind(job_id)
        .bind(signature)
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| AppError::Conflict("Escrow not in created state".to_string()))?;

        // Transition job to open
        sqlx::query("UPDATE jobs SET status = 'open', published_at = NOW() WHERE id = $1 AND status = 'draft'")
            .bind(job_id)
            .execute(&self.db)
            .await?;

        Ok(escrow)
    }

    /// Lock escrow to agent when bid is accepted
    pub async fn lock_to_agent(&self, job_id: Uuid, agent_wallet: &str) -> Result<Escrow> {
        let escrow = sqlx::query_as::<_, Escrow>(
            r#"
            UPDATE escrows SET
                status = 'locked',
                agent_wallet = $2
            WHERE job_id = $1 AND status = 'funded'
            RETURNING *
            "#,
        )
        .bind(job_id)
        .bind(agent_wallet)
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| AppError::Conflict("Escrow not in funded state".to_string()))?;

        Ok(escrow)
    }

    /// Release escrow to agent (on job approval)
    pub async fn release(&self, job_id: Uuid, trust_tier: &str) -> Result<ReleaseResult> {
        let escrow = sqlx::query_as::<_, Escrow>(
            "SELECT * FROM escrows WHERE job_id = $1"
        )
        .bind(job_id)
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Escrow not found".to_string()))?;

        if escrow.status != "locked" {
            return Err(AppError::BadRequest("Escrow not locked".to_string()));
        }

        let _agent_wallet = escrow.agent_wallet.as_ref()
            .ok_or_else(|| AppError::Internal("No agent wallet".to_string()))?;

        // Calculate fee
        let fee_bps = self.config.get_fee_bps(trust_tier);
        let total: f64 = escrow.amount_usdc.to_string().parse().unwrap_or(0.0);
        let platform_fee = total * (fee_bps as f64) / 10000.0;
        let agent_payout = total - platform_fee;

        // In production, would:
        // 1. Call Solana program to release escrow
        // 2. Wait for confirmation

        let mock_signature = format!("RELEASE_SIG_{}", Uuid::new_v4());

        // Update escrow
        sqlx::query(
            r#"
            UPDATE escrows SET
                status = 'released',
                platform_fee_usdc = $2,
                agent_payout_usdc = $3,
                release_tx = $4,
                released_at = NOW()
            WHERE job_id = $1
            "#,
        )
        .bind(job_id)
        .bind(platform_fee)
        .bind(agent_payout)
        .bind(&mock_signature)
        .execute(&self.db)
        .await?;

        Ok(ReleaseResult {
            signature: mock_signature,
            agent_payout,
            platform_fee,
        })
    }

    /// Refund escrow to client (on cancellation)
    pub async fn refund(&self, job_id: Uuid) -> Result<String> {
        let escrow = sqlx::query_as::<_, Escrow>(
            "SELECT * FROM escrows WHERE job_id = $1"
        )
        .bind(job_id)
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Escrow not found".to_string()))?;

        if escrow.status != "funded" {
            return Err(AppError::BadRequest("Escrow not in refundable state".to_string()));
        }

        // In production, would call Solana program

        let mock_signature = format!("REFUND_SIG_{}", Uuid::new_v4());

        sqlx::query(
            "UPDATE escrows SET status = 'refunded', release_tx = $2 WHERE job_id = $1"
        )
        .bind(job_id)
        .bind(&mock_signature)
        .execute(&self.db)
        .await?;

        Ok(mock_signature)
    }

    /// Derive PDA for escrow account
    fn derive_escrow_pda(&self, job_id: Uuid) -> String {
        // Placeholder - in production would use Solana SDK
        format!("ESCROW_PDA_{}", job_id)
    }
}

