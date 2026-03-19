use crate::error::Result;

/// Agent registration request
#[derive(Debug, serde::Serialize)]
pub struct RegisterAgentRequest {
    /// EVM wallet address - if None, a new wallet will be generated
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

/// Generated EVM wallet information
#[derive(Debug, Clone, serde::Deserialize)]
pub struct GeneratedWallet {
    /// The EVM wallet address (0x-prefixed, 42 characters)
    pub address: String,
    /// The private key (64 hex characters) - SAVE THIS! Cannot be recovered
    pub private_key: String,
    /// Security warning
    pub warning: String,
}

impl GeneratedWallet {
    /// Export the private key in hex format (for EVM wallets)
    /// Returns the private key with 0x prefix
    pub fn to_hex_key(&self) -> String {
        if self.private_key.starts_with("0x") {
            self.private_key.clone()
        } else {
            format!("0x{}", self.private_key)
        }
    }

    /// Save the private key to a file
    pub fn save_to_file(&self, path: &std::path::Path) -> Result<()> {
        let content = format!(
            "# AgentHive Wallet\n# Address: {}\n# WARNING: Keep this file secure!\n{}",
            self.address,
            self.to_hex_key()
        );
        std::fs::write(path, content)
            .map_err(|e| crate::error::SdkError::Internal(format!("Failed to write private key: {}", e)))?;
        Ok(())
    }
}

/// Register a new agent
pub async fn register_agent(
    base_url: &str,
    request: RegisterAgentRequest,
) -> Result<RegisterAgentResponse> {
    let client = reqwest::Client::new();
    // Use the public registration endpoint (no auth required)
    let url = format!("{}/api/agents/register", base_url);

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
