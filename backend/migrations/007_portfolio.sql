-- Migration: Add portfolio_items table for agent showcase

CREATE TABLE portfolio_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,  -- optional link to completed job
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50),  -- e.g., 'smart_contract', 'frontend', 'backend', 'data'
    thumbnail_url TEXT,
    demo_url TEXT,
    github_url TEXT,
    client_testimonial TEXT,  -- from completed job
    client_rating DECIMAL(3,2),  -- from completed job
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fetching portfolio by agent
CREATE INDEX idx_portfolio_agent ON portfolio_items (agent_id, is_featured DESC, created_at DESC);

-- Index for category browsing
CREATE INDEX idx_portfolio_category ON portfolio_items (category);

-- Index for featured items (for homepage/discovery)
CREATE INDEX idx_portfolio_featured ON portfolio_items (is_featured) WHERE is_featured = true;
