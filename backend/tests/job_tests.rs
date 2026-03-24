//! Job service tests.
//!
//! Tests cover:
//! - Job creation (by client and by agent)
//! - Job retrieval and listing
//! - Job status transitions
//! - Job ownership verification
//! - Job updates

mod common;

use common::*;
use uuid::Uuid;
use wishmaster_backend::models::{CreateJob, JobStatus, UpdateJob};

// ============================================================================
// Job Creation Tests
// ============================================================================

#[tokio::test]
async fn test_create_job_by_client() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;

    let input = CreateJob {
        title: "Test Job Title".to_string(),
        description: "Test job description for testing".to_string(),
        task_type: "coding".to_string(),
        required_skills: vec!["rust".to_string(), "python".to_string()],
        complexity: Some("moderate".to_string()),
        budget_min: 100.0,
        budget_max: 500.0,
        deadline: None,
        bid_deadline: None,
        urgency: Some("standard".to_string()),
    };

    let job = ctx
        .services
        .jobs
        .create(user.id, input)
        .await
        .expect("Failed to create job");

    assert_eq!(job.client_id, Some(user.id));
    assert_eq!(job.title, "Test Job Title");
    assert_eq!(job.status, "draft");
    assert_eq!(job.creator_type, "client");
    assert!(job.agent_creator_id.is_none());
}

#[tokio::test]
async fn test_create_job_by_agent() {
    let ctx = TestContext::new().await;
    let agent = create_test_agent(&ctx, None).await;

    let input = CreateJob {
        title: "Agent-Created Job".to_string(),
        description: "Job created by an agent for delegation".to_string(),
        task_type: "research".to_string(),
        required_skills: vec!["data-analysis".to_string()],
        complexity: Some("simple".to_string()),
        budget_min: 50.0,
        budget_max: 200.0,
        deadline: None,
        bid_deadline: None,
        urgency: Some("rush".to_string()),
    };

    let job = ctx
        .services
        .jobs
        .create_by_agent(agent.id, input)
        .await
        .expect("Failed to create job by agent");

    assert!(job.client_id.is_none());
    assert_eq!(job.agent_creator_id, Some(agent.id));
    assert_eq!(job.creator_type, "agent");
    assert_eq!(job.title, "Agent-Created Job");
    assert_eq!(job.status, "draft");
}

#[tokio::test]
async fn test_create_job_with_all_fields() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;

    let deadline = chrono::Utc::now() + chrono::Duration::days(7);
    let bid_deadline = chrono::Utc::now() + chrono::Duration::days(3);

    let input = CreateJob {
        title: "Full Featured Job".to_string(),
        description: "Job with all fields populated".to_string(),
        task_type: "content".to_string(),
        required_skills: vec!["writing".to_string(), "editing".to_string(), "seo".to_string()],
        complexity: Some("complex".to_string()),
        budget_min: 500.0,
        budget_max: 2000.0,
        deadline: Some(deadline),
        bid_deadline: Some(bid_deadline),
        urgency: Some("critical".to_string()),
    };

    let job = ctx
        .services
        .jobs
        .create(user.id, input)
        .await
        .expect("Failed to create job");

    assert_eq!(job.complexity, "complex");
    assert_eq!(job.urgency, "critical");
    assert!(job.deadline.is_some());
    assert!(job.bid_deadline.is_some());
}

// ============================================================================
// Job Retrieval Tests
// ============================================================================

#[tokio::test]
async fn test_get_job_by_id() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let created_job = create_test_job(&ctx, user.id, None).await;

    let job = ctx
        .services
        .jobs
        .get(created_job.id)
        .await
        .expect("Failed to get job");

    assert_eq!(job.id, created_job.id);
    assert_eq!(job.title, created_job.title);
}

#[tokio::test]
async fn test_get_job_not_found() {
    let ctx = TestContext::new().await;
    let non_existent_id = Uuid::new_v4();

    let result = ctx.services.jobs.get(non_existent_id).await;

    assert!(result.is_err());
    match result {
        Err(e) => {
            let error_str = format!("{:?}", e);
            assert!(error_str.contains("not found") || error_str.contains("NotFound"));
        }
        _ => panic!("Expected error"),
    }
}

#[tokio::test]
async fn test_get_job_with_details() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let created_job = create_test_job(&ctx, user.id, None).await;

    let job_details = ctx
        .services
        .jobs
        .get_with_details(created_job.id)
        .await
        .expect("Failed to get job with details");

    assert_eq!(job_details.job.id, created_job.id);
    assert_eq!(job_details.client_name, Some(user.display_name.clone()));
    assert_eq!(job_details.creator_name, user.display_name);
}

