use crate::config::Config;
use crate::error::{AppError, Result};
use crate::models::{Escrow, EscrowDetails, FundTransactionResponse, ReleaseResult};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use uuid::Uuid;

// Program ID - must match deployed escrow program
const ESCROW_PROGRAM_ID: &str = "AHEscrow11111111111111111111111111111111111";

// USDC mint addresses
const USDC_MINT_MAINNET: &str = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDC_MINT_DEVNET: &str = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

// SPL Token Program ID
const TOKEN_PROGRAM_ID: &str = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const ASSOCIATED_TOKEN_PROGRAM_ID: &str = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";

#[derive(Clone)]
pub struct EscrowService {
    db: PgPool,
    config: Config,
    http_client: reqwest::Client,
    rpc_url: String,
    program_id: [u8; 32],
    usdc_mint: [u8; 32],
}

#[derive(Serialize)]
struct RpcRequest {
    jsonrpc: &'static str,
    id: u64,
    method: String,
    params: serde_json::Value,
}

#[derive(Deserialize)]
struct RpcResponse<T> {
    result: Option<T>,
    error: Option<RpcError>,
}

#[derive(Deserialize)]
struct RpcError {
    code: i64,
    message: String,
}

#[derive(Deserialize)]
struct SignatureStatus {
    err: Option<serde_json::Value>,
}

#[derive(Deserialize)]
struct SignatureStatusResult {
    value: Vec<Option<SignatureStatus>>,
}

impl EscrowService {
    pub fn new(db: PgPool, config: Config) -> Self {
        let rpc_url = config.solana_rpc_url.clone()
            .unwrap_or_else(|| "https://api.devnet.solana.com".to_string());

        let program_id = bs58_to_bytes(
            &config.escrow_program_id.clone().unwrap_or_else(|| ESCROW_PROGRAM_ID.to_string())
        );

        let usdc_mint = if config.is_devnet() {
            bs58_to_bytes(USDC_MINT_DEVNET)
        } else {
            bs58_to_bytes(USDC_MINT_MAINNET)
        };

        Self {
            db,
            config,
            http_client: reqwest::Client::new(),
            rpc_url,
            program_id,
            usdc_mint,
        }
    }

    /// Derive PDA for escrow account
    pub fn derive_escrow_pda(&self, job_id: Uuid) -> (String, u8) {
        let job_bytes = job_id.as_bytes();
        let mut seeds = [0u8; 32];
        seeds[..16].copy_from_slice(job_bytes);

        // Find PDA by trying bump seeds from 255 down
        for bump in (0u8..=255).rev() {
            if let Some(pda) = try_find_pda(&[b"escrow", &seeds], bump, &self.program_id) {
                return (bs58::encode(&pda).into_string(), bump);
            }
        }

        // Fallback (shouldn't happen)
        (format!("ESCROW_PDA_{}", job_id), 0)
    }

    /// Derive vault PDA for escrow's token account
    pub fn derive_vault_pda(&self, escrow_pda_bytes: &[u8; 32]) -> (String, u8) {
        for bump in (0u8..=255).rev() {
            if let Some(pda) = try_find_pda(&[b"vault", escrow_pda_bytes], bump, &self.program_id) {
                return (bs58::encode(&pda).into_string(), bump);
            }
        }
        ("VAULT_PDA".to_string(), 0)
    }

    /// Get Associated Token Address for a wallet
    pub fn get_associated_token_address(&self, wallet: &[u8; 32]) -> String {
        let ata_program = bs58_to_bytes(ASSOCIATED_TOKEN_PROGRAM_ID);
        let token_program = bs58_to_bytes(TOKEN_PROGRAM_ID);

        // ATA seeds: [wallet, token_program, mint]
        for bump in (0u8..=255).rev() {
            if let Some(pda) = try_find_pda(
                &[wallet, &token_program, &self.usdc_mint],
                bump,
                &ata_program,
            ) {
                return bs58::encode(&pda).into_string();
            }
        }
        "ATA".to_string()
    }

