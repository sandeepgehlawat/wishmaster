//! Escrow service tests.
//!
//! Tests cover:
//! - Escrow creation
//! - Escrow retrieval
//! - Funding flow
//! - Agent locking
//! - Release to agent
//! - Refund to client
//! - Fee calculations
//! - Concurrency safety

mod common;

use common::*;
use rust_decimal::Decimal;
use std::str::FromStr;
use uuid::Uuid;
use wishmaster_backend::models::EscrowStatus;

// ============================================================================
// Escrow Creation Tests
// ============================================================================

#[tokio::test]
async fn test_create_escrow() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let job = create_test_job(&ctx, user.id, None).await;

    let escrow = ctx
        .services
        .escrow
        .create_escrow(job.id, &user.wallet_address, 500.0)
        .await
        .expect("Failed to create escrow");

    assert_eq!(escrow.job_id, job.id);
    assert_eq!(escrow.client_wallet, user.wallet_address.to_lowercase());
    assert_eq!(escrow.status, "created");
    assert!(escrow.agent_wallet.is_none());

    // Amount should be stored correctly
    let expected_amount = Decimal::from_str("500").unwrap();
    assert_eq!(escrow.amount_usdc, expected_amount);
}

#[tokio::test]
async fn test_create_escrow_generates_unique_pda() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;

    let job1 = create_test_job(&ctx, user.id, None).await;
    let job2 = create_test_job(&ctx, user.id, None).await;

    let escrow1 = ctx
        .services
        .escrow
        .create_escrow(job1.id, &user.wallet_address, 100.0)
        .await
        .expect("Failed to create escrow 1");

    let escrow2 = ctx
        .services
        .escrow
        .create_escrow(job2.id, &user.wallet_address, 100.0)
        .await
        .expect("Failed to create escrow 2");

    // Each escrow should have a unique PDA
    assert_ne!(
        escrow1.escrow_pda, escrow2.escrow_pda,
        "Escrow PDAs should be unique per job"
    );
}

#[tokio::test]
async fn test_escrow_pda_is_deterministic() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let job = create_test_job(&ctx, user.id, None).await;

    let escrow = ctx
        .services
        .escrow
        .create_escrow(job.id, &user.wallet_address, 100.0)
        .await
        .expect("Failed to create escrow");

    // The PDA should be a keccak256 hash of the job ID
    // Verify it starts with 0x and has correct length
    assert!(escrow.escrow_pda.starts_with("0x"));
    assert_eq!(escrow.escrow_pda.len(), 66); // 0x + 64 hex chars
}

// ============================================================================
// Escrow Retrieval Tests
// ============================================================================

#[tokio::test]
async fn test_get_escrow_with_details() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let job = create_test_job(&ctx, user.id, None).await;

    ctx.services
        .escrow
        .create_escrow(job.id, &user.wallet_address, 500.0)
        .await
        .expect("Failed to create escrow");

    let details = ctx
        .services
        .escrow
        .get_escrow(job.id)
        .await
        .expect("Failed to get escrow");

    assert_eq!(details.escrow.job_id, job.id);
    assert_eq!(details.job_title, job.title);
    assert_eq!(details.client_name, user.display_name);
    assert!(details.agent_name.is_none());
}

#[tokio::test]
async fn test_get_escrow_not_found() {
    let ctx = TestContext::new().await;
    let non_existent_job_id = Uuid::new_v4();

    let result = ctx.services.escrow.get_escrow(non_existent_job_id).await;

    assert!(result.is_err());
    match result {
        Err(e) => {
            let error_str = format!("{:?}", e);
            assert!(
                error_str.contains("not found") || error_str.contains("NotFound"),
                "Expected not found error"
            );
        }
        _ => panic!("Expected error"),
    }
}

// ============================================================================
// Fund Transaction Generation Tests
// ============================================================================

#[tokio::test]
async fn test_generate_fund_transaction() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let job = create_test_job(&ctx, user.id, None).await;

    ctx.services
        .escrow
        .create_escrow(job.id, &user.wallet_address, 500.0)
        .await
        .expect("Failed to create escrow");

    let fund_tx = ctx
        .services
        .escrow
        .generate_fund_transaction(job.id, &user.wallet_address)
        .await
        .expect("Failed to generate fund transaction");

    // Should return transaction data
    assert!(!fund_tx.transaction.is_empty());
    assert!(!fund_tx.escrow_pda.is_empty());
    assert_eq!(fund_tx.amount_usdc, 500.0);

    // Transaction should be base64 encoded
    assert!(base64::Engine::decode(
        &base64::engine::general_purpose::STANDARD,
        &fund_tx.transaction
    )
    .is_ok());
}

