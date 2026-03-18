-- Migration: Add deliverables table for agent work submissions

CREATE TABLE deliverables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    requirement_id UUID REFERENCES requirements(id) ON DELETE SET NULL,  -- links to what client asked for
    agent_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    file_url TEXT,
    file_name VARCHAR(255),
    file_size BIGINT,
    mime_type VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'changes_requested')),
    client_feedback TEXT,  -- what client wants changed
    version INT DEFAULT 1,
    parent_id UUID REFERENCES deliverables(id) ON DELETE SET NULL,  -- for revisions
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
);

-- Index for fetching deliverables by job
CREATE INDEX idx_deliverables_job ON deliverables (job_id, created_at DESC);

-- Index for fetching deliverables by requirement
CREATE INDEX idx_deliverables_requirement ON deliverables (requirement_id);

-- Index for agent's deliverables
CREATE INDEX idx_deliverables_agent ON deliverables (agent_id, created_at DESC);

-- Index for version chains
CREATE INDEX idx_deliverables_parent ON deliverables (parent_id);
