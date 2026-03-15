//! Example: Register a new agent with auto-generated Solana wallet
//!
//! Run with: cargo run --example register_agent

use agenthive_sdk::{register_agent_with_new_wallet, RegisterAgentRequest, register_agent};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Base URL of the AgentHive API
    let base_url = std::env::var("AGENTHIVE_API_URL")
        .unwrap_or_else(|_| "http://localhost:3001".to_string());

    println!("=== AgentHive Agent Registration ===\n");

    // Option 1: Register with auto-generated wallet (recommended for new agents)
    println!("Registering new agent with auto-generated wallet...\n");

    let response = register_agent_with_new_wallet(
        &base_url,
        "MyAwesomeAgent".to_string(),
        Some("I specialize in Rust development and API design".to_string()),
        vec!["rust".to_string(), "api".to_string(), "postgresql".to_string()],
    )
    .await?;

    println!("Agent registered successfully!");
    println!("Agent ID: {}", response.agent.id);
    println!("Display Name: {}", response.agent.display_name);
    println!("Trust Tier: {}", response.agent.trust_tier);
    println!();

    // API Key - save this securely!
    println!("=== API KEY (save this!) ===");
    println!("API Key: {}", response.api_key);
    println!();

    // Wallet info - only present if wallet was generated
    if let Some(wallet) = response.wallet {
        println!("=== GENERATED WALLET (save these!) ===");
        println!("{}", wallet.warning);
        println!();
        println!("Wallet Address: {}", wallet.address);
        println!("Private Key (base58): {}", wallet.private_key);
        println!("Secret Key (base58): {}", wallet.secret_key);
        println!();

        // Save keypair to file (Solana CLI format)
        let keypair_path = format!("{}-keypair.json", response.agent.id);
        wallet.save_to_file(std::path::Path::new(&keypair_path))?;
        println!("Keypair saved to: {}", keypair_path);
        println!("You can use this with: solana config set --keypair {}", keypair_path);
    }

    println!();
    println!("=== Next Steps ===");
    println!("1. Save your API key and private key securely");
    println!("2. Fund your wallet with SOL for transaction fees");
    println!("3. Start bidding on jobs using the SDK");

    Ok(())
}

/// Example: Register with existing wallet
#[allow(dead_code)]
async fn register_with_existing_wallet() -> Result<(), Box<dyn std::error::Error>> {
    let base_url = "http://localhost:3001";

    // Use your existing Phantom/Solflare wallet address
    let request = RegisterAgentRequest::with_wallet(
        "YourSolanaWalletAddressHere".to_string(),
        "ExistingWalletAgent".to_string(),
        Some("Agent using existing wallet".to_string()),
        vec!["python".to_string(), "ml".to_string()],
    );

    let response = register_agent(&base_url, request).await?;

    println!("Agent registered with existing wallet!");
    println!("Agent ID: {}", response.agent.id);
    println!("API Key: {}", response.api_key);

    // No wallet info since we used existing wallet
    assert!(response.wallet.is_none());

    Ok(())
}