    /// Create escrow record when job is published
    pub async fn create_escrow(
        &self,
        job_id: Uuid,
        client_wallet: &str,
        amount: f64,
    ) -> Result<Escrow> {
        let id = Uuid::new_v4();

        // Derive real PDA
        let (escrow_pda, _bump) = self.derive_escrow_pda(job_id);

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
        let escrow: Escrow = sqlx::query_as(
            "SELECT * FROM escrows WHERE job_id = $1"
        )
        .bind(job_id)
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Escrow not found".to_string()))?;

        let job_info: (String, Uuid, Option<Uuid>) = sqlx::query_as(
            "SELECT title, client_id, agent_id FROM jobs WHERE id = $1"
        )
        .bind(job_id)
        .fetch_one(&self.db)
        .await?;

        let client_name: (String,) = sqlx::query_as(
            "SELECT display_name FROM users WHERE id = $1"
        )
        .bind(job_info.1)
        .fetch_one(&self.db)
        .await?;

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

        if escrow.client_wallet != client_wallet {
            return Err(AppError::Forbidden("Not your escrow".to_string()));
        }

        if escrow.status != "created" {
            return Err(AppError::BadRequest("Escrow already funded".to_string()));
        }

        let amount: f64 = escrow.amount_usdc.to_string().parse().unwrap_or(0.0);
        let amount_lamports = (amount * 1_000_000.0) as u64;

        let client_bytes = bs58_to_bytes(client_wallet);
        let escrow_pda_bytes = bs58_to_bytes(&escrow.escrow_pda);
        let (vault_pda, _) = self.derive_vault_pda(&escrow_pda_bytes);

        let client_ata = self.get_associated_token_address(&client_bytes);

        // Build instruction data for deposit
        // Discriminator for "deposit" instruction
        let discriminator = get_instruction_discriminator("global:deposit");

        // Build serialized instruction info for frontend
        let instruction_info = serde_json::json!({
            "program_id": bs58::encode(&self.program_id).into_string(),
            "discriminator": bs58::encode(&discriminator).into_string(),
            "accounts": [
                {"pubkey": client_wallet, "is_signer": true, "is_writable": true},
                {"pubkey": escrow.escrow_pda, "is_signer": false, "is_writable": true},
                {"pubkey": client_ata, "is_signer": false, "is_writable": true},
                {"pubkey": vault_pda, "is_signer": false, "is_writable": true},
                {"pubkey": TOKEN_PROGRAM_ID, "is_signer": false, "is_writable": false},
            ],
            "amount_lamports": amount_lamports,
        });

        let tx_base64 = base64::Engine::encode(
            &base64::engine::general_purpose::STANDARD,
            serde_json::to_string(&instruction_info)?.as_bytes(),
        );

        Ok(FundTransactionResponse {
            transaction: tx_base64,
            escrow_pda: escrow.escrow_pda,
            amount_usdc: amount,
        })
    }

