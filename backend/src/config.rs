#![allow(dead_code)]

use std::env;
use anyhow::{Result, bail};

/// Weak/default JWT secrets that should never be used in production
const WEAK_SECRETS: &[&str] = &[
    "dev_secret_change_in_production",
    "dev_secret_key_change_in_production",
    "secret",
    "dev",
    "test",
    "changeme",
    "password",
];

#[derive(Clone, Debug)]
pub struct Config {
    // Server
    pub server_addr: String,

    // Database
    pub database_url: String,
    pub db_max_connections: u32,

    // Redis
    pub redis_url: Option<String>,

    // JWT
    pub jwt_secret: String,
    pub jwt_expiry_hours: i64,

    // Solana
    pub solana_rpc_url: Option<String>,
    pub escrow_program_id: Option<String>,
    pub usdc_mint: Option<String>,
    pub platform_wallet: Option<String>,

    // Platform fees (basis points)
    pub fee_new_agent_bps: u16,
    pub fee_rising_agent_bps: u16,
    pub fee_established_agent_bps: u16,
    pub fee_top_rated_agent_bps: u16,

    // CORS
    pub cors_allowed_origins: Vec<String>,

    // Rate limiting
    pub rate_limit_requests_per_minute: u32,
    pub rate_limit_burst: u32,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        // Determine if we're in production
        let is_production = env::var("ENVIRONMENT")
            .or_else(|_| env::var("RUST_ENV"))
            .or_else(|_| env::var("NODE_ENV"))
            .map(|v| v == "production")
            .unwrap_or(false);

        // JWT secret handling with security checks
        let jwt_secret = env::var("JWT_SECRET")
            .unwrap_or_else(|_| "dev_secret_change_in_production".to_string());

        // Security: Validate JWT secret strength
        if is_production {
            if WEAK_SECRETS.contains(&jwt_secret.as_str()) {
                bail!(
                    "SECURITY ERROR: JWT_SECRET is set to a weak/default value in production!\n\
                     Generate a secure secret with: openssl rand -base64 64\n\
                     Then set JWT_SECRET environment variable."
                );
            }
            if jwt_secret.len() < 32 {
                bail!(
                    "SECURITY ERROR: JWT_SECRET must be at least 32 characters in production.\n\
                     Generate a secure secret with: openssl rand -base64 64"
                );
            }
        } else if WEAK_SECRETS.contains(&jwt_secret.as_str()) {
            tracing::warn!(
                "⚠️  WARNING: Using weak JWT secret. Set JWT_SECRET env var for production!"
            );
        }

        Ok(Self {
            // Server - Railway sets PORT, fallback to SERVER_ADDR
            server_addr: env::var("PORT")
                .map(|p| format!("0.0.0.0:{}", p))
                .or_else(|_| env::var("SERVER_ADDR"))
                .unwrap_or_else(|_| "0.0.0.0:3001".to_string()),

            // Database
            database_url: env::var("DATABASE_URL")
                .unwrap_or_else(|_| "postgres://postgres:postgres@localhost:5432/wishmaster".to_string()),
            db_max_connections: env::var("DB_MAX_CONNECTIONS")
                .unwrap_or_else(|_| "10".to_string())
                .parse()?,

            // Redis
            redis_url: env::var("REDIS_URL").ok(),

            // JWT (already validated above)
            jwt_secret,
            jwt_expiry_hours: env::var("JWT_EXPIRY_HOURS")
                .unwrap_or_else(|_| "24".to_string())
                .parse()?,

            // Solana (devnet defaults)
            solana_rpc_url: env::var("SOLANA_RPC_URL").ok(),
            escrow_program_id: env::var("ESCROW_PROGRAM_ID").ok(),
            usdc_mint: env::var("USDC_MINT").ok(),
            platform_wallet: env::var("PLATFORM_WALLET").ok(),

            // Fees (basis points: 100 = 1%)
            fee_new_agent_bps: env::var("FEE_NEW_AGENT_BPS")
                .unwrap_or_else(|_| "1500".to_string())
                .parse()?,
            fee_rising_agent_bps: env::var("FEE_RISING_AGENT_BPS")
                .unwrap_or_else(|_| "1200".to_string())
                .parse()?,
            fee_established_agent_bps: env::var("FEE_ESTABLISHED_AGENT_BPS")
                .unwrap_or_else(|_| "1000".to_string())
                .parse()?,
            fee_top_rated_agent_bps: env::var("FEE_TOP_RATED_AGENT_BPS")
                .unwrap_or_else(|_| "800".to_string())
                .parse()?,

            // CORS - comma-separated list of allowed origins
            cors_allowed_origins: env::var("CORS_ALLOWED_ORIGINS")
                .unwrap_or_else(|_| "http://localhost:3000,http://localhost:3001".to_string())
                .split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect(),

            // Rate limiting
            rate_limit_requests_per_minute: env::var("RATE_LIMIT_RPM")
                .unwrap_or_else(|_| "60".to_string())
                .parse()?,
            rate_limit_burst: env::var("RATE_LIMIT_BURST")
                .unwrap_or_else(|_| "10".to_string())
                .parse()?,
        })
    }

    pub fn get_fee_bps(&self, trust_tier: &str) -> u16 {
        match trust_tier {
            "top_rated" => self.fee_top_rated_agent_bps,
            "established" => self.fee_established_agent_bps,
            "rising" => self.fee_rising_agent_bps,
            _ => self.fee_new_agent_bps,
        }
    }

    pub fn is_devnet(&self) -> bool {
        self.solana_rpc_url
            .as_ref()
            .map(|url| url.contains("devnet"))
            .unwrap_or(true)
    }
}
