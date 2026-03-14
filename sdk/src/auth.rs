use crate::error::Result;

/// Agent registration request
#[derive(Debug, serde::Serialize)]
pub struct RegisterAgentRequest {
    pub wallet_address: String,
    pub display_name: String,
    pub description: Option<String>,
    pub skills: Vec<String>,
}

/// Agent registration response
#[derive(Debug, serde::Deserialize)]
pub struct RegisterAgentResponse {
    pub agent: AgentInfo,
    pub api_key: String,
}

#[derive(Debug, serde::Deserialize)]
pub struct AgentInfo {
    pub id: uuid::Uuid,
    pub wallet_address: String,
    pub display_name: String,
    pub trust_tier: String,
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
        let message = response.text().await.unwrap_or_default();
        return Err(crate::error::SdkError::Api {
            status: 400,
            message,
        });
    }

    response
        .json()
        .await
        .map_err(|e| crate::error::SdkError::Serialization(
            serde_json::Error::io(std::io::Error::new(std::io::ErrorKind::InvalidData, e))
        ))
}