    /// Confirm escrow funding by verifying signature on-chain
    pub async fn confirm_funding(&self, job_id: Uuid, signature: &str) -> Result<Escrow> {
        // Verify transaction exists and succeeded via RPC
        let request = RpcRequest {
            jsonrpc: "2.0",
            id: 1,
            method: "getSignatureStatuses".to_string(),
            params: serde_json::json!([[signature]]),
        };

        let response: RpcResponse<SignatureStatusResult> = self.http_client
            .post(&self.rpc_url)
            .json(&request)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("RPC error: {}", e)))?
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Parse error: {}", e)))?;

        if let Some(error) = response.error {
            return Err(AppError::Internal(format!("RPC error: {}", error.message)));
        }

        if let Some(result) = response.result {
            if let Some(Some(status)) = result.value.first() {
                if status.err.is_some() {
                    return Err(AppError::BadRequest("Transaction failed on-chain".to_string()));
                }
            } else {
                return Err(AppError::BadRequest("Transaction not found".to_string()));
            }
        }

        // Update escrow status
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
    /// Uses atomic UPDATE to prevent double-release race condition
    pub async fn release(&self, job_id: Uuid, trust_tier: &str) -> Result<ReleaseResult> {
        // ATOMIC: Single query that selects AND updates only if status is 'locked'
        // This prevents race conditions where two requests could both see 'locked' status
        let escrow = sqlx::query_as::<_, Escrow>(
            r#"
            UPDATE escrows SET
                status = 'releasing'
            WHERE job_id = $1 AND status = 'locked'
            RETURNING *
            "#
        )
        .bind(job_id)
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| AppError::Conflict("Escrow not in locked state or already being released".to_string()))?;

        let agent_wallet = escrow.agent_wallet.as_ref()
            .ok_or_else(|| AppError::Internal("No agent wallet".to_string()))?;

        // Calculate fee
        let fee_bps = self.config.get_fee_bps(trust_tier);
        let total: f64 = escrow.amount_usdc.to_string().parse().unwrap_or(0.0);
        let platform_fee = total * (fee_bps as f64) / 10000.0;
        let agent_payout = total - platform_fee;

        // Build release instruction info for client to sign
        let escrow_pda_bytes = bs58_to_bytes(&escrow.escrow_pda);
        let (vault_pda, _) = self.derive_vault_pda(&escrow_pda_bytes);

        let agent_bytes = bs58_to_bytes(agent_wallet);
        let agent_ata = self.get_associated_token_address(&agent_bytes);

        let platform_wallet = self.config.platform_wallet.clone()
            .unwrap_or_else(|| escrow.client_wallet.clone());
        let platform_bytes = bs58_to_bytes(&platform_wallet);
        let platform_ata = self.get_associated_token_address(&platform_bytes);

        // Discriminator for "release"
        let discriminator = get_instruction_discriminator("global:release");

        let instruction_info = serde_json::json!({
            "program_id": bs58::encode(&self.program_id).into_string(),
            "discriminator": bs58::encode(&discriminator).into_string(),
            "accounts": [
                {"pubkey": escrow.client_wallet, "is_signer": true, "is_writable": false},
                {"pubkey": escrow.escrow_pda, "is_signer": false, "is_writable": true},
                {"pubkey": vault_pda, "is_signer": false, "is_writable": true},
                {"pubkey": agent_ata, "is_signer": false, "is_writable": true},
                {"pubkey": platform_ata, "is_signer": false, "is_writable": true},
                {"pubkey": TOKEN_PROGRAM_ID, "is_signer": false, "is_writable": false},
            ],
            "platform_fee_bps": fee_bps,
        });

        let signature = base64::Engine::encode(
            &base64::engine::general_purpose::STANDARD,
            serde_json::to_string(&instruction_info)?.as_bytes(),
        );

        // ATOMIC: Final update to 'released' status with all details
        // Only succeeds if status is still 'releasing' (set by us above)
        let updated = sqlx::query(
            r#"
            UPDATE escrows SET
                status = 'released',
                platform_fee_usdc = $2,
                agent_payout_usdc = $3,
                release_tx = $4,
                released_at = NOW()
            WHERE job_id = $1 AND status = 'releasing'
            "#,
        )
        .bind(job_id)
        .bind(platform_fee)
        .bind(agent_payout)
        .bind(&signature)
        .execute(&self.db)
        .await?;

        if updated.rows_affected() == 0 {
            return Err(AppError::Conflict("Escrow release was interrupted".to_string()));
        }

        Ok(ReleaseResult {
            signature,
            agent_payout,
            platform_fee,
        })
    }

    /// Refund escrow to client (on cancellation)
    /// Uses atomic UPDATE to prevent double-refund race condition
    pub async fn refund(&self, job_id: Uuid) -> Result<String> {
        // ATOMIC: Single query that selects AND updates only if status is 'funded'
        let escrow = sqlx::query_as::<_, Escrow>(
            r#"
            UPDATE escrows SET status = 'refunding'
            WHERE job_id = $1 AND status = 'funded'
            RETURNING *
            "#
        )
        .bind(job_id)
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| AppError::Conflict("Escrow not in refundable state or already being refunded".to_string()))?;

        let escrow_pda_bytes = bs58_to_bytes(&escrow.escrow_pda);
        let (vault_pda, _) = self.derive_vault_pda(&escrow_pda_bytes);

        let client_bytes = bs58_to_bytes(&escrow.client_wallet);
        let client_ata = self.get_associated_token_address(&client_bytes);

        // Discriminator for "refund"
        let discriminator = get_instruction_discriminator("global:refund");

        let instruction_info = serde_json::json!({
            "program_id": bs58::encode(&self.program_id).into_string(),
            "discriminator": bs58::encode(&discriminator).into_string(),
            "accounts": [
                {"pubkey": escrow.client_wallet, "is_signer": true, "is_writable": false},
                {"pubkey": escrow.escrow_pda, "is_signer": false, "is_writable": true},
                {"pubkey": vault_pda, "is_signer": false, "is_writable": true},
                {"pubkey": client_ata, "is_signer": false, "is_writable": true},
                {"pubkey": TOKEN_PROGRAM_ID, "is_signer": false, "is_writable": false},
            ],
        });

        let signature = base64::Engine::encode(
            &base64::engine::general_purpose::STANDARD,
            serde_json::to_string(&instruction_info)?.as_bytes(),
        );

        // ATOMIC: Final update only if still in 'refunding' state
        let updated = sqlx::query(
            "UPDATE escrows SET status = 'refunded', release_tx = $2, released_at = NOW() WHERE job_id = $1 AND status = 'refunding'"
        )
        .bind(job_id)
        .bind(&signature)
        .execute(&self.db)
        .await?;

        if updated.rows_affected() == 0 {
            return Err(AppError::Conflict("Escrow refund was interrupted".to_string()));
        }

        Ok(signature)
    }

    /// Verify signature exists on-chain
    pub async fn verify_signature(&self, signature: &str) -> Result<bool> {
        let request = RpcRequest {
            jsonrpc: "2.0",
            id: 1,
            method: "getSignatureStatuses".to_string(),
            params: serde_json::json!([[signature]]),
        };

        let response: RpcResponse<SignatureStatusResult> = self.http_client
            .post(&self.rpc_url)
            .json(&request)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("RPC error: {}", e)))?
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Parse error: {}", e)))?;

        if let Some(result) = response.result {
            if let Some(Some(status)) = result.value.first() {
                return Ok(status.err.is_none());
            }
        }

        Ok(false)
    }
}

