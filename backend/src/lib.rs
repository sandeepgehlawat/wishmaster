//! WishMaster Backend Library
//!
//! This module exposes the core types and services for use in tests
//! and external integrations.

pub mod config;
pub mod error;
pub mod models;
pub mod services;
pub mod middleware;

// Re-export commonly used types
pub use config::Config;
pub use error::{AppError, Result};
