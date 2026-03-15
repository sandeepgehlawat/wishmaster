use axum::{
    body::Body,
    http::{Request, Response, StatusCode},
    response::IntoResponse,
    Json,
};
use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

/// Simple in-memory rate limiter using token bucket algorithm
#[derive(Clone)]
pub struct RateLimiter {
    /// Map of IP addresses to their token buckets
    buckets: Arc<RwLock<HashMap<IpAddr, TokenBucket>>>,
    /// Maximum requests per minute
    max_requests: u32,
    /// Burst allowance
    burst: u32,
}

struct TokenBucket {
    tokens: f64,
    last_update: Instant,
}

impl RateLimiter {
    pub fn new(max_requests_per_minute: u32, burst: u32) -> Self {
        Self {
            buckets: Arc::new(RwLock::new(HashMap::new())),
            max_requests: max_requests_per_minute,
            burst,
        }
    }

    /// Check if request is allowed and consume a token
    pub async fn check(&self, ip: IpAddr) -> bool {
        let mut buckets = self.buckets.write().await;
        let now = Instant::now();

        let bucket = buckets.entry(ip).or_insert_with(|| TokenBucket {
            tokens: self.burst as f64,
            last_update: now,
        });

        // Refill tokens based on time elapsed
        let elapsed = now.duration_since(bucket.last_update);
        let refill_rate = self.max_requests as f64 / 60.0; // tokens per second
        let new_tokens = elapsed.as_secs_f64() * refill_rate;
        bucket.tokens = (bucket.tokens + new_tokens).min(self.burst as f64);
        bucket.last_update = now;

        // Check if we have tokens available
        if bucket.tokens >= 1.0 {
            bucket.tokens -= 1.0;
            true
        } else {
            false
        }
    }

    /// Clean up old entries (call periodically)
    pub async fn cleanup(&self) {
        let mut buckets = self.buckets.write().await;
        let now = Instant::now();
        let max_age = Duration::from_secs(300); // 5 minutes

        buckets.retain(|_, bucket| {
            now.duration_since(bucket.last_update) < max_age
        });
    }
}

/// Rate limit response
pub fn rate_limit_response() -> Response<Body> {
    let body = Json(serde_json::json!({
        "error": {
            "type": "rate_limited",
            "message": "Too many requests. Please try again later."
        }
    }));

    (StatusCode::TOO_MANY_REQUESTS, body).into_response()
}

/// Extract client IP from request
pub fn extract_client_ip<B>(req: &Request<B>) -> Option<IpAddr> {
    // Check X-Forwarded-For header first (for reverse proxies)
    if let Some(forwarded) = req.headers().get("x-forwarded-for") {
        if let Ok(value) = forwarded.to_str() {
            if let Some(first_ip) = value.split(',').next() {
                if let Ok(ip) = first_ip.trim().parse() {
                    return Some(ip);
                }
            }
        }
    }

    // Check X-Real-IP header
    if let Some(real_ip) = req.headers().get("x-real-ip") {
        if let Ok(value) = real_ip.to_str() {
            if let Ok(ip) = value.parse() {
                return Some(ip);
            }
        }
    }

    // Fallback to connection info (not available in this context)
    // In production, you'd get this from the connection
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::Ipv4Addr;

    #[tokio::test]
    async fn test_rate_limiter_allows_burst() {
        let limiter = RateLimiter::new(60, 10);
        let ip = IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1));

        // Should allow burst of 10 requests
        for _ in 0..10 {
            assert!(limiter.check(ip).await);
        }

        // 11th request should be rate limited
        assert!(!limiter.check(ip).await);
    }

    #[tokio::test]
    async fn test_rate_limiter_refills() {
        let limiter = RateLimiter::new(60, 1);
        let ip = IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1));

        // Use up the token
        assert!(limiter.check(ip).await);
        assert!(!limiter.check(ip).await);

        // Wait for refill (1 token per second at 60 rpm)
        tokio::time::sleep(Duration::from_millis(1100)).await;

        // Should have refilled
        assert!(limiter.check(ip).await);
    }
}
