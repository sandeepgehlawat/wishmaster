//! x402 Payment Client
//!
//! Handles automatic x402 payment negotiation for paid API endpoints.
//! When a 402 Payment Required response is received, this client:
//! 1. Extracts payment requirements from headers/body
//! 2. Executes payment via wallet
//! 3. Retries request with payment proof

use crate::error::{Result, SdkError};
use crate::types::*;
use crate::AgentConfig;
use reqwest::{Client, StatusCode, Response};
use serde::de::DeserializeOwned;
use std::time::Duration;

/// x402 payment handler for SDK
pub struct X402Client {
    config: AgentConfig,
    http_client: Client,
    /// Optional wallet private key for automatic payments
    wallet_private_key: Option<String>,
}

impl X402Client {
    /// Create a new x402 client
    pub fn new(config: AgentConfig) -> Self {
        Self {
            config,
            http_client: Client::builder()
                .timeout(Duration::from_secs(60))
                .build()
                .expect("Failed to create HTTP client"),
            wallet_private_key: None,
        }
    }

    /// Create with wallet for automatic payments
    pub fn with_wallet(mut self, private_key: String) -> Self {
        self.wallet_private_key = Some(private_key);
        self
    }

    /// Make a request that might require x402 payment
    /// Automatically handles 402 responses by executing payment and retrying
    pub async fn request_with_payment<T: DeserializeOwned>(
        &self,
        method: &str,
        path: &str,
        body: Option<&impl serde::Serialize>,
    ) -> Result<T> {
        let url = format!("{}{}", self.config.base_url, path);

        // First attempt without payment
        let response = self.make_request(method, &url, body).await?;

        // Check for 402 Payment Required
        if response.status() == StatusCode::PAYMENT_REQUIRED {
            // Extract payment requirements
            let payment_request = self.extract_payment_request(&response).await?;

            // Execute payment
            let tx_hash = self.execute_payment(&payment_request).await?;

            // Retry with payment proof
            return self.retry_with_payment(method, &url, body, &payment_request, &tx_hash).await;
        }

        // Handle other responses
        self.handle_response(response).await
    }

    /// Make HTTP request
    async fn make_request(
        &self,
        method: &str,
        url: &str,
        body: Option<&impl serde::Serialize>,
    ) -> Result<Response> {
        let mut request = match method {
            "GET" => self.http_client.get(url),
            "POST" => self.http_client.post(url),
            "PATCH" => self.http_client.patch(url),
            "DELETE" => self.http_client.delete(url),
            _ => return Err(SdkError::Config(format!("Unsupported method: {}", method))),
        };

        request = request.header("X-API-Key", &self.config.api_key);

        if let Some(b) = body {
            request = request.json(b);
        }

        request.send().await.map_err(SdkError::Http)
    }

    /// Extract payment request from 402 response
    async fn extract_payment_request(&self, response: &Response) -> Result<X402PaymentRequest> {
        let headers = response.headers();

        // Try to extract from headers first
        let network = headers.get("X-Payment-Network")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("xlayer");
        let token = headers.get("X-Payment-Token")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("USDC");
        let amount = headers.get("X-Payment-Amount")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.parse().ok())
            .unwrap_or(0);
        let recipient = headers.get("X-Payment-Recipient")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");
        let nonce = headers.get("X-Payment-Nonce")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");
        let expires = headers.get("X-Payment-Expires")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.parse().ok())
            .unwrap_or(0);

        if nonce.is_empty() {
            return Err(SdkError::Api {
                status: 402,
                message: "Missing payment nonce in 402 response".to_string(),
            });
        }

        Ok(X402PaymentRequest {
            network: network.to_string(),
            token: token.to_string(),
            amount,
            recipient: recipient.to_string(),
            nonce: nonce.to_string(),
            expires,
            description: None,
        })
    }

    /// Execute payment
    async fn execute_payment(&self, request: &X402PaymentRequest) -> Result<String> {
        let _private_key = self.wallet_private_key.as_ref()
            .ok_or_else(|| SdkError::Config("Wallet private key required for x402 payments".to_string()))?;

        let amount_usdc = request.amount as f64 / 1_000_000.0;

        // Call backend to execute payment (backend has OKX credentials)
        let response = self.http_client
            .post(&format!("{}/api/internal/x402/execute", self.config.base_url))
            .header("X-API-Key", &self.config.api_key)
            .json(&serde_json::json!({
                "to": request.recipient,
                "amount": amount_usdc,
                "nonce": request.nonce
            }))
            .send()
            .await
            .map_err(SdkError::Http)?;

        if !response.status().is_success() {
            let status = response.status().as_u16();
            let message = response.text().await.unwrap_or_default();
            return Err(SdkError::Api { status, message });
        }

        let result: serde_json::Value = response.json().await
            .map_err(|e| SdkError::Serialization(
                serde_json::Error::io(std::io::Error::new(std::io::ErrorKind::InvalidData, e))
            ))?;

        result.get("tx_hash")
            .and_then(|h| h.as_str())
            .map(|s| s.to_string())
            .ok_or_else(|| SdkError::Internal("No tx hash in payment response".to_string()))
    }

    /// Retry request with payment proof
    async fn retry_with_payment<T: DeserializeOwned>(
        &self,
        method: &str,
        url: &str,
        body: Option<&impl serde::Serialize>,
        payment_request: &X402PaymentRequest,
        tx_hash: &str,
    ) -> Result<T> {
        let mut request = match method {
            "GET" => self.http_client.get(url),
            "POST" => self.http_client.post(url),
            "PATCH" => self.http_client.patch(url),
            "DELETE" => self.http_client.delete(url),
            _ => return Err(SdkError::Config(format!("Unsupported method: {}", method))),
        };

        request = request
            .header("X-API-Key", &self.config.api_key)
            .header("X-Payment-Proof", tx_hash)
            .header("X-Payment-Nonce", &payment_request.nonce);

        if let Some(b) = body {
            request = request.json(b);
        }

        let response = request.send().await.map_err(SdkError::Http)?;
        self.handle_response(response).await
    }

    /// Handle HTTP response
    async fn handle_response<T: DeserializeOwned>(&self, response: Response) -> Result<T> {
        let status = response.status();

        if status == StatusCode::NOT_FOUND {
            return Err(SdkError::NotFound("Resource not found".to_string()));
        }

        if status == StatusCode::UNAUTHORIZED {
            return Err(SdkError::Auth("Invalid API key".to_string()));
        }

        if status == StatusCode::PAYMENT_REQUIRED {
            return Err(SdkError::Api {
                status: 402,
                message: "Payment required but automatic payment failed".to_string(),
            });
        }

        if !status.is_success() {
            let message = response.text().await.unwrap_or_default();
            return Err(SdkError::Api {
                status: status.as_u16(),
                message,
            });
        }

        response.json().await.map_err(|e| SdkError::Serialization(
            serde_json::Error::io(std::io::Error::new(std::io::ErrorKind::InvalidData, e))
        ))
    }
}

impl std::fmt::Debug for X402Client {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("X402Client")
            .field("config", &self.config)
            .field("has_wallet", &self.wallet_private_key.is_some())
            .finish()
    }
}
