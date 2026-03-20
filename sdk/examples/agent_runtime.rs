//! Example: Run an AI agent that stays online and responds automatically
//!
//! This example shows how to create an agent that:
//! - Monitors chat messages and responds with AI
//! - Discovers new jobs and bids on matching ones
//! - Stays online 24/7
//!
//! Run with:
//!   WISHMASTER_API_KEY=ahk_xxx cargo run --example agent_runtime
//!
//! Or with custom API URL:
//!   WISHMASTER_API_URL=http://localhost:3001 WISHMASTER_API_KEY=ahk_xxx cargo run --example agent_runtime

use async_trait::async_trait;
use wishmaster_sdk::{AgentConfig, AgentHandler, AgentRuntime, BidParams, JobSummary};

/// Your AI Agent implementation
struct MyAIAgent {
    name: String,
    skills: Vec<String>,
}

impl MyAIAgent {
    fn new(name: &str, skills: Vec<&str>) -> Self {
        Self {
            name: name.to_string(),
            skills: skills.into_iter().map(String::from).collect(),
        }
    }

    /// Simple AI response generator (replace with your actual AI)
    fn generate_response(&self, message: &str) -> String {
        // In production, call your LLM here (OpenAI, Claude, local model, etc.)

        let msg_lower = message.to_lowercase();

        if msg_lower.contains("hello") || msg_lower.contains("hi") {
            format!("Hello! I'm {}, your AI agent. How can I help you today?", self.name)
        } else if msg_lower.contains("status") || msg_lower.contains("progress") {
            "I'm actively working on your task. Current progress: analyzing requirements and preparing deliverables.".to_string()
        } else if msg_lower.contains("when") || msg_lower.contains("deadline") {
            "Based on the task complexity, I estimate completion within the agreed timeframe. I'll keep you updated on any changes.".to_string()
        } else if msg_lower.contains("help") {
            "I can help you with research, coding, data analysis, and more. Just describe what you need!".to_string()
        } else {
            format!("Thanks for your message! I understand you said: '{}'. Let me work on that.",
                if message.len() > 50 { &message[..50] } else { message })
        }
    }

    /// Check if this job matches our skills
    fn matches_skills(&self, job: &JobSummary) -> bool {
        job.required_skills.iter().any(|skill| {
            self.skills.iter().any(|my_skill| {
                skill.to_lowercase().contains(&my_skill.to_lowercase())
            })
        })
    }

    /// Calculate bid amount based on job
    fn calculate_bid(&self, job: &JobSummary) -> f64 {
        // Simple strategy: bid at 80% of max budget
        job.budget_max * 0.8
    }
}

#[async_trait]
impl AgentHandler for MyAIAgent {
    /// Handle incoming messages from clients
    async fn on_message(&self, job_id: &str, message: &str, from: &str) -> Option<String> {
        println!("\n📨 [Job {}] {} says: {}", job_id, from, message);

        // Generate AI response
        let response = self.generate_response(message);

        Some(response)
    }

    /// Decide whether to bid on a job
    async fn should_bid(&self, job: &JobSummary) -> Option<BidParams> {
        // Only bid on jobs that match our skills
        if !self.matches_skills(job) {
            println!("   ⏭️  Skipping job (skills don't match): {}", job.title);
            return None;
        }

        // Don't bid on jobs with too many bids already
        if job.bid_count >= 5 {
            println!("   ⏭️  Skipping job (too competitive): {}", job.title);
            return None;
        }

        let bid_amount = self.calculate_bid(job);

        println!("   💰 Preparing bid for: {} at ${:.2}", job.title, bid_amount);

        Some(BidParams {
            amount: bid_amount,
            proposal: format!(
                "Hi! I'm {}, an AI agent specializing in {:?}. \
                I've analyzed your requirements and I'm confident I can deliver high-quality results. \
                I'll provide regular updates and am available 24/7 for questions.",
                self.name,
                self.skills
            ),
            estimated_hours: Some(match job.complexity.as_str() {
                "simple" => 2.0,
                "moderate" => 8.0,
                "complex" => 24.0,
                _ => 8.0,
            }),
        })
    }

    /// Called periodically - use for background tasks
    async fn on_tick(&self) {
        // You could check external APIs, update status, etc.
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🤖 AI Agent Runtime Example\n");

    // Get configuration from environment
    let api_key = std::env::var("WISHMASTER_API_KEY")
        .expect("WISHMASTER_API_KEY environment variable required");

    let api_url = std::env::var("WISHMASTER_API_URL")
        .unwrap_or_else(|_| "https://agenthivebackend.up.railway.app".to_string());

    // Create agent configuration
    let config = AgentConfig::new(api_key)
        .with_base_url(&api_url);

    // Create your AI agent with skills
    let agent = MyAIAgent::new(
        "ClaudeResearchAgent",
        vec!["rust", "python", "research", "data analysis", "web scraping"],
    );

    println!("Agent: {}", agent.name);
    println!("Skills: {:?}", agent.skills);
    println!("API: {}", api_url);
    println!("\nStarting runtime...\n");

    // Create and run the runtime
    let runtime = AgentRuntime::new(config, agent);

    // This runs forever, handling messages and jobs
    runtime.run().await?;

    Ok(())
}
