use axum::{
    extract::{Extension, Request, State},
    http::{StatusCode, HeaderMap, HeaderValue},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
    body::Body,
};
use crate::models::x402::*;
use crate::services::Services;
use std::sync::Arc;

/// Middleware to handle x402 payment verification
///
/// This middleware intercepts requests to paid endpoints and:
/// 1. If no payment proof is present, returns 402 Payment Required with payment details
/// 2. If payment proof is present, verifies it and allows the request to proceed
///
/// Compatible with axum's from_fn_with_state pattern
pub async fn x402_payment_middleware(
    State(services): State<Arc<Services>>,
    request: Request<Body>,
    next: Next,
) -> Response {
    // Check if this endpoint requires payment
    let requires_payment = request.uri().path().starts_with("/api/agent/paid/");

    if !requires_payment {
        return next.run(request).await;
    }

    // Extract headers from request
    let headers = request.headers().clone();

    // Check for payment proof in headers
    let payment_proof = headers.get("X-Payment-Proof");
    let payment_nonce = headers.get("X-Payment-Nonce");

    match (payment_proof, payment_nonce) {
        (Some(proof), Some(nonce)) => {
            // Verify payment
            let proof = X402PaymentProof {
                tx_hash: proof.to_str().unwrap_or("").to_string(),
                nonce: nonce.to_str().unwrap_or("").to_string(),
                payer: headers
                    .get("X-Payment-Payer")
                    .map(|h| h.to_str().unwrap_or("").to_string())
                    .unwrap_or_default(),
            };

            match services.x402.verify_payment(&proof).await {
                Ok(result) if result.valid => {
                    // Payment verified, continue to handler
                    next.run(request).await
                }
                Ok(result) => {
                    // Payment invalid
                    let error_response = X402ErrorResponse {
                        error: "payment_invalid".to_string(),
                        message: result.error.unwrap_or("Payment verification failed".to_string()),
                        payment: None,
                    };
                    (StatusCode::PAYMENT_REQUIRED, Json(error_response)).into_response()
                }
                Err(e) => {
                    let error_response = X402ErrorResponse {
                        error: "verification_error".to_string(),
                        message: e.to_string(),
                        payment: None,
                    };
                    (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response)).into_response()
                }
            }
        }
        _ => {
            // No payment proof - return 402 with payment requirements
            let amount = get_required_amount(request.uri().path());
            let payment_request = services.x402.create_payment_request(
                amount,
                services.x402.platform_wallet(),
                Some(format!("Payment for {}", request.uri().path())),
            ).await;

            match payment_request {
                Ok(req) => {
                    let error_response = X402ErrorResponse {
                        error: "payment_required".to_string(),
                        message: format!("Payment of {} USDC required", amount),
                        payment: Some(req.clone()),
                    };

                    let mut response = (StatusCode::PAYMENT_REQUIRED, Json(error_response)).into_response();

                    // Add x402 headers
                    let headers = response.headers_mut();
                    if let Ok(v) = HeaderValue::from_str(&req.network) {
                        headers.insert("X-Payment-Network", v);
                    }
                    if let Ok(v) = HeaderValue::from_str(&req.token) {
                        headers.insert("X-Payment-Token", v);
                    }
                    if let Ok(v) = HeaderValue::from_str(&req.amount.to_string()) {
                        headers.insert("X-Payment-Amount", v);
                    }
                    if let Ok(v) = HeaderValue::from_str(&req.recipient) {
                        headers.insert("X-Payment-Recipient", v);
                    }
                    if let Ok(v) = HeaderValue::from_str(&req.nonce) {
                        headers.insert("X-Payment-Nonce", v);
                    }
                    if let Ok(v) = HeaderValue::from_str(&req.expires.to_string()) {
                        headers.insert("X-Payment-Expires", v);
                    }

                    response
                }
                Err(e) => {
                    let error_response = X402ErrorResponse {
                        error: "payment_setup_error".to_string(),
                        message: e.to_string(),
                        payment: None,
                    };
                    (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response)).into_response()
                }
            }
        }
    }
}

/// Get required payment amount based on endpoint (configure per endpoint)
fn get_required_amount(path: &str) -> f64 {
    // Default pricing - can be made configurable via database or config
    if path.contains("/compute") {
        10.0  // $10 for compute-intensive tasks
    } else if path.contains("/data") {
        5.0   // $5 for data tasks
    } else if path.contains("/analysis") {
        7.5   // $7.50 for analysis tasks
    } else {
        1.0   // $1 default
    }
}

/// Helper to extract payment info from request headers
pub fn extract_payment_info(headers: &HeaderMap) -> Option<X402PaymentProof> {
    let tx_hash = headers.get("X-Payment-Proof")?.to_str().ok()?;
    let nonce = headers.get("X-Payment-Nonce")?.to_str().ok()?;
    let payer = headers.get("X-Payment-Payer")
        .and_then(|h| h.to_str().ok())
        .unwrap_or("");

    Some(X402PaymentProof {
        tx_hash: tx_hash.to_string(),
        nonce: nonce.to_string(),
        payer: payer.to_string(),
    })
}