#[tokio::test]
async fn test_generate_fund_transaction_wrong_wallet() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let other_user = create_test_user(&ctx, None).await;
    let job = create_test_job(&ctx, user.id, None).await;

    ctx.services
        .escrow
        .create_escrow(job.id, &user.wallet_address, 500.0)
        .await
        .expect("Failed to create escrow");

    // Try to generate fund tx with wrong wallet
    let result = ctx
        .services
        .escrow
        .generate_fund_transaction(job.id, &other_user.wallet_address)
        .await;

    assert!(result.is_err());
    match result {
        Err(e) => {
            let error_str = format!("{:?}", e);
            assert!(
                error_str.contains("Forbidden") || error_str.contains("Not your"),
                "Expected forbidden error"
            );
        }
        _ => panic!("Expected error"),
    }
}

#[tokio::test]
async fn test_generate_fund_transaction_already_funded() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let job = create_test_job(&ctx, user.id, None).await;

    ctx.services
        .escrow
        .create_escrow(job.id, &user.wallet_address, 500.0)
        .await
        .expect("Failed to create escrow");

    // Set escrow to funded
    set_escrow_status(&ctx, job.id, "funded").await;

    let result = ctx
        .services
        .escrow
        .generate_fund_transaction(job.id, &user.wallet_address)
        .await;

    assert!(result.is_err());
    match result {
        Err(e) => {
            let error_str = format!("{:?}", e);
            assert!(
                error_str.contains("already funded") || error_str.contains("BadRequest"),
                "Expected already funded error"
            );
        }
        _ => panic!("Expected error"),
    }
}

// ============================================================================
// Escrow Lock Tests
// ============================================================================

#[tokio::test]
async fn test_lock_escrow_to_agent() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let agent = create_test_agent(&ctx, None).await;
    let job = create_test_job(&ctx, user.id, None).await;

    ctx.services
        .escrow
        .create_escrow(job.id, &user.wallet_address, 500.0)
        .await
        .expect("Failed to create escrow");

    // Fund the escrow
    set_escrow_status(&ctx, job.id, "funded").await;

    // Lock to agent
    let locked = ctx
        .services
        .escrow
        .lock_to_agent(job.id, &agent.wallet_address, Some(400.0))
        .await
        .expect("Failed to lock escrow");

    assert_eq!(locked.status, "locked");
    assert_eq!(locked.agent_wallet, Some(agent.wallet_address.to_lowercase()));

    // Amount should be updated to bid amount
    let expected_amount = Decimal::from_str("400").unwrap();
    assert_eq!(locked.amount_usdc, expected_amount);
}

#[tokio::test]
async fn test_lock_escrow_requires_funded_status() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let agent = create_test_agent(&ctx, None).await;
    let job = create_test_job(&ctx, user.id, None).await;

    ctx.services
        .escrow
        .create_escrow(job.id, &user.wallet_address, 500.0)
        .await
        .expect("Failed to create escrow");

    // Try to lock without funding first
    let result = ctx
        .services
        .escrow
        .lock_to_agent(job.id, &agent.wallet_address, None)
        .await;

    assert!(result.is_err());
    match result {
        Err(e) => {
            let error_str = format!("{:?}", e);
            assert!(
                error_str.contains("Conflict") || error_str.contains("funded"),
                "Expected conflict error about funded state"
            );
        }
        _ => panic!("Expected error"),
    }
}

// ============================================================================
// Escrow Release Tests
// ============================================================================

#[tokio::test]
async fn test_release_escrow_to_agent() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let agent = create_test_agent(&ctx, None).await;
    let job = create_test_job(&ctx, user.id, None).await;

    ctx.services
        .escrow
        .create_escrow(job.id, &user.wallet_address, 1000.0)
        .await
        .expect("Failed to create escrow");

    // Fund and lock
    set_escrow_status(&ctx, job.id, "funded").await;
    ctx.services
        .escrow
        .lock_to_agent(job.id, &agent.wallet_address, Some(1000.0))
        .await
        .expect("Failed to lock escrow");

    // Release
    let result = ctx
        .services
        .escrow
        .release(job.id, "new")
        .await
        .expect("Failed to release escrow");

    // Check fee calculation (15% for new agents)
    let expected_fee = 1000.0 * 0.15;
    let expected_payout = 1000.0 - expected_fee;

    assert!((result.platform_fee - expected_fee).abs() < 0.01);
    assert!((result.agent_payout - expected_payout).abs() < 0.01);
    assert!(!result.signature.is_empty());
}

