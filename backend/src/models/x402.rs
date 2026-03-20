use serde::{Deserialize, Serialize};

/// x402 Payment Request (sent in 402 response headers/body)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct X402PaymentRequest {
    /// Network identifier (e.g., "xlayer")
    pub network: String,
    /// Token symbol (e.g., "USDC")
    pub token: String,
    /// Amount in token's smallest unit (6 decimals for USDC)
    pub amount: u64,
    /// Recipient wallet address
    pub recipient: String,
    /// Unique request identifier for replay protection
    pub nonce: String,
    /// Expiration timestamp (Unix seconds)
    pub expires: u64,
    /// Optional description of what payment is for
    pub description: Option<String>,
}

/// x402 Payment Proof (sent by payer in retry request)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct X402PaymentProof {
    /// Transaction hash on-chain
    pub tx_hash: String,
    /// Must match request nonce
    pub nonce: String,
    /// Payer wallet address
    pub payer: String,
}

/// Payment verification result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct X402VerificationResult {
    /// Whether payment is valid
    pub valid: bool,
    /// Amount that was paid
    pub amount_paid: u64,
    /// Recipient address
    pub recipient: String,
    /// Error message if invalid
    pub error: Option<String>,
}

/// Cached payment nonce (prevent replay attacks)
#[derive(Debug, Clone)]
pub struct PaymentNonce {
    pub nonce: String,
    pub recipient: String,
    pub amount: u64,
    pub expires: u64,
    pub used: bool,
    pub created_at: u64,
}

/// x402 response for API errors
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct X402ErrorResponse {
    pub error: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payment: Option<X402PaymentRequest>,
}

/// OKX API transfer request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OkxTransferRequest {
    #[serde(rename = "fromAddr")]
    pub from_addr: String,
    #[serde(rename = "toAddr")]
    pub to_addr: String,
    #[serde(rename = "tokenSymbol")]
    pub token_symbol: String,
    #[serde(rename = "tokenAmount")]
    pub token_amount: String,
    #[serde(rename = "chainId")]
    pub chain_id: String,
}

/// OKX API transfer response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OkxTransferResponse {
    pub code: String,
    pub msg: String,
    pub data: Option<Vec<OkxTransferData>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OkxTransferData {
    #[serde(rename = "txHash")]
    pub tx_hash: Option<String>,
    #[serde(rename = "orderId")]
    pub order_id: Option<String>,
}

/// Execute payment request (for SDK internal use)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutePaymentRequest {
    pub from: String,
    pub to: String,
    pub amount: f64,
    pub nonce: String,
}

/// Execute payment response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutePaymentResponse {
    pub tx_hash: String,
    pub success: bool,
}
