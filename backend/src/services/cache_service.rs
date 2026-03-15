use redis::{Commands, RedisError};
use serde::{de::DeserializeOwned, Serialize};
use std::time::Duration;

/// Redis caching layer for frequently accessed data
#[derive(Clone)]
pub struct CacheService {
    client: Option<redis::Client>,
    default_ttl: Duration,
}

impl CacheService {
    pub fn new(client: Option<redis::Client>) -> Self {
        Self {
            client,
            default_ttl: Duration::from_secs(300), // 5 minutes default
        }
    }

    /// Check if caching is available
    pub fn is_available(&self) -> bool {
        self.client.is_some()
    }

    /// Get a value from cache
    pub fn get<T: DeserializeOwned>(&self, key: &str) -> Option<T> {
        let client = self.client.as_ref()?;
        let mut conn = client.get_connection().ok()?;

        let value: Option<String> = conn.get(key).ok()?;
        value.and_then(|v| serde_json::from_str(&v).ok())
    }

    /// Set a value in cache with default TTL
    pub fn set<T: Serialize>(&self, key: &str, value: &T) -> Result<(), CacheError> {
        self.set_with_ttl(key, value, self.default_ttl)
    }

    /// Set a value in cache with custom TTL
    pub fn set_with_ttl<T: Serialize>(
        &self,
        key: &str,
        value: &T,
        ttl: Duration,
    ) -> Result<(), CacheError> {
        let client = self.client.as_ref().ok_or(CacheError::NotAvailable)?;
        let mut conn = client.get_connection()?;

        let serialized = serde_json::to_string(value)?;
        conn.set_ex::<_, _, ()>(key, serialized, ttl.as_secs() as u64)?;

        Ok(())
    }

    /// Delete a value from cache
    pub fn delete(&self, key: &str) -> Result<(), CacheError> {
        let client = self.client.as_ref().ok_or(CacheError::NotAvailable)?;
        let mut conn = client.get_connection()?;

        conn.del::<_, ()>(key)?;
        Ok(())
    }

    /// Delete all keys matching a pattern
    pub fn delete_pattern(&self, pattern: &str) -> Result<u64, CacheError> {
        let client = self.client.as_ref().ok_or(CacheError::NotAvailable)?;
        let mut conn = client.get_connection()?;

        let keys: Vec<String> = redis::cmd("KEYS").arg(pattern).query(&mut conn)?;

        if keys.is_empty() {
            return Ok(0);
        }

        let deleted: u64 = conn.del(&keys)?;
        Ok(deleted)
    }

    /// Get or set a value (cache-aside pattern)
    pub async fn get_or_set<T, F, Fut>(
        &self,
        key: &str,
        ttl: Duration,
        fetch: F,
    ) -> Result<T, CacheError>
    where
        T: Serialize + DeserializeOwned + Clone,
        F: FnOnce() -> Fut,
        Fut: std::future::Future<Output = Result<T, CacheError>>,
    {
        // Try cache first
        if let Some(cached) = self.get(key) {
            tracing::debug!("Cache hit for key: {}", key);
            return Ok(cached);
        }

        tracing::debug!("Cache miss for key: {}", key);

        // Fetch from source
        let value = fetch().await?;

        // Store in cache (ignore errors)
        let _ = self.set_with_ttl(key, &value, ttl);

        Ok(value)
    }

    // ========== Domain-specific cache keys ==========

    /// Cache key for agent profile
    pub fn agent_key(agent_id: &uuid::Uuid) -> String {
        format!("agent:{}", agent_id)
    }

    /// Cache key for agent reputation
    pub fn agent_reputation_key(agent_id: &uuid::Uuid) -> String {
        format!("agent:{}:reputation", agent_id)
    }

    /// Cache key for job details
    pub fn job_key(job_id: &uuid::Uuid) -> String {
        format!("job:{}", job_id)
    }

    /// Cache key for job bids list
    pub fn job_bids_key(job_id: &uuid::Uuid) -> String {
        format!("job:{}:bids", job_id)
    }

    /// Cache key for user profile
    pub fn user_key(user_id: &uuid::Uuid) -> String {
        format!("user:{}", user_id)
    }

    /// Cache key for user reputation
    pub fn user_reputation_key(user_id: &uuid::Uuid) -> String {
        format!("user:{}:reputation", user_id)
    }

    /// Cache key for open jobs list
    pub fn open_jobs_key() -> String {
        "jobs:open".to_string()
    }

    /// Cache key for featured agents
    pub fn featured_agents_key() -> String {
        "agents:featured".to_string()
    }

    // ========== Cache invalidation helpers ==========

    /// Invalidate all caches for an agent
    pub fn invalidate_agent(&self, agent_id: &uuid::Uuid) -> Result<(), CacheError> {
        self.delete(&Self::agent_key(agent_id))?;
        self.delete(&Self::agent_reputation_key(agent_id))?;
        let _ = self.delete(&Self::featured_agents_key());
        Ok(())
    }

    /// Invalidate all caches for a job
    pub fn invalidate_job(&self, job_id: &uuid::Uuid) -> Result<(), CacheError> {
        self.delete(&Self::job_key(job_id))?;
        self.delete(&Self::job_bids_key(job_id))?;
        let _ = self.delete(&Self::open_jobs_key());
        Ok(())
    }

    /// Invalidate all caches for a user
    pub fn invalidate_user(&self, user_id: &uuid::Uuid) -> Result<(), CacheError> {
        self.delete(&Self::user_key(user_id))?;
        self.delete(&Self::user_reputation_key(user_id))?;
        Ok(())
    }
}

#[derive(Debug)]
pub enum CacheError {
    NotAvailable,
    Redis(RedisError),
    Serialization(serde_json::Error),
}

impl std::fmt::Display for CacheError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CacheError::NotAvailable => write!(f, "Cache not available"),
            CacheError::Redis(e) => write!(f, "Redis error: {}", e),
            CacheError::Serialization(e) => write!(f, "Serialization error: {}", e),
        }
    }
}

impl std::error::Error for CacheError {}

impl From<RedisError> for CacheError {
    fn from(e: RedisError) -> Self {
        CacheError::Redis(e)
    }
}

impl From<serde_json::Error> for CacheError {
    fn from(e: serde_json::Error) -> Self {
        CacheError::Serialization(e)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cache_keys() {
        let id = uuid::Uuid::new_v4();
        assert!(CacheService::agent_key(&id).starts_with("agent:"));
        assert!(CacheService::job_key(&id).starts_with("job:"));
        assert_eq!(CacheService::open_jobs_key(), "jobs:open");
    }
}
