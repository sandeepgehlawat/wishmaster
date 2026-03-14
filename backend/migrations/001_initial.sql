-- ═══════════════════════════════════════════════════════════════════════════
-- AGENTHIVE DATABASE SCHEMA
-- ═══════════════════════════════════════════════════════════════════════════

-- ---------------------------------------------------------------------------
-- USERS (Clients)
-- ---------------------------------------------------------------------------
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address VARCHAR(44) UNIQUE NOT NULL,  -- Solana pubkey
    email VARCHAR(255),
    display_name VARCHAR(100) NOT NULL,
    company_name VARCHAR(200),
    avatar_url VARCHAR(500),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_wallet ON users (wallet_address);

-- ---------------------------------------------------------------------------
-- AGENTS
-- ---------------------------------------------------------------------------
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address VARCHAR(44) UNIQUE NOT NULL,  -- Solana pubkey
    api_key_hash VARCHAR(255) UNIQUE NOT NULL,   -- For SDK auth

    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    avatar_url VARCHAR(500),

    skills JSONB DEFAULT '[]',      -- ["rust", "postgresql", "api_design"]
    trust_tier VARCHAR(20) DEFAULT 'new',  -- new, rising, established, top_rated

    is_active BOOLEAN DEFAULT true,
    is_sandbox_required BOOLEAN DEFAULT true,
    security_deposit_usdc DECIMAL(18,6) DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ
);

CREATE INDEX idx_agents_wallet ON agents (wallet_address);
CREATE INDEX idx_agents_skills ON agents USING GIN (skills);
CREATE INDEX idx_agents_tier ON agents (trust_tier);
CREATE INDEX idx_agents_active ON agents (is_active) WHERE is_active = true;

-- ---------------------------------------------------------------------------
-- AGENT REPUTATIONS (Materialized, updated daily)
-- ---------------------------------------------------------------------------
CREATE TABLE agent_reputations (
    agent_id UUID PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,

    -- Core metrics
    avg_rating DECIMAL(3,2) DEFAULT 0,          -- 1.00-5.00
    total_ratings INTEGER DEFAULT 0,
    completion_rate DECIMAL(4,3) DEFAULT 0,     -- 0.000-1.000
    completed_jobs INTEGER DEFAULT 0,

    -- Dimensions
    quality_score DECIMAL(3,2) DEFAULT 0,
    speed_score DECIMAL(3,2) DEFAULT 0,
    communication_score DECIMAL(3,2) DEFAULT 0,

    -- Calculated
    job_success_score DECIMAL(5,2) DEFAULT 0,   -- 0.00-100.00 (JSS)

    -- Lifetime
    total_earnings_usdc DECIMAL(18,6) DEFAULT 0,

    calculated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- CLIENT REPUTATIONS
-- ---------------------------------------------------------------------------
CREATE TABLE client_reputations (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

    avg_rating DECIMAL(3,2) DEFAULT 0,
    total_jobs INTEGER DEFAULT 0,
    payment_reliability DECIMAL(4,3) DEFAULT 1.0,
    clarity_score DECIMAL(3,2) DEFAULT 0,
    scope_respect_score DECIMAL(3,2) DEFAULT 0,
    dispute_rate DECIMAL(4,3) DEFAULT 0,

    calculated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- JOBS
-- ---------------------------------------------------------------------------
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES users(id),
    agent_id UUID REFERENCES agents(id),

    -- Content
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    task_type VARCHAR(50) NOT NULL,          -- coding, research, content, data
    required_skills JSONB DEFAULT '[]',
    complexity VARCHAR(20) DEFAULT 'moderate', -- simple, moderate, complex

    -- Budget
    budget_min DECIMAL(18,6) NOT NULL,
    budget_max DECIMAL(18,6) NOT NULL,
    final_price DECIMAL(18,6),               -- Set when agent selected
    pricing_model VARCHAR(20) DEFAULT 'fixed', -- fixed, hourly

    -- Timeline
    deadline TIMESTAMPTZ,
    bid_deadline TIMESTAMPTZ,
    urgency VARCHAR(20) DEFAULT 'standard',   -- standard, rush, critical

    -- State
    status VARCHAR(20) DEFAULT 'draft',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    CONSTRAINT valid_budget CHECK (budget_max >= budget_min),
    CONSTRAINT valid_status CHECK (status IN (
        'draft', 'open', 'bidding', 'assigned', 'in_progress',
        'delivered', 'revision', 'completed', 'disputed', 'cancelled', 'expired'
    ))
);

CREATE INDEX idx_jobs_client ON jobs (client_id);
CREATE INDEX idx_jobs_agent ON jobs (agent_id);
CREATE INDEX idx_jobs_status ON jobs (status);
CREATE INDEX idx_jobs_open ON jobs (created_at DESC) WHERE status IN ('open', 'bidding');
CREATE INDEX idx_jobs_skills ON jobs USING GIN (required_skills);

-- ---------------------------------------------------------------------------
-- BIDS
-- ---------------------------------------------------------------------------
CREATE TABLE bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id),

    -- The bid
    bid_amount DECIMAL(18,6) NOT NULL,
    estimated_hours DECIMAL(8,2),
    estimated_completion TIMESTAMPTZ,

    -- Proposal
    proposal TEXT NOT NULL,
    approach TEXT,
    relevant_work UUID[],                    -- References to past jobs

    -- Status
    status VARCHAR(20) DEFAULT 'pending',    -- pending, shortlisted, accepted, rejected, withdrawn
    revision_count INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT one_bid_per_agent UNIQUE (job_id, agent_id),
    CONSTRAINT max_revisions CHECK (revision_count <= 1)
);

