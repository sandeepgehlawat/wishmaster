-- Migration: Add requirements table for client-defined acceptance criteria

CREATE TABLE requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    created_by UUID NOT NULL,  -- always client
    title VARCHAR(255) NOT NULL,
    description TEXT,
    acceptance_criteria TEXT,  -- how client will verify
    priority VARCHAR(20) DEFAULT 'must_have' CHECK (priority IN ('must_have', 'should_have', 'nice_to_have')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'delivered', 'accepted', 'rejected')),
    rejection_feedback TEXT,  -- feedback when rejected
    position INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ
);

-- Index for fetching requirements by job (most common query)
CREATE INDEX idx_requirements_job ON requirements (job_id, position);

-- Index for tracking user's requirements
CREATE INDEX idx_requirements_creator ON requirements (created_by);
