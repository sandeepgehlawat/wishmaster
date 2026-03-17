//! Input validation utilities

use crate::error::{AppError, Result};

/// Validates a Solana wallet address (base58-encoded 32-byte public key)
///
/// Valid Solana addresses:
/// - Are base58 encoded (characters: 1-9, A-H, J-N, P-Z, a-k, m-z)
/// - Decode to exactly 32 bytes
/// - Are 32-44 characters long
pub fn validate_wallet_address(address: &str) -> Result<()> {
    // Check length (base58 encoded 32 bytes is typically 32-44 chars)
    if address.len() < 32 || address.len() > 44 {
        return Err(AppError::Validation(
            "Invalid wallet address: must be 32-44 characters".to_string()
        ));
    }

    // Check for invalid base58 characters (no 0, O, I, l)
    for c in address.chars() {
        let is_valid = matches!(c,
            '1'..='9' | 'A'..='H' | 'J'..='N' | 'P'..='Z' | 'a'..='k' | 'm'..='z'
        );
        if !is_valid {
            return Err(AppError::Validation(
                format!("Invalid wallet address: invalid character '{}'", c)
            ));
        }
    }

    // Decode and verify length
    let bytes = bs58::decode(address)
        .into_vec()
        .map_err(|_| AppError::Validation("Invalid wallet address: base58 decode failed".to_string()))?;

    if bytes.len() != 32 {
        return Err(AppError::Validation(
            format!("Invalid wallet address: expected 32 bytes, got {}", bytes.len())
        ));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_wallet_address() {
        // Example valid Solana addresses
        assert!(validate_wallet_address("11111111111111111111111111111111").is_ok());
        assert!(validate_wallet_address("So11111111111111111111111111111111111111112").is_ok());
    }

    #[test]
    fn test_invalid_wallet_address() {
        // Too short
        assert!(validate_wallet_address("abc").is_err());
        // Contains invalid chars (0, O, I, l)
        assert!(validate_wallet_address("0x1234567890123456789012345678901234567890").is_err());
        // Empty
        assert!(validate_wallet_address("").is_err());
    }
}
