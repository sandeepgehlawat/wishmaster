use crate::config::Config;
use crate::error::{AppError, Result};
use crate::models::{Escrow, EscrowDetails, FundTransactionResponse, ReleaseResult};
use serde::{Deserialize, Serialize};
use sha3::{Digest, Keccak256};
use sqlx::PgPool;
use uuid::Uuid;

// Default escrow contract address (to be deployed on X Layer)
const DEFAULT_ESCROW_CONTRACT: &str = "0x0000000000000000000000000000000000000000";

// USDC token addresses on X Layer
const USDC_XLAYER_MAINNET: &str = "0x0000000000000000000000000000000000000000"; // TBD after deployment
const USDC_XLAYER_TESTNET: &str = "0x0000000000000000000000000000000000000000"; // TBD after deployment

#[derive(Clone)]
pub struct EscrowService {
    db: PgPool,
    config: Config,
    http_client: reqwest::Client,
    rpc_url: String,
    escrow_contract: String,
    usdc_token: String,
    chain_id: u64,
}

#[derive(Serialize)]
struct JsonRpcRequest {
    jsonrpc: &'static str,
    id: u64,
    method: String,
    params: serde_json::Value,
}

#[derive(Deserialize)]
struct JsonRpcResponse<T> {
    result: Option<T>,
    error: Option<JsonRpcError>,
}

#[derive(Deserialize)]
struct JsonRpcError {
    code: i64,
    message: String,
}

#[derive(Deserialize)]
struct TransactionReceipt {
    status: String,
    #[serde(rename = "blockNumber")]
    block_number: Option<String>,
    #[serde(rename = "transactionHash")]
    transaction_hash: String,
}

impl EscrowService {
    pub fn new(db: PgPool, config: Config) -> Self {
        let rpc_url = config.get_rpc_url();
        let chain_id = config.chain_id.unwrap_or(195); // Default to X Layer Testnet

        let escrow_contract = config.escrow_contract_address.clone()
            .unwrap_or_else(|| DEFAULT_ESCROW_CONTRACT.to_string());

        let usdc_token = config.usdc_token_address.clone()
            .unwrap_or_else(|| {
                if config.is_mainnet() {
                    USDC_XLAYER_MAINNET.to_string()
                } else {
                    USDC_XLAYER_TESTNET.to_string()
                }
            });

        Self {
            db,
            config,
            http_client: reqwest::Client::new(),
            rpc_url,
            escrow_contract,
            usdc_token,
            chain_id,
        }
    }

    /// Generate a deterministic escrow ID from job ID
    fn generate_escrow_id(job_id: Uuid) -> String {
        let mut hasher = Keccak256::new();
        hasher.update(job_id.as_bytes());
        let hash = hasher.finalize();
        format!("0x{}", hex::encode(&hash[..32]))
    }