CREATE INDEX idx_bids_job ON bids (job_id);
CREATE INDEX idx_bids_agent ON bids (agent_id);
CREATE INDEX idx_bids_status ON bids (status);

-- ---------------------------------------------------------------------------
-- ESCROWS (Mirrors on-chain state)
-- ---------------------------------------------------------------------------
CREATE TABLE escrows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID UNIQUE NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,

    -- On-chain references
    escrow_pda VARCHAR(44) NOT NULL,         -- Solana PDA address

    -- Wallets
    client_wallet VARCHAR(44) NOT NULL,
    agent_wallet VARCHAR(44),

    -- Amounts (in USDC, 6 decimals)
    amount_usdc DECIMAL(18,6) NOT NULL,
    platform_fee_usdc DECIMAL(18,6),
    agent_payout_usdc DECIMAL(18,6),

    -- Status
    status VARCHAR(20) DEFAULT 'created',    -- created, funded, locked, released, refunded, disputed

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    funded_at TIMESTAMPTZ,
    released_at TIMESTAMPTZ,

    -- Transaction signatures
    create_tx VARCHAR(88),
    fund_tx VARCHAR(88),
    release_tx VARCHAR(88)
);

CREATE INDEX idx_escrows_status ON escrows (status);
CREATE INDEX idx_escrows_job ON escrows (job_id);

-- ---------------------------------------------------------------------------
-- RATINGS
-- ---------------------------------------------------------------------------
CREATE TABLE ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,

    -- Who rated whom
    rater_type VARCHAR(10) NOT NULL,         -- 'client' or 'agent'
    rater_id UUID NOT NULL,
    ratee_type VARCHAR(10) NOT NULL,
    ratee_id UUID NOT NULL,

    -- Scores (1-5)
    overall INTEGER NOT NULL CHECK (overall BETWEEN 1 AND 5),
    dimension_1 INTEGER CHECK (dimension_1 BETWEEN 1 AND 5),  -- quality/clarity
    dimension_2 INTEGER CHECK (dimension_2 BETWEEN 1 AND 5),  -- speed/communication
    dimension_3 INTEGER CHECK (dimension_3 BETWEEN 1 AND 5),  -- communication/payment

    -- Review
    review_text TEXT,
    is_public BOOLEAN DEFAULT true,

    -- Anti-gaming
    is_quarantined BOOLEAN DEFAULT false,
    quarantine_reason TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT one_rating_per_job UNIQUE (job_id, rater_id, ratee_id)
);

CREATE INDEX idx_ratings_ratee ON ratings (ratee_id, ratee_type);
CREATE INDEX idx_ratings_job ON ratings (job_id);

-- ---------------------------------------------------------------------------
-- AUDIT LOG (For sandbox data access tracking)
-- ---------------------------------------------------------------------------
CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),

    agent_id UUID REFERENCES agents(id),
    job_id UUID REFERENCES jobs(id),

    action VARCHAR(50) NOT NULL,             -- 'data_access', 'file_read', 'api_call'
    resource_id VARCHAR(255),
    bytes_accessed BIGINT,

    source_ip INET,
    user_agent TEXT,

    metadata JSONB
);

CREATE INDEX idx_audit_agent_time ON audit_log (agent_id, timestamp DESC);
CREATE INDEX idx_audit_job ON audit_log (job_id);
CREATE INDEX idx_audit_action ON audit_log (action);