// ============================================================================
// Job Listing Tests
// ============================================================================

#[tokio::test]
async fn test_list_public_jobs() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;

    // Create a job and set it to 'open' status
    let job = create_test_job(&ctx, user.id, None).await;
    set_job_status(&ctx, job.id, "open").await;

    let query = wishmaster_backend::models::JobListQuery {
        status: None,
        task_type: None,
        skills: None,
        min_budget: None,
        max_budget: None,
        search: None,
        client_id: None,
        agent_id: None,
        agent_creator_id: None,
        creator_type: None,
        page: Some(1),
        limit: Some(10),
    };

    let result = ctx
        .services
        .jobs
        .list_public(query)
        .await
        .expect("Failed to list jobs");

    // Should find the open job
    assert!(result.jobs.iter().any(|j| j.job.id == job.id));
}

#[tokio::test]
async fn test_list_public_jobs_excludes_drafts() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;

    // Create a draft job (default status)
    let draft_job = create_test_job(&ctx, user.id, None).await;

    let query = wishmaster_backend::models::JobListQuery {
        status: None,
        task_type: None,
        skills: None,
        min_budget: None,
        max_budget: None,
        search: None,
        client_id: None,
        agent_id: None,
        agent_creator_id: None,
        creator_type: None,
        page: Some(1),
        limit: Some(100),
    };

    let result = ctx
        .services
        .jobs
        .list_public(query)
        .await
        .expect("Failed to list jobs");

    // Draft jobs should NOT appear in public listing
    assert!(
        !result.jobs.iter().any(|j| j.job.id == draft_job.id),
        "Draft jobs should not appear in public listing"
    );
}

#[tokio::test]
async fn test_list_jobs_by_agent_creator() {
    let ctx = TestContext::new().await;
    let agent = create_test_agent(&ctx, None).await;

    // Create a job as the agent
    let input = CreateJob {
        title: "Agent's Job".to_string(),
        description: "Job created by agent".to_string(),
        task_type: "coding".to_string(),
        required_skills: vec!["rust".to_string()],
        complexity: Some("simple".to_string()),
        budget_min: 100.0,
        budget_max: 300.0,
        deadline: None,
        bid_deadline: None,
        urgency: None,
    };

    let job = ctx
        .services
        .jobs
        .create_by_agent(agent.id, input)
        .await
        .expect("Failed to create job");

    let query = wishmaster_backend::models::JobListQuery {
        status: None,
        task_type: None,
        skills: None,
        min_budget: None,
        max_budget: None,
        search: None,
        client_id: None,
        agent_id: None,
        agent_creator_id: None,
        creator_type: None,
        page: Some(1),
        limit: Some(10),
    };

    let result = ctx
        .services
        .jobs
        .list_by_agent_creator(agent.id, query)
        .await
        .expect("Failed to list agent's jobs");

    assert!(result.jobs.iter().any(|j| j.job.id == job.id));
}

// ============================================================================
// Job Status Transition Tests
// ============================================================================

#[tokio::test]
async fn test_valid_status_transition_draft_to_open() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let job = create_test_job(&ctx, user.id, None).await;

    let updated = ctx
        .services
        .jobs
        .transition_status(job.id, "draft", JobStatus::Open)
        .await
        .expect("Failed to transition status");

    assert_eq!(updated.status, "open");
    assert!(updated.published_at.is_some());
}

#[tokio::test]
async fn test_invalid_status_transition() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let job = create_test_job(&ctx, user.id, None).await;

    // Try to transition from draft to completed (invalid)
    let result = ctx
        .services
        .jobs
        .transition_status(job.id, "draft", JobStatus::Completed)
        .await;

    assert!(result.is_err());
    match result {
        Err(e) => {
            let error_str = format!("{:?}", e);
            assert!(
                error_str.contains("InvalidStateTransition") || error_str.contains("Cannot transition"),
                "Expected InvalidStateTransition error"
            );
        }
        _ => panic!("Expected error"),
    }
}

#[tokio::test]
async fn test_status_transition_sets_timestamp() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let job = create_test_job(&ctx, user.id, None).await;

    // Transition draft -> open
    let job = ctx
        .services
        .jobs
        .transition_status(job.id, "draft", JobStatus::Open)
        .await
        .expect("Failed to transition to open");
    assert!(job.published_at.is_some());

    // Set up for in_progress transition
    set_job_status(&ctx, job.id, "assigned").await;

    let job = ctx
        .services
        .jobs
        .transition_status(job.id, "assigned", JobStatus::InProgress)
        .await
        .expect("Failed to transition to in_progress");
    assert!(job.started_at.is_some());
}

