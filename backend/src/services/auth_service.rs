use crate::config::Config;
use crate::error::{AppError, Result};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use k256::ecdsa::{RecoveryId, Signature, VerifyingKey};
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
            "Sign this message to authenticate with WishMaster.\n\nWallet: {}\nNonce: {}\nTimestamp: {}",
            wallet_address, nonce, timestamp
        );
        let message_hash = hex::encode(Sha256::digest(message.as_bytes()));
        (message, message_hash)
    }

    /// Verify an EVM wallet signature (secp256k1/personal_sign)
    pub fn verify_signature(
        &self,
        wallet_address: &str,
        message: &str,
        signature: &str,
    ) -> Result<bool> {
        tracing::info!("Verifying EVM signature for wallet: {}", wallet_address);
        tracing::debug!("Message: {}", message);
        tracing::debug!("Signature (first 20 chars): {}...", &signature[..signature.len().min(20)]);

        // Parse wallet address
        let expected_address = wallet_address.to_lowercase();
        if !expected_address.starts_with("0x") || expected_address.len() != 42 {
            return Err(AppError::BadRequest("Invalid wallet address format".to_string()));
        }

        // Decode signature (65 bytes: r(32) + s(32) + v(1))
        let sig_hex = signature.trim_start_matches("0x");
        let sig_bytes = hex::decode(sig_hex).map_err(|e| {
            tracing::error!("Failed to decode signature hex: {}", e);
            AppError::BadRequest(format!("Invalid signature encoding: {}", e))
        })?;

        if sig_bytes.len() != 65 {
            tracing::error!("Invalid signature length: {} (expected 65)", sig_bytes.len());
            return Err(AppError::BadRequest(format!(
                "Invalid signature length: {} (expected 65)",
                sig_bytes.len()
            )));
        }

        // Split signature into r, s, v
        let r = &sig_bytes[0..32];
        let s = &sig_bytes[32..64];
        let v = sig_bytes[64];

        // Convert v to recovery id (EIP-155 compatible)
        let recovery_id = match v {
            0 | 1 => v,
            27 | 28 => v - 27,
            _ => {
                tracing::error!("Invalid recovery id: {}", v);
                return Err(AppError::BadRequest(format!("Invalid recovery id: {}", v)));
            }
        };

        // Create the Ethereum signed message hash
        // personal_sign uses: "\x19Ethereum Signed Message:\n" + len(message) + message
        let prefixed_message = format!(
            "\x19Ethereum Signed Message:\n{}{}",
            message.len(),
            message
        );
        let message_hash = keccak256(prefixed_message.as_bytes());

        // Parse signature components
        let mut sig_array = [0u8; 64];
        sig_array[..32].copy_from_slice(r);
        sig_array[32..].copy_from_slice(s);

        let signature = Signature::from_slice(&sig_array).map_err(|e| {
            tracing::error!("Failed to parse signature: {}", e);
            AppError::BadRequest(format!("Invalid signature: {}", e))
        })?;

        let recovery_id = RecoveryId::try_from(recovery_id).map_err(|e| {
            tracing::error!("Failed to parse recovery id: {}", e);
            AppError::BadRequest(format!("Invalid recovery id: {}", e))
        })?;

        // Recover the public key
        let recovered_key = VerifyingKey::recover_from_prehash(&message_hash, &signature, recovery_id)
            .map_err(|e| {
                tracing::error!("Failed to recover public key: {}", e);
                AppError::BadRequest(format!("Signature recovery failed: {}", e))
            })?;

        // Derive address from public key
        let public_key_bytes = recovered_key.to_encoded_point(false);
        let public_key_hash = keccak256(&public_key_bytes.as_bytes()[1..]); // Skip the 0x04 prefix
        let recovered_address = format!("0x{}", hex::encode(&public_key_hash[12..]));

        let is_valid = recovered_address.to_lowercase() == expected_address;
        tracing::info!(
            "Signature verification result: {} (recovered: {}, expected: {})",
            is_valid,
            recovered_address,
            expected_address
        );

        Ok(is_valid)
    }

    /// Create a JWT token for a user
    pub fn create_user_token(&self, user_id: Uuid, wallet_address: &str) -> Result<String> {
        let now = Utc::now();
        let exp = now + Duration::hours(self.config.jwt_expiry_hours);

        let claims = Claims {
            sub: wallet_address.to_lowercase(),
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
            sub: wallet_address.to_lowercase(),
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

/// Keccak-256 hash function (Ethereum's hash function)
fn keccak256(data: &[u8]) -> [u8; 32] {
    use sha3::{Digest, Keccak256};
    let mut hasher = Keccak256::new();
    hasher.update(data);
    let result = hasher.finalize();
    let mut output = [0u8; 32];
    output.copy_from_slice(&result);
    output
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
            evm_rpc_url: None,
            chain_id: Some(1952),
            escrow_contract_address: None,
            usdc_token_address: None,
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
        let wallet = "0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab12";

        let (message, hash) = auth.generate_challenge(wallet);

        assert!(message.contains("WishMaster"));
        assert!(message.contains(wallet));
        assert!(!hash.is_empty());
        assert_eq!(hash.len(), 64); // SHA256 hex is 64 chars
    }

    #[test]
    fn test_jwt_user_token_creation() {
        let auth = AuthService::new(test_config());
        let user_id = Uuid::new_v4();
        let wallet = "0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab12";

        let token = auth.create_user_token(user_id, wallet).unwrap();

        assert!(!token.is_empty());
        assert!(token.contains('.')); // JWT has 3 parts separated by dots
    }

    #[test]
    fn test_jwt_agent_token_creation() {
        let auth = AuthService::new(test_config());
        let agent_id = Uuid::new_v4();
        let wallet = "0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab12";

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
        let wallet = "0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab12";

        let token = auth.create_user_token(user_id, wallet).unwrap();
        let claims = auth.verify_token(&token).unwrap();

        assert_eq!(claims.sub, wallet.to_lowercase());
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

        let token = auth1.create_user_token(Uuid::new_v4(), "0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab12").unwrap();
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
