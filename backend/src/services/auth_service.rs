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

#[cfg(test)]
mod tests {
    use super::*;

    fn test_config() -> Config {
        Config {
            server_addr: "127.0.0.1:3001".to_string(),
            database_url: "postgres://test:test@localhost/test".to_string(),
            db_max_connections: 5,
            redis_url: None,
            jwt_secret: "test_secret_key_for_testing_purposes".to_string(),
            jwt_expiry_hours: 24,
            solana_rpc_url: None,
            escrow_program_id: None,
            usdc_mint: None,
            platform_wallet: None,
            fee_new_agent_bps: 1500,
            fee_rising_agent_bps: 1200,
            fee_established_agent_bps: 1000,
            fee_top_rated_agent_bps: 800,
            cors_allowed_origins: vec!["http://localhost:3000".to_string()],
            rate_limit_requests_per_minute: 60,
            rate_limit_burst: 10,
        }
    }

    #[test]
    fn test_challenge_generation() {
        let auth = AuthService::new(test_config());
        let wallet = "7xKXEePxzEQwvFdQdqGwq2hzTpxGqDkT8aN9JwSiNFt";

        let (message, hash) = auth.generate_challenge(wallet);

        assert!(message.contains("AgentHive"));
        assert!(message.contains(wallet));
        assert!(!hash.is_empty());
        assert_eq!(hash.len(), 64); // SHA256 hex is 64 chars
    }

    #[test]
    fn test_jwt_user_token_creation() {
        let auth = AuthService::new(test_config());
        let user_id = Uuid::new_v4();
        let wallet = "7xKXEePxzEQwvFdQdqGwq2hzTpxGqDkT8aN9JwSiNFt";

        let token = auth.create_user_token(user_id, wallet).unwrap();

        assert!(!token.is_empty());
        assert!(token.contains('.')); // JWT has 3 parts separated by dots
    }

    #[test]
    fn test_jwt_agent_token_creation() {
        let auth = AuthService::new(test_config());
        let agent_id = Uuid::new_v4();
        let wallet = "7xKXEePxzEQwvFdQdqGwq2hzTpxGqDkT8aN9JwSiNFt";

        let token = auth.create_agent_token(agent_id, wallet).unwrap();

        assert!(!token.is_empty());
        let claims = auth.verify_token(&token).unwrap();
        assert_eq!(claims.typ, "agent");
        assert_eq!(claims.id, agent_id);
    }

    #[test]
    fn test_jwt_verification() {
        let auth = AuthService::new(test_config());
        let user_id = Uuid::new_v4();
        let wallet = "7xKXEePxzEQwvFdQdqGwq2hzTpxGqDkT8aN9JwSiNFt";

        let token = auth.create_user_token(user_id, wallet).unwrap();
        let claims = auth.verify_token(&token).unwrap();

        assert_eq!(claims.sub, wallet);
        assert_eq!(claims.typ, "user");
        assert_eq!(claims.id, user_id);
        assert!(claims.exp > Utc::now().timestamp());
    }

    #[test]
    fn test_jwt_invalid_token() {
        let auth = AuthService::new(test_config());

        let result = auth.verify_token("invalid.token.here");

        assert!(result.is_err());
    }

    #[test]
    fn test_jwt_wrong_secret() {
        let auth1 = AuthService::new(test_config());
        let mut config2 = test_config();
        config2.jwt_secret = "different_secret".to_string();
        let auth2 = AuthService::new(config2);

        let token = auth1.create_user_token(Uuid::new_v4(), "wallet").unwrap();
        let result = auth2.verify_token(&token);

        assert!(result.is_err());
    }

    #[test]
    fn test_api_key_generation() {
        let key1 = AuthService::generate_api_key();
        let key2 = AuthService::generate_api_key();

        assert!(key1.starts_with("ahk_"));
        assert!(key2.starts_with("ahk_"));
        assert_ne!(key1, key2); // Should be unique
        assert_eq!(key1.len(), 4 + 64); // "ahk_" + 32 bytes hex
    }

    #[test]
    fn test_api_key_hashing() {
        let api_key = AuthService::generate_api_key();
        let hash = AuthService::hash_api_key(&api_key);

        assert_eq!(hash.len(), 64); // SHA256 hex
        assert!(AuthService::verify_api_key(&api_key, &hash));
        assert!(!AuthService::verify_api_key("wrong_key", &hash));
    }

    #[test]
    fn test_api_key_hash_consistency() {
        let api_key = "ahk_test_key_12345";
        let hash1 = AuthService::hash_api_key(api_key);
        let hash2 = AuthService::hash_api_key(api_key);

        assert_eq!(hash1, hash2);
    }
}
