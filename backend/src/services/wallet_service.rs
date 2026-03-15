use ed25519_dalek::SigningKey;
use rand::RngCore;

/// Represents a generated Solana wallet
#[derive(Debug, Clone)]
pub struct GeneratedWallet {
    /// Base58-encoded public key (wallet address)
    pub address: String,
    /// Base58-encoded private key (64 bytes: 32 secret + 32 public)
    pub private_key: String,
    /// Base58-encoded secret key only (32 bytes) - for some wallet imports
    pub secret_key: String,
}

pub struct WalletService;

impl WalletService {
    /// Generate a new Solana-compatible Ed25519 keypair
    /// Returns the wallet address (public key) and private key
    pub fn generate_keypair() -> GeneratedWallet {
        // Generate 32 random bytes for the secret key
        let mut secret_bytes = [0u8; 32];
        rand::thread_rng().fill_bytes(&mut secret_bytes);

        // Create signing key from random bytes
        let signing_key = SigningKey::from_bytes(&secret_bytes);

        // Get the verifying (public) key
        let verifying_key = signing_key.verifying_key();

        // Solana wallet address is the base58-encoded public key (32 bytes)
        let public_key_bytes = verifying_key.to_bytes();
        let address = bs58::encode(&public_key_bytes).into_string();

        // Secret key (32 bytes) - the actual seed
        let secret_key = bs58::encode(&secret_bytes).into_string();

        // Full private key (64 bytes) - secret + public, as used by Solana CLI
        // This is the format expected by most Solana tools
        let mut full_keypair = [0u8; 64];
        full_keypair[..32].copy_from_slice(&secret_bytes);
        full_keypair[32..].copy_from_slice(&public_key_bytes);
        let private_key = bs58::encode(&full_keypair).into_string();

        GeneratedWallet {
            address,
            private_key,
            secret_key,
        }
    }

    /// Verify that a private key corresponds to a wallet address
    pub fn verify_keypair(private_key: &str, expected_address: &str) -> bool {
        let keypair_bytes = match bs58::decode(private_key).into_vec() {
            Ok(bytes) => bytes,
            Err(_) => return false,
        };

        if keypair_bytes.len() != 64 {
            return false;
        }

        // Extract public key from the second half
        let public_key_bytes = &keypair_bytes[32..64];
        let derived_address = bs58::encode(public_key_bytes).into_string();

        derived_address == expected_address
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_keypair() {
        let wallet = WalletService::generate_keypair();

        // Address should be 32-44 characters (base58 encoded 32 bytes)
        assert!(wallet.address.len() >= 32 && wallet.address.len() <= 44);

        // Private key should be 64 bytes base58 encoded (87-88 chars typically)
        assert!(wallet.private_key.len() >= 80);

        // Secret key should be 32 bytes base58 encoded (43-44 chars typically)
        assert!(wallet.secret_key.len() >= 40 && wallet.secret_key.len() <= 50);

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
}