#[tokio::test]
async fn test_concurrent_status_transition_conflict() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let job = create_test_job(&ctx, user.id, None).await;

    // First transition succeeds
    let _ = ctx
        .services
        .jobs
        .transition_status(job.id, "draft", JobStatus::Open)
        .await
        .expect("First transition should succeed");

    // Second transition with stale status should fail
    let result = ctx
        .services
        .jobs
        .transition_status(job.id, "draft", JobStatus::Open)
        .await;

    assert!(result.is_err());
    match result {
        Err(e) => {
            let error_str = format!("{:?}", e);
            assert!(
                error_str.contains("Conflict") || error_str.contains("status has changed"),
                "Expected conflict error"
            );
        }
        _ => panic!("Expected error"),
    }
}

// ============================================================================
// Job Ownership Tests
// ============================================================================

#[tokio::test]
async fn test_client_owns_job() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let job_created = create_test_job(&ctx, user.id, None).await;

    let job = ctx.services.jobs.get(job_created.id).await.unwrap();

    assert!(
        ctx.services.jobs.is_owner(&job, user.id, "client"),
        "Client should own their job"
    );

    // Another user should not own it
    let other_user = create_test_user(&ctx, None).await;
    assert!(
        !ctx.services.jobs.is_owner(&job, other_user.id, "client"),
        "Other user should not own the job"
    );
}

#[tokio::test]
async fn test_agent_owns_agent_created_job() {
    let ctx = TestContext::new().await;
    let agent = create_test_agent(&ctx, None).await;

    let input = CreateJob {
        title: "Agent's Job".to_string(),
        description: "Job created by agent".to_string(),
        task_type: "coding".to_string(),
        required_skills: vec!["rust".to_string()],
        complexity: Some("simple".to_string()),
        budget_min: 100.0,
        budget_max: 300.0,
        deadline: None,
        bid_deadline: None,
        urgency: None,
    };

    let job = ctx
        .services
        .jobs
        .create_by_agent(agent.id, input)
        .await
        .expect("Failed to create job");

    assert!(
        ctx.services.jobs.is_owner(&job, agent.id, "agent"),
        "Agent should own their job"
    );

    // Another agent should not own it
    let other_agent = create_test_agent(&ctx, None).await;
    assert!(
        !ctx.services.jobs.is_owner(&job, other_agent.id, "agent"),
        "Other agent should not own the job"
    );
}

// ============================================================================
// Job Update Tests
// ============================================================================

#[tokio::test]
async fn test_update_draft_job() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let job = create_test_job(&ctx, user.id, None).await;

    let update = UpdateJob {
        title: Some("Updated Title".to_string()),
        description: Some("Updated description".to_string()),
        task_type: None,
        required_skills: None,
        complexity: None,
        budget_min: Some(200.0),
        budget_max: Some(600.0),
        deadline: None,
        bid_deadline: None,
        urgency: None,
    };

    let updated = ctx
        .services
        .jobs
        .update(job.id, user.id, update)
        .await
        .expect("Failed to update job");

    assert_eq!(updated.title, "Updated Title");
    assert_eq!(updated.description, "Updated description");
}

#[tokio::test]
async fn test_cannot_update_non_draft_job() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let job = create_test_job(&ctx, user.id, None).await;

    // Change status to open
    set_job_status(&ctx, job.id, "open").await;

    let update = UpdateJob {
        title: Some("Should Fail".to_string()),
        description: None,
        task_type: None,
        required_skills: None,
        complexity: None,
        budget_min: None,
        budget_max: None,
        deadline: None,
        bid_deadline: None,
        urgency: None,
    };

    let result = ctx.services.jobs.update(job.id, user.id, update).await;

    assert!(result.is_err());
    match result {
        Err(e) => {
            let error_str = format!("{:?}", e);
            assert!(
                error_str.contains("draft") || error_str.contains("BadRequest"),
                "Expected error about draft status"
            );
        }
        _ => panic!("Expected error"),
    }
}

#[tokio::test]
async fn test_cannot_update_other_users_job() {
    let ctx = TestContext::new().await;
    let user1 = create_test_user(&ctx, None).await;
    let user2 = create_test_user(&ctx, None).await;
    let job = create_test_job(&ctx, user1.id, None).await;

    let update = UpdateJob {
        title: Some("Unauthorized Update".to_string()),
        description: None,
        task_type: None,
        required_skills: None,
        complexity: None,
        budget_min: None,
        budget_max: None,
        deadline: None,
        bid_deadline: None,
        urgency: None,
    };

    // User2 tries to update User1's job
    let result = ctx.services.jobs.update(job.id, user2.id, update).await;

    assert!(result.is_err());
    match result {
        Err(e) => {
            let error_str = format!("{:?}", e);
            assert!(
                error_str.contains("Forbidden") || error_str.contains("Not authorized"),
                "Expected forbidden error"
            );
        }
        _ => panic!("Expected error"),
    }
}

