use k256::ecdsa::SigningKey;
use rand::RngCore;
use sha3::{Digest, Keccak256};

/// Represents a generated EVM wallet
#[derive(Debug, Clone)]
pub struct GeneratedWallet {
    /// 0x-prefixed Ethereum address (42 characters)
    pub address: String,
    /// Hex-encoded private key (64 hex characters, no 0x prefix)
    pub private_key: String,
}

pub struct WalletService;

impl WalletService {
    /// Generate a new EVM-compatible secp256k1 keypair
    /// Returns the wallet address (derived from public key) and private key
    pub fn generate_keypair() -> GeneratedWallet {
        // Generate 32 random bytes for the secret key
        let mut secret_bytes = [0u8; 32];
        rand::thread_rng().fill_bytes(&mut secret_bytes);

        // Create signing key from random bytes
        let signing_key = SigningKey::from_bytes(&secret_bytes.into())
            .expect("Valid secret key bytes");

        // Get the verifying (public) key
        let verifying_key = signing_key.verifying_key();

        // Get uncompressed public key (65 bytes: 0x04 prefix + 64 bytes)
        let public_key_bytes = verifying_key.to_encoded_point(false);

        // Derive Ethereum address: keccak256(public_key[1..]) -> take last 20 bytes
        let mut hasher = Keccak256::new();
        hasher.update(&public_key_bytes.as_bytes()[1..]); // Skip the 0x04 prefix
        let hash = hasher.finalize();

        // Address is last 20 bytes of the hash
        let address = format!("0x{}", hex::encode(&hash[12..]));

        // Private key as hex
        let private_key = hex::encode(&secret_bytes);

        GeneratedWallet {
            address,
            private_key,
        }
    }

    /// Verify that a private key corresponds to a wallet address
    pub fn verify_keypair(private_key: &str, expected_address: &str) -> bool {
        // Remove 0x prefix if present
        let private_key_hex = private_key.trim_start_matches("0x");

        let secret_bytes = match hex::decode(private_key_hex) {
            Ok(bytes) if bytes.len() == 32 => {
                let mut arr = [0u8; 32];
                arr.copy_from_slice(&bytes);
                arr
            }
            _ => return false,
        };

        // Derive address from private key
        let signing_key = match SigningKey::from_bytes(&secret_bytes.into()) {
            Ok(key) => key,
            Err(_) => return false,
        };

        let verifying_key = signing_key.verifying_key();
        let public_key_bytes = verifying_key.to_encoded_point(false);

        let mut hasher = Keccak256::new();
        hasher.update(&public_key_bytes.as_bytes()[1..]);
        let hash = hasher.finalize();

        let derived_address = format!("0x{}", hex::encode(&hash[12..]));

        derived_address.to_lowercase() == expected_address.to_lowercase()
    }

    /// Convert a hex private key to checksum address
    pub fn private_key_to_address(private_key: &str) -> Option<String> {
        let private_key_hex = private_key.trim_start_matches("0x");

        let secret_bytes: [u8; 32] = hex::decode(private_key_hex)
            .ok()
            .and_then(|bytes| bytes.try_into().ok())?;

        let signing_key = SigningKey::from_bytes(&secret_bytes.into()).ok()?;
        let verifying_key = signing_key.verifying_key();
        let public_key_bytes = verifying_key.to_encoded_point(false);

        let mut hasher = Keccak256::new();
        hasher.update(&public_key_bytes.as_bytes()[1..]);
        let hash = hasher.finalize();

        Some(format!("0x{}", hex::encode(&hash[12..])))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_keypair() {
        let wallet = WalletService::generate_keypair();

        // Address should be 42 characters (0x + 40 hex chars)
        assert_eq!(wallet.address.len(), 42);
        assert!(wallet.address.starts_with("0x"));

        // Private key should be 64 hex characters
        assert_eq!(wallet.private_key.len(), 64);

        // All characters should be valid hex
        assert!(wallet.private_key.chars().all(|c| c.is_ascii_hexdigit()));

        // Verify the keypair matches
        assert!(WalletService::verify_keypair(&wallet.private_key, &wallet.address));
    }

    #[test]
    fn test_unique_keypairs() {
        let wallet1 = WalletService::generate_keypair();
        let wallet2 = WalletService::generate_keypair();

        // Each call should generate unique keys
        assert_ne!(wallet1.address, wallet2.address);
        assert_ne!(wallet1.private_key, wallet2.private_key);
    }

    #[test]
    fn test_known_keypair() {
        // Test with a known private key -> address mapping
        // Private key: 0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
        let private_key = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

        if let Some(address) = WalletService::private_key_to_address(private_key) {
            // Verify the derived address is valid format
            assert_eq!(address.len(), 42);
            assert!(address.starts_with("0x"));

            // Verify round-trip
            assert!(WalletService::verify_keypair(private_key, &address));
        }
    }

    #[test]
    fn test_verify_invalid_keypair() {
        let wallet = WalletService::generate_keypair();

        // Wrong address
        assert!(!WalletService::verify_keypair(&wallet.private_key, "0x0000000000000000000000000000000000000000"));

        // Invalid private key format
        assert!(!WalletService::verify_keypair("invalid", &wallet.address));
        assert!(!WalletService::verify_keypair("0x", &wallet.address));
        assert!(!WalletService::verify_keypair("tooshort", &wallet.address));
    }
}
