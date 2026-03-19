//! Input validation utilities

use crate::error::{AppError, Result};

/// Validates an EVM wallet address (0x-prefixed 20-byte hex address)
///
/// Valid EVM addresses:
/// - Start with "0x"
/// - Followed by exactly 40 hex characters (20 bytes)
/// - Total length of 42 characters
pub fn validate_wallet_address(address: &str) -> Result<()> {
    // Must start with 0x
    if !address.starts_with("0x") && !address.starts_with("0X") {
        return Err(AppError::Validation(
            "Invalid wallet address: must start with 0x".to_string()
        ));
    }

    // Must be exactly 42 characters (0x + 40 hex chars)
    if address.len() != 42 {
        return Err(AppError::Validation(
            format!("Invalid wallet address: must be 42 characters, got {}", address.len())
        ));
    }

    // Check that remaining 40 characters are valid hex
    let hex_part = &address[2..];
    for c in hex_part.chars() {
        if !c.is_ascii_hexdigit() {
            return Err(AppError::Validation(
                format!("Invalid wallet address: invalid hex character '{}'", c)
            ));
        }
    }

    Ok(())
}

/// Normalize an EVM address to lowercase with 0x prefix
pub fn normalize_address(address: &str) -> String {
    if address.starts_with("0x") || address.starts_with("0X") {
        format!("0x{}", address[2..].to_lowercase())
    } else {
        format!("0x{}", address.to_lowercase())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_wallet_address() {
        // Example valid EVM addresses
        assert!(validate_wallet_address("0x0000000000000000000000000000000000000000").is_ok());
        assert!(validate_wallet_address("0xdead000000000000000000000000000000000000").is_ok());
        assert!(validate_wallet_address("0xDeaDbeeF00000000000000000000000000000000").is_ok());
        assert!(validate_wallet_address("0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab12").is_ok());
    }

    #[test]
    fn test_invalid_wallet_address() {
        // Missing 0x prefix
        assert!(validate_wallet_address("742d35Cc6634C0532925a3b844Bc9e7595f0Ab12").is_err());
        // Too short
        assert!(validate_wallet_address("0x742d35Cc").is_err());
        // Too long
        assert!(validate_wallet_address("0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab12AB").is_err());
        // Contains invalid characters
        assert!(validate_wallet_address("0x742d35Cc6634C0532925a3b844Bc9e7595f0AbZZ").is_err());
        // Empty
        assert!(validate_wallet_address("").is_err());
        // Just prefix
        assert!(validate_wallet_address("0x").is_err());
    }

    #[test]
    fn test_normalize_address() {
        assert_eq!(
            normalize_address("0xDeaDbeeF00000000000000000000000000000000"),
            "0xdeadbeef00000000000000000000000000000000"
        );
        assert_eq!(
            normalize_address("0XDEADBEEF00000000000000000000000000000000"),
            "0xdeadbeef00000000000000000000000000000000"
        );
    }
}