// ============================================================================
// Job Assignment Tests
// ============================================================================

#[tokio::test]
async fn test_assign_agent_to_job() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let agent = create_test_agent(&ctx, None).await;
    let job = create_test_job(&ctx, user.id, None).await;

    // Set job to bidding status
    set_job_status(&ctx, job.id, "bidding").await;

    let assigned = ctx
        .services
        .jobs
        .assign_agent(job.id, agent.id, 250.0)
        .await
        .expect("Failed to assign agent");

    assert_eq!(assigned.agent_id, Some(agent.id));
    assert_eq!(assigned.status, "assigned");
    assert!(assigned.started_at.is_some());
}

#[tokio::test]
async fn test_cannot_assign_agent_to_non_bidding_job() {
    let ctx = TestContext::new().await;
    let user = create_test_user(&ctx, None).await;
    let agent = create_test_agent(&ctx, None).await;
    let job = create_test_job(&ctx, user.id, None).await;

    // Job is in draft status (default)
    let result = ctx.services.jobs.assign_agent(job.id, agent.id, 250.0).await;

    assert!(result.is_err());
    match result {
        Err(e) => {
            let error_str = format!("{:?}", e);
            assert!(
                error_str.contains("Conflict") || error_str.contains("bidding"),
                "Expected conflict error about bidding status"
            );
        }
        _ => panic!("Expected error"),
    }
}

// ============================================================================
// JobStatus Enum Tests
// ============================================================================

#[test]
fn test_job_status_as_str() {
    assert_eq!(JobStatus::Draft.as_str(), "draft");
    assert_eq!(JobStatus::Open.as_str(), "open");
    assert_eq!(JobStatus::Bidding.as_str(), "bidding");
    assert_eq!(JobStatus::Assigned.as_str(), "assigned");
    assert_eq!(JobStatus::InProgress.as_str(), "in_progress");
    assert_eq!(JobStatus::Delivered.as_str(), "delivered");
    assert_eq!(JobStatus::Revision.as_str(), "revision");
    assert_eq!(JobStatus::Completed.as_str(), "completed");
    assert_eq!(JobStatus::Disputed.as_str(), "disputed");
    assert_eq!(JobStatus::Cancelled.as_str(), "cancelled");
    assert_eq!(JobStatus::Expired.as_str(), "expired");
}

#[test]
fn test_job_status_from_str() {
    assert_eq!(JobStatus::from_str("draft"), JobStatus::Draft);
    assert_eq!(JobStatus::from_str("open"), JobStatus::Open);
    assert_eq!(JobStatus::from_str("bidding"), JobStatus::Bidding);
    assert_eq!(JobStatus::from_str("in_progress"), JobStatus::InProgress);
    assert_eq!(JobStatus::from_str("completed"), JobStatus::Completed);

    // Unknown status defaults to Draft
    assert_eq!(JobStatus::from_str("unknown"), JobStatus::Draft);
    assert_eq!(JobStatus::from_str(""), JobStatus::Draft);
}

#[test]
fn test_job_status_valid_transitions() {
    // Draft can only go to Open
    let draft_transitions = JobStatus::Draft.valid_transitions();
    assert_eq!(draft_transitions, vec![JobStatus::Open]);

    // Open can go to Bidding, Expired, or Cancelled
    let open_transitions = JobStatus::Open.valid_transitions();
    assert!(open_transitions.contains(&JobStatus::Bidding));
    assert!(open_transitions.contains(&JobStatus::Expired));
    assert!(open_transitions.contains(&JobStatus::Cancelled));

    // Completed is terminal
    let completed_transitions = JobStatus::Completed.valid_transitions();
    assert!(completed_transitions.is_empty());
}

#[test]
fn test_job_status_can_transition_to() {
    assert!(JobStatus::Draft.can_transition_to(&JobStatus::Open));
    assert!(!JobStatus::Draft.can_transition_to(&JobStatus::Completed));

    assert!(JobStatus::Delivered.can_transition_to(&JobStatus::Completed));
    assert!(JobStatus::Delivered.can_transition_to(&JobStatus::Revision));
    assert!(JobStatus::Delivered.can_transition_to(&JobStatus::Disputed));

    assert!(!JobStatus::Completed.can_transition_to(&JobStatus::Draft));
}
