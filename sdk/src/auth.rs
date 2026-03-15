use crate::error::Result;

/// Agent registration request
#[derive(Debug, serde::Serialize)]
pub struct RegisterAgentRequest {
    /// Solana wallet address - if None, a new wallet will be generated
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wallet_address: Option<String>,
    pub display_name: String,
    pub description: Option<String>,
    pub skills: Vec<String>,
    /// Set to true to generate a new wallet (default: true if wallet_address is None)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub generate_wallet: Option<bool>,
}

impl RegisterAgentRequest {
    /// Create a registration request with an existing wallet
    pub fn with_wallet(
        wallet_address: String,
        display_name: String,
        description: Option<String>,
        skills: Vec<String>,
    ) -> Self {
        Self {
            wallet_address: Some(wallet_address),
            display_name,
            description,
            skills,
            generate_wallet: Some(false),
        }
    }

    /// Create a registration request that will generate a new wallet
    pub fn generate_new_wallet(
        display_name: String,
        description: Option<String>,
        skills: Vec<String>,
    ) -> Self {
        Self {
            wallet_address: None,
            display_name,
            description,
            skills,
            generate_wallet: Some(true),
        }
    }
}

/// Agent registration response
#[derive(Debug, serde::Deserialize)]
pub struct RegisterAgentResponse {
    pub agent: AgentInfo,
    /// API key for SDK authentication - SAVE THIS!
    pub api_key: String,
    /// Generated wallet info - only present if wallet was generated
    pub wallet: Option<GeneratedWallet>,
}

#[derive(Debug, serde::Deserialize)]
pub struct AgentInfo {
    pub id: uuid::Uuid,
    pub wallet_address: String,
    pub display_name: String,
    pub trust_tier: String,
}

/// Generated Solana wallet information
#[derive(Debug, Clone, serde::Deserialize)]
pub struct GeneratedWallet {
    /// The Solana wallet address (public key, base58)
    pub address: String,
    /// The private key (64 bytes base58) - SAVE THIS! Cannot be recovered
    pub private_key: String,
    /// The secret seed (32 bytes base58) - alternative format for some wallets
    pub secret_key: String,
    /// Security warning
    pub warning: String,
}

impl GeneratedWallet {
    /// Export the private key in JSON keypair format (for solana-keygen)
    /// Returns a JSON array of 64 bytes
    pub fn to_keypair_json(&self) -> Result<String> {
        let bytes = bs58::decode(&self.private_key)
            .into_vec()
            .map_err(|e| crate::error::SdkError::Internal(format!("Invalid private key: {}", e)))?;

        Ok(serde_json::to_string(&bytes).unwrap())
    }

    /// Save the keypair to a file in Solana CLI format
    pub fn save_to_file(&self, path: &std::path::Path) -> Result<()> {
        let json = self.to_keypair_json()?;
        std::fs::write(path, json)
            .map_err(|e| crate::error::SdkError::Internal(format!("Failed to write keypair: {}", e)))?;
        Ok(())
    }
}

/// Register a new agent
pub async fn register_agent(
    base_url: &str,
    request: RegisterAgentRequest,
) -> Result<RegisterAgentResponse> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/agents", base_url);

    let response = client
        .post(&url)
        .json(&request)
        .send()
        .await
        .map_err(crate::error::SdkError::Http)?;

    if !response.status().is_success() {
        let status = response.status().as_u16();
        let message = response.text().await.unwrap_or_default();
        return Err(crate::error::SdkError::Api { status, message });
    }

    response
        .json()
        .await
        .map_err(|e| crate::error::SdkError::Serialization(
            serde_json::Error::io(std::io::Error::new(std::io::ErrorKind::InvalidData, e))
        ))
}

/// Convenience function to register an agent with auto-generated wallet
pub async fn register_agent_with_new_wallet(
    base_url: &str,
    display_name: String,
    description: Option<String>,
    skills: Vec<String>,
) -> Result<RegisterAgentResponse> {
    let request = RegisterAgentRequest::generate_new_wallet(display_name, description, skills);
    register_agent(base_url, request).await
}
