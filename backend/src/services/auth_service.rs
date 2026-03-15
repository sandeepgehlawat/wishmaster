use crate::config::Config;
use crate::error::{AppError, Result};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use rand::Rng;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,      // Subject (wallet address or agent id)
    pub typ: String,      // "user" or "agent"
    pub id: Uuid,         // User or Agent UUID
    pub exp: i64,         // Expiration timestamp
    pub iat: i64,         // Issued at
}

#[derive(Debug, Clone)]
pub struct AuthService {
    config: Config,
}

impl AuthService {
    pub fn new(config: Config) -> Self {
        Self { config }
    }

    /// Generate a challenge message for wallet signing
    pub fn generate_challenge(&self, wallet_address: &str) -> (String, String) {
        let nonce: u64 = rand::thread_rng().gen();
        let timestamp = Utc::now().timestamp();
        let message = format!(
            "Sign this message to authenticate with AgentHive.\n\nWallet: {}\nNonce: {}\nTimestamp: {}",
            wallet_address, nonce, timestamp
        );
        let message_hash = hex::encode(Sha256::digest(message.as_bytes()));
        (message, message_hash)
    }

    /// Verify a Solana wallet signature (Ed25519)
    pub fn verify_signature(
        &self,
        wallet_address: &str,
        message: &str,
        signature: &str,
    ) -> Result<bool> {
        use ed25519_dalek::{Signature, Verifier, VerifyingKey};

        tracing::info!("Verifying signature for wallet: {}", wallet_address);
        tracing::debug!("Message: {}", message);
        tracing::debug!("Signature (first 20 chars): {}...", &signature[..signature.len().min(20)]);

        // Decode wallet address (base58 Solana pubkey)
        let pubkey_bytes = bs58::decode(wallet_address)
            .into_vec()
            .map_err(|e| {
                tracing::error!("Failed to decode wallet address: {}", e);
                AppError::BadRequest(format!("Invalid wallet address: {}", e))
            })?;

        if pubkey_bytes.len() != 32 {
            tracing::error!("Invalid wallet address length: {}", pubkey_bytes.len());
            return Err(AppError::BadRequest("Invalid wallet address length".to_string()));
        }

        let pubkey_array: [u8; 32] = pubkey_bytes
            .try_into()
            .map_err(|_| AppError::BadRequest("Invalid pubkey bytes".to_string()))?;

        let verifying_key = VerifyingKey::from_bytes(&pubkey_array)
            .map_err(|e| {
                tracing::error!("Failed to create verifying key: {}", e);
                AppError::BadRequest(format!("Invalid public key: {}", e))
            })?;

        // Decode signature - always try base58 first since Solana wallets use it
        let sig_bytes = bs58::decode(signature)
            .into_vec()
            .or_else(|_| {
                // Fallback to base64 if base58 fails
                tracing::debug!("Base58 decode failed, trying base64");
                base64::Engine::decode(&base64::engine::general_purpose::STANDARD, signature)
            })
            .map_err(|e| {
                tracing::error!("Failed to decode signature: {}", e);
                AppError::BadRequest(format!("Invalid signature encoding: {}", e))
            })?;

        tracing::debug!("Decoded signature length: {}", sig_bytes.len());

        if sig_bytes.len() != 64 {
            tracing::error!("Invalid signature length: {} (expected 64)", sig_bytes.len());
            return Err(AppError::BadRequest(format!(
                "Invalid signature length: {} (expected 64)",
                sig_bytes.len()
            )));
        }

        let sig_array: [u8; 64] = sig_bytes
            .try_into()
            .map_err(|_| AppError::BadRequest("Invalid signature bytes".to_string()))?;

        let signature = Signature::from_bytes(&sig_array);

        let is_valid = verifying_key.verify(message.as_bytes(), &signature).is_ok();
        tracing::info!("Signature verification result: {}", is_valid);

        Ok(is_valid)
    }

    /// Create a JWT token for a user
    pub fn create_user_token(&self, user_id: Uuid, wallet_address: &str) -> Result<String> {
        let now = Utc::now();
        let exp = now + Duration::hours(self.config.jwt_expiry_hours);

        let claims = Claims {
            sub: wallet_address.to_string(),
            typ: "user".to_string(),
            id: user_id,
            exp: exp.timestamp(),
            iat: now.timestamp(),
        };

        encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(self.config.jwt_secret.as_bytes()),
        )
        .map_err(AppError::Jwt)
    }

    /// Create a JWT token for an agent
    pub fn create_agent_token(&self, agent_id: Uuid, wallet_address: &str) -> Result<String> {
        let now = Utc::now();
        let exp = now + Duration::hours(self.config.jwt_expiry_hours);

        let claims = Claims {
            sub: wallet_address.to_string(),
            typ: "agent".to_string(),
            id: agent_id,
            exp: exp.timestamp(),
            iat: now.timestamp(),
        };

        encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(self.config.jwt_secret.as_bytes()),
        )
        .map_err(AppError::Jwt)
    }

    /// Verify and decode a JWT token
    pub fn verify_token(&self, token: &str) -> Result<Claims> {
        let token_data = decode::<Claims>(
            token,
            &DecodingKey::from_secret(self.config.jwt_secret.as_bytes()),
            &Validation::default(),
        )
        .map_err(AppError::Jwt)?;

        Ok(token_data.claims)
    }

    /// Hash an API key for storage
    pub fn hash_api_key(api_key: &str) -> String {
        hex::encode(Sha256::digest(api_key.as_bytes()))
    }

    /// Generate a new API key
    pub fn generate_api_key() -> String {
        let random_bytes: [u8; 32] = rand::thread_rng().gen();
        format!("ahk_{}", hex::encode(random_bytes))
    }

    /// Verify an API key against its hash
    pub fn verify_api_key(api_key: &str, hash: &str) -> bool {
        Self::hash_api_key(api_key) == hash
    }
}
