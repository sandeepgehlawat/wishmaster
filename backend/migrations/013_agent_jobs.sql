-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 013: AGENT-TO-AGENT JOB CREATION & ERC-8004 IDENTITY
-- ═══════════════════════════════════════════════════════════════════════════
-- Enables agents to create jobs and hire other agents (agent-to-agent work)
-- Adds ERC-8004 identity NFT tracking for on-chain reputation

-- Step 1: Add creator_type column with default for backward compatibility
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS creator_type VARCHAR(20) NOT NULL DEFAULT 'client';

-- Step 2: Add agent_creator_id for jobs created by agents
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS agent_creator_id UUID REFERENCES agents(id);

-- Step 3: Make client_id nullable for agent-created jobs
ALTER TABLE jobs ALTER COLUMN client_id DROP NOT NULL;

-- Step 4: Add constraint - must have either client_id OR agent_creator_id
-- First drop if exists (for idempotency)
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS valid_job_creator;
ALTER TABLE jobs ADD CONSTRAINT valid_job_creator CHECK (
  (creator_type = 'client' AND client_id IS NOT NULL) OR
  (creator_type = 'agent' AND agent_creator_id IS NOT NULL)
);

-- Step 5: Add indexes for agent-created jobs
CREATE INDEX IF NOT EXISTS idx_jobs_agent_creator ON jobs(agent_creator_id) WHERE agent_creator_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_creator_type ON jobs(creator_type);

-- Step 6: Add identity_nft_id to agents table for ERC-8004 identity tracking
ALTER TABLE agents ADD COLUMN IF NOT EXISTS identity_nft_id BIGINT;
CREATE INDEX IF NOT EXISTS idx_agents_identity_nft ON agents(identity_nft_id) WHERE identity_nft_id IS NOT NULL;

-- Step 7: Add identity_nft_id to users table for optional human client ERC-8004 identity
ALTER TABLE users ADD COLUMN IF NOT EXISTS identity_nft_id BIGINT;
CREATE INDEX IF NOT EXISTS idx_users_identity_nft ON users(identity_nft_id) WHERE identity_nft_id IS NOT NULL;

-- Step 8: Update status constraint to ensure all valid statuses are allowed
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS valid_status;
ALTER TABLE jobs ADD CONSTRAINT valid_status CHECK (status IN (
  'draft', 'open', 'bidding', 'assigned', 'in_progress',
  'delivered', 'revision', 'completed', 'disputed', 'cancelled', 'expired'
));

-- Comments for documentation
COMMENT ON COLUMN jobs.creator_type IS 'Type of job creator: "client" (human) or "agent" (AI agent)';
COMMENT ON COLUMN jobs.agent_creator_id IS 'If creator_type is "agent", the ID of the agent that created this job';
COMMENT ON COLUMN agents.identity_nft_id IS 'ERC-8004 Identity NFT token ID on X Layer for on-chain reputation';
COMMENT ON COLUMN users.identity_nft_id IS 'Optional ERC-8004 Identity NFT token ID for human clients who want on-chain reputation';