    /// Create escrow record when job is published
    pub async fn create_escrow(
        &self,
        job_id: Uuid,
        client_wallet: &str,
        amount: f64,
    ) -> Result<Escrow> {
        let id = Uuid::new_v4();

        // Generate deterministic escrow ID from job ID
        let escrow_id = Self::generate_escrow_id(job_id);

        let escrow = sqlx::query_as::<_, Escrow>(
            r#"
            INSERT INTO escrows (id, job_id, escrow_pda, client_wallet, amount_usdc, status)
            VALUES ($1, $2, $3, $4, $5, 'created')
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(job_id)
        .bind(&escrow_id) // Using escrow_pda column for escrow_id
        .bind(client_wallet.to_lowercase())
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

    /// Generate fund transaction data for client to sign
    /// This returns the contract call data for the deposit function
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

        if escrow.client_wallet.to_lowercase() != client_wallet.to_lowercase() {
            return Err(AppError::Forbidden("Not your escrow".to_string()));
        }

        if escrow.status != "created" {
            return Err(AppError::BadRequest("Escrow already funded".to_string()));
        }

        let amount: f64 = escrow.amount_usdc.to_string().parse().unwrap_or(0.0);
        // USDC has 6 decimals
        let amount_wei = (amount * 1_000_000.0) as u64;

        // Generate escrow ID (bytes32)
        let escrow_id = Self::generate_escrow_id(job_id);

        // ABI encode: deposit(bytes32 jobId, uint256 amount)
        // Function selector: first 4 bytes of keccak256("deposit(bytes32,uint256)")
        let function_selector = &keccak256(b"deposit(bytes32,uint256)")[..4];

        // Encode jobId as bytes32 (pad to 32 bytes)
        let job_id_bytes = hex::decode(&escrow_id[2..]).unwrap_or_default();
        let mut job_id_padded = [0u8; 32];
        let copy_len = job_id_bytes.len().min(32);
        job_id_padded[..copy_len].copy_from_slice(&job_id_bytes[..copy_len]);

        // Encode amount as uint256 (pad to 32 bytes)
        let mut amount_bytes = [0u8; 32];
        let amount_be = amount_wei.to_be_bytes();
        amount_bytes[24..].copy_from_slice(&amount_be);

        // Combine: selector + jobId + amount
        let mut calldata = Vec::with_capacity(4 + 64);
        calldata.extend_from_slice(function_selector);
        calldata.extend_from_slice(&job_id_padded);
        calldata.extend_from_slice(&amount_bytes);

        // Also need to approve USDC transfer first
        // approve(address spender, uint256 amount)
        let approve_selector = &keccak256(b"approve(address,uint256)")[..4];
        let mut spender_padded = [0u8; 32];
        let contract_bytes = hex::decode(&self.escrow_contract[2..]).unwrap_or_default();
        spender_padded[12..].copy_from_slice(&contract_bytes[..20.min(contract_bytes.len())]);

        let mut approve_calldata = Vec::with_capacity(4 + 64);
        approve_calldata.extend_from_slice(approve_selector);
        approve_calldata.extend_from_slice(&spender_padded);
        approve_calldata.extend_from_slice(&amount_bytes);

        // Return transaction info for frontend
        let tx_info = serde_json::json!({
            "escrow_contract": self.escrow_contract,
            "usdc_token": self.usdc_token,
            "chain_id": self.chain_id,
            "approve": {
                "to": self.usdc_token,
                "data": format!("0x{}", hex::encode(&approve_calldata)),
                "value": "0x0",
            },
            "deposit": {
                "to": self.escrow_contract,
                "data": format!("0x{}", hex::encode(&calldata)),
                "value": "0x0",
            },
            "amount_usdc": amount,
            "amount_wei": amount_wei,
        });

        let tx_base64 = base64::Engine::encode(
            &base64::engine::general_purpose::STANDARD,
            serde_json::to_string(&tx_info)?.as_bytes(),
        );

        Ok(FundTransactionResponse {
            transaction: tx_base64,
            escrow_pda: escrow_id, // Using escrow_id instead of PDA
            amount_usdc: amount,
        })
    }

    /// Confirm escrow funding by verifying transaction receipt on-chain
    pub async fn confirm_funding(&self, job_id: Uuid, tx_hash: &str) -> Result<Escrow> {
        // Verify transaction exists and succeeded via RPC
        let request = JsonRpcRequest {
            jsonrpc: "2.0",
            id: 1,
            method: "eth_getTransactionReceipt".to_string(),
            params: serde_json::json!([tx_hash]),
        };

        let response: JsonRpcResponse<TransactionReceipt> = self.http_client
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

        if let Some(receipt) = response.result {
            // Check status: "0x1" = success, "0x0" = failure
            if receipt.status != "0x1" {
                return Err(AppError::BadRequest("Transaction failed on-chain".to_string()));
            }
        } else {
            return Err(AppError::BadRequest("Transaction not found or pending".to_string()));
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
        .bind(tx_hash)
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
        .bind(agent_wallet.to_lowercase())
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| AppError::Conflict("Escrow not in funded state".to_string()))?;

        Ok(escrow)
    }

    /// Release escrow to agent (on job approval)
    /// Uses atomic UPDATE to prevent double-release race condition
    pub async fn release(&self, job_id: Uuid, trust_tier: &str) -> Result<ReleaseResult> {
        // ATOMIC: Single query that selects AND updates only if status is 'locked'
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

        // Generate release transaction data
        // release(bytes32 jobId)
        let escrow_id = Self::generate_escrow_id(job_id);
        let function_selector = &keccak256(b"release(bytes32)")[..4];

        let job_id_bytes = hex::decode(&escrow_id[2..]).unwrap_or_default();
        let mut job_id_padded = [0u8; 32];
        let copy_len = job_id_bytes.len().min(32);
        job_id_padded[..copy_len].copy_from_slice(&job_id_bytes[..copy_len]);

        let mut calldata = Vec::with_capacity(4 + 32);
        calldata.extend_from_slice(function_selector);
        calldata.extend_from_slice(&job_id_padded);

        let release_tx_info = serde_json::json!({
            "to": self.escrow_contract,
            "data": format!("0x{}", hex::encode(&calldata)),
            "chain_id": self.chain_id,
            "agent_payout": agent_payout,
            "platform_fee": platform_fee,
            "agent_wallet": agent_wallet,
        });

        let signature = base64::Engine::encode(
            &base64::engine::general_purpose::STANDARD,
            serde_json::to_string(&release_tx_info)?.as_bytes(),
        );

        // ATOMIC: Final update to 'released' status with all details
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

        // Generate refund transaction data
        // refund(bytes32 jobId)
        let escrow_id = Self::generate_escrow_id(job_id);
        let function_selector = &keccak256(b"refund(bytes32)")[..4];

        let job_id_bytes = hex::decode(&escrow_id[2..]).unwrap_or_default();
        let mut job_id_padded = [0u8; 32];
        let copy_len = job_id_bytes.len().min(32);
        job_id_padded[..copy_len].copy_from_slice(&job_id_bytes[..copy_len]);

        let mut calldata = Vec::with_capacity(4 + 32);
        calldata.extend_from_slice(function_selector);
        calldata.extend_from_slice(&job_id_padded);

        let refund_tx_info = serde_json::json!({
            "to": self.escrow_contract,
            "data": format!("0x{}", hex::encode(&calldata)),
            "chain_id": self.chain_id,
            "client_wallet": escrow.client_wallet,
            "amount": escrow.amount_usdc,
        });

        let signature = base64::Engine::encode(
            &base64::engine::general_purpose::STANDARD,
            serde_json::to_string(&refund_tx_info)?.as_bytes(),
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

    /// Verify transaction exists on-chain
    pub async fn verify_transaction(&self, tx_hash: &str) -> Result<bool> {
        let request = JsonRpcRequest {
            jsonrpc: "2.0",
            id: 1,
            method: "eth_getTransactionReceipt".to_string(),
            params: serde_json::json!([tx_hash]),
        };

        let response: JsonRpcResponse<TransactionReceipt> = self.http_client
            .post(&self.rpc_url)
            .json(&request)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("RPC error: {}", e)))?
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Parse error: {}", e)))?;

        if let Some(receipt) = response.result {
            return Ok(receipt.status == "0x1");
        }

        Ok(false)
    }
}

/// Keccak-256 hash function (Ethereum's hash function)
fn keccak256(data: &[u8]) -> [u8; 32] {
    let mut hasher = Keccak256::new();
    hasher.update(data);
    let result = hasher.finalize();
    let mut output = [0u8; 32];
    output.copy_from_slice(&result);
    output
}