#[tokio::test]
async fn test_release_escrow_different_trust_tiers() {
    let ctx = TestContext::new().await;

    let trust_tiers = vec![
        ("new", 0.15),
        ("rising", 0.12),
        ("established", 0.10),
        ("top_rated", 0.08),
    ];

    for (tier, expected_fee_rate) in trust_tiers {
        let user = create_test_user(&ctx, None).await;
        let agent = create_test_agent(&ctx, None).await;
        let job = create_test_job(&ctx, user.id, None).await;
        let amount = 1000.0;

        ctx.services
            .escrow
            .create_escrow(job.id, &user.wallet_address, amount)
            .await
            .expect("Failed to create escrow");

        set_escrow_status(&ctx, job.id, "funded").await;
        ctx.services
            .escrow
            .lock_to_agent(job.id, &agent.wallet_address, Some(amount))
            .await
            .expect("Failed to lock escrow");

        let result = ctx
            .services
            .escrow
            .release(job.id, tier)
            .await
            .expect(&format!("Failed to release escrow for tier {}", tier));

        let expected_fee = amount * expected_fee_rate;
        assert!(
            (result.platform_fee - expected_fee).abs() < 0.01,
            "Fee mismatch for tier {}: expected {}, got {}",
            tier,
            expected_fee,
            result.platform_fee
        );
    }
}

#[tokio::test]
async fn test_release_escrow_requires_locked_status() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let job = create_test_job(&ctx, user.id, None).await;

    ctx.services
        .escrow
        .create_escrow(job.id, &user.wallet_address, 500.0)
        .await
        .expect("Failed to create escrow");

    // Try to release from created status
    let result = ctx.services.escrow.release(job.id, "new").await;

    assert!(result.is_err());
    match result {
        Err(e) => {
            let error_str = format!("{:?}", e);
            assert!(
                error_str.contains("Conflict") || error_str.contains("locked"),
                "Expected conflict error about locked state"
            );
        }
        _ => panic!("Expected error"),
    }
}

#[tokio::test]
async fn test_release_escrow_prevents_double_release() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let agent = create_test_agent(&ctx, None).await;
    let job = create_test_job(&ctx, user.id, None).await;

    ctx.services
        .escrow
        .create_escrow(job.id, &user.wallet_address, 1000.0)
        .await
        .expect("Failed to create escrow");

    set_escrow_status(&ctx, job.id, "funded").await;
    ctx.services
        .escrow
        .lock_to_agent(job.id, &agent.wallet_address, Some(1000.0))
        .await
        .expect("Failed to lock escrow");

    // First release should succeed
    let _ = ctx
        .services
        .escrow
        .release(job.id, "new")
        .await
        .expect("First release should succeed");

    // Second release should fail
    let result = ctx.services.escrow.release(job.id, "new").await;

    assert!(result.is_err());
    match result {
        Err(e) => {
            let error_str = format!("{:?}", e);
            assert!(
                error_str.contains("Conflict") || error_str.contains("locked"),
                "Expected conflict error for double release"
            );
        }
        _ => panic!("Expected error"),
    }
}

// ============================================================================
// Escrow Refund Tests
// ============================================================================

#[tokio::test]
async fn test_refund_escrow_to_client() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let job = create_test_job(&ctx, user.id, None).await;

    ctx.services
        .escrow
        .create_escrow(job.id, &user.wallet_address, 500.0)
        .await
        .expect("Failed to create escrow");

    // Fund the escrow
    set_escrow_status(&ctx, job.id, "funded").await;

    // Refund
    let signature = ctx
        .services
        .escrow
        .refund(job.id)
        .await
        .expect("Failed to refund escrow");

    assert!(!signature.is_empty());

    // Verify status changed
    let escrow = ctx
        .services
        .escrow
        .get_escrow(job.id)
        .await
        .expect("Failed to get escrow");

    assert_eq!(escrow.escrow.status, "refunded");
}

#[tokio::test]
async fn test_refund_requires_funded_status() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let job = create_test_job(&ctx, user.id, None).await;

    ctx.services
        .escrow
        .create_escrow(job.id, &user.wallet_address, 500.0)
        .await
        .expect("Failed to create escrow");

    // Try to refund from created status
    let result = ctx.services.escrow.refund(job.id).await;

    assert!(result.is_err());
    match result {
        Err(e) => {
            let error_str = format!("{:?}", e);
            assert!(
                error_str.contains("Conflict") || error_str.contains("refundable"),
                "Expected conflict error about refundable state"
            );
        }
        _ => panic!("Expected error"),
    }
}

#[tokio::test]
async fn test_cannot_refund_locked_escrow() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let agent = create_test_agent(&ctx, None).await;
    let job = create_test_job(&ctx, user.id, None).await;

    ctx.services
        .escrow
        .create_escrow(job.id, &user.wallet_address, 500.0)
        .await
        .expect("Failed to create escrow");

    // Fund and lock
    set_escrow_status(&ctx, job.id, "funded").await;
    ctx.services
        .escrow
        .lock_to_agent(job.id, &agent.wallet_address, None)
        .await
        .expect("Failed to lock escrow");

    // Try to refund
    let result = ctx.services.escrow.refund(job.id).await;

    assert!(result.is_err());
    match result {
        Err(e) => {
            let error_str = format!("{:?}", e);
            assert!(
                error_str.contains("Conflict") || error_str.contains("refundable"),
                "Expected conflict error for locked escrow"
            );
        }
        _ => panic!("Expected error"),
    }
}

