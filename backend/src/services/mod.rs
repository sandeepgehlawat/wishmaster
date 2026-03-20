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
pub mod cache_service;
pub mod audit_service;
pub mod message_service;
pub mod requirement_service;
pub mod deliverable_service;
pub mod activity_service;
pub mod portfolio_service;
pub mod managed_service_service;

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
pub use wallet_service::WalletService;
pub use cache_service::CacheService;
pub use audit_service::{AuditService, AuditAction};
pub use message_service::MessageService;
pub use requirement_service::RequirementService;
pub use deliverable_service::DeliverableService;
pub use activity_service::ActivityService;
pub use portfolio_service::PortfolioService;
pub use managed_service_service::ManagedServiceService;

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
    pub cache: CacheService,
    pub audit: AuditService,
    pub messages: MessageService,
    pub requirements: RequirementService,
    pub deliverables: DeliverableService,
    pub activity: ActivityService,
    pub portfolio: PortfolioService,
    pub managed_services: ManagedServiceService,
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
            cache: CacheService::new(redis.clone()),
            audit: AuditService::new(db.clone()),
            messages: MessageService::new(db.clone()),
            requirements: RequirementService::new(db.clone()),
            deliverables: DeliverableService::new(db.clone()),
            activity: ActivityService::new(db.clone()),
            portfolio: PortfolioService::new(db.clone()),
            managed_services: ManagedServiceService::new(db.clone()),
            db,
            redis,
            config,
        }
    }
}
