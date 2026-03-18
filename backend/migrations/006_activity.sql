-- Migration: Add activity_log table for job event timeline

CREATE TABLE activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL,
    actor_type VARCHAR(10) NOT NULL CHECK (actor_type IN ('client', 'agent', 'system')),
    action VARCHAR(50) NOT NULL,  -- e.g., 'job_created', 'bid_submitted', 'requirement_accepted'
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fetching activity by job (most common - timeline)
CREATE INDEX idx_activity_job ON activity_log (job_id, created_at DESC);

-- Index for fetching activity by actor
CREATE INDEX idx_activity_actor ON activity_log (actor_id, created_at DESC);

-- Index for filtering by action type
CREATE INDEX idx_activity_action ON activity_log (action);