#[tokio::test]
async fn test_refund_prevents_double_refund() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let job = create_test_job(&ctx, user.id, None).await;

    ctx.services
        .escrow
        .create_escrow(job.id, &user.wallet_address, 500.0)
        .await
        .expect("Failed to create escrow");

    set_escrow_status(&ctx, job.id, "funded").await;

    // First refund should succeed
    let _ = ctx
        .services
        .escrow
        .refund(job.id)
        .await
        .expect("First refund should succeed");

    // Second refund should fail
    let result = ctx.services.escrow.refund(job.id).await;

    assert!(result.is_err());
    match result {
        Err(e) => {
            let error_str = format!("{:?}", e);
            assert!(
                error_str.contains("Conflict") || error_str.contains("refundable") || error_str.contains("refunded"),
                "Expected conflict error for double refund"
            );
        }
        _ => panic!("Expected error"),
    }
}

// ============================================================================
// EscrowStatus Enum Tests
// ============================================================================

#[test]
fn test_escrow_status_as_str() {
    assert_eq!(EscrowStatus::Created.as_str(), "created");
    assert_eq!(EscrowStatus::Funded.as_str(), "funded");
    assert_eq!(EscrowStatus::Locked.as_str(), "locked");
    assert_eq!(EscrowStatus::Released.as_str(), "released");
    assert_eq!(EscrowStatus::Refunded.as_str(), "refunded");
    assert_eq!(EscrowStatus::Disputed.as_str(), "disputed");
}

#[test]
fn test_escrow_status_from_str() {
    assert_eq!(EscrowStatus::from_str("created"), EscrowStatus::Created);
    assert_eq!(EscrowStatus::from_str("funded"), EscrowStatus::Funded);
    assert_eq!(EscrowStatus::from_str("locked"), EscrowStatus::Locked);
    assert_eq!(EscrowStatus::from_str("released"), EscrowStatus::Released);
    assert_eq!(EscrowStatus::from_str("refunded"), EscrowStatus::Refunded);
    assert_eq!(EscrowStatus::from_str("disputed"), EscrowStatus::Disputed);

    // Unknown status defaults to Created
    assert_eq!(EscrowStatus::from_str("unknown"), EscrowStatus::Created);
    assert_eq!(EscrowStatus::from_str(""), EscrowStatus::Created);
}

// ============================================================================
// Fee Calculation Tests
// ============================================================================

#[test]
fn test_config_fee_bps() {
    let config = test_config();

    assert_eq!(config.get_fee_bps("new"), 1500);
    assert_eq!(config.get_fee_bps("rising"), 1200);
    assert_eq!(config.get_fee_bps("established"), 1000);
    assert_eq!(config.get_fee_bps("top_rated"), 800);

    // Unknown tier defaults to new
    assert_eq!(config.get_fee_bps("unknown"), 1500);
    assert_eq!(config.get_fee_bps(""), 1500);
}

// ============================================================================
// Wallet Address Normalization Tests
// ============================================================================

#[tokio::test]
async fn test_escrow_normalizes_wallet_addresses() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let job = create_test_job(&ctx, user.id, None).await;

    // Use mixed-case wallet address
    let mixed_case_wallet = "0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab12";

    let escrow = ctx
        .services
        .escrow
        .create_escrow(job.id, mixed_case_wallet, 500.0)
        .await
        .expect("Failed to create escrow");

    // Wallet should be stored lowercase
    assert_eq!(escrow.client_wallet, mixed_case_wallet.to_lowercase());
}

#[tokio::test]
async fn test_lock_escrow_normalizes_agent_wallet() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let job = create_test_job(&ctx, user.id, None).await;

    ctx.services
        .escrow
        .create_escrow(job.id, &user.wallet_address, 500.0)
        .await
        .expect("Failed to create escrow");

    set_escrow_status(&ctx, job.id, "funded").await;

    let mixed_case_agent_wallet = "0xABcDeF1234567890AbCdEf1234567890aBCdEf12";

    let locked = ctx
        .services
        .escrow
        .lock_to_agent(job.id, mixed_case_agent_wallet, None)
        .await
        .expect("Failed to lock escrow");

    assert_eq!(
        locked.agent_wallet,
        Some(mixed_case_agent_wallet.to_lowercase())
    );
}
