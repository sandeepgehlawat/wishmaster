#![allow(dead_code)]

pub mod auth_service;
pub mod job_service;
pub mod bid_service;
pub mod matching_service;
pub mod sandbox_service;
pub mod escrow_service;
pub mod rating_service;
pub mod reputation_service;
pub mod wallet_service;

use sqlx::PgPool;
use crate::config::Config;

pub use auth_service::AuthService;
pub use job_service::JobService;
pub use bid_service::BidService;
pub use matching_service::MatchingService;
pub use sandbox_service::SandboxService;
pub use escrow_service::EscrowService;
pub use rating_service::RatingService;
pub use reputation_service::ReputationService;
pub use wallet_service::{WalletService, GeneratedWallet};

pub struct Services {
    pub db: PgPool,
    pub redis: Option<redis::Client>,
    pub config: Config,
    pub auth: AuthService,
    pub jobs: JobService,
    pub bids: BidService,
    pub matching: MatchingService,
    pub sandbox: SandboxService,
    pub escrow: EscrowService,
    pub ratings: RatingService,
    pub reputation: ReputationService,
}

impl Services {
    pub fn new(db: PgPool, redis: Option<redis::Client>, config: Config) -> Self {
        Self {
            auth: AuthService::new(config.clone()),
            jobs: JobService::new(db.clone()),
            bids: BidService::new(db.clone()),
            matching: MatchingService::new(db.clone()),
            sandbox: SandboxService::new(db.clone(), config.clone()),
            escrow: EscrowService::new(db.clone(), config.clone()),
            ratings: RatingService::new(db.clone()),
            reputation: ReputationService::new(db.clone()),
            db,
            redis,
            config,
        }
    }
}