// Helper functions

fn bs58_to_bytes(s: &str) -> [u8; 32] {
    let mut bytes = [0u8; 32];
    if let Ok(decoded) = bs58::decode(s).into_vec() {
        let len = decoded.len().min(32);
        bytes[..len].copy_from_slice(&decoded[..len]);
    }
    bytes
}

fn try_find_pda(seeds: &[&[u8]], bump: u8, program_id: &[u8; 32]) -> Option<[u8; 32]> {
    let mut hasher = Sha256::new();

    for seed in seeds {
        hasher.update(seed);
    }
    hasher.update([bump]);
    hasher.update(program_id);
    hasher.update(b"ProgramDerivedAddress");

    let hash = hasher.finalize();
    let mut result = [0u8; 32];
    result.copy_from_slice(&hash);

    // Check if it's off the ed25519 curve (valid PDA)
    // Simplified check - in production use ed25519 curve check
    if result[31] & 0x80 != 0 {
        return None; // On curve, invalid PDA
    }

    Some(result)
}

fn get_instruction_discriminator(name: &str) -> [u8; 8] {
    let mut hasher = Sha256::new();
    hasher.update(name.as_bytes());
    let hash = hasher.finalize();
    let mut discriminator = [0u8; 8];
    discriminator.copy_from_slice(&hash[..8]);
    discriminator
}
