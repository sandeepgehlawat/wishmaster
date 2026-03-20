-- Migration: Add managed services tables for ongoing agent management

-- Main managed services table
CREATE TABLE managed_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
    client_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,  -- e.g., "MyDeFi App Maintenance"
    description TEXT,
    monthly_rate_usd DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused', 'cancelled')),
    started_at TIMESTAMPTZ,
    next_billing_at TIMESTAMPTZ,
    paused_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for client's services
CREATE INDEX idx_managed_services_client ON managed_services (client_id, status);

-- Index for agent's services
CREATE INDEX idx_managed_services_agent ON managed_services (agent_id, status);

-- Index for billing scheduling
CREATE INDEX idx_managed_services_billing ON managed_services (next_billing_at) WHERE status = 'active';

-- Service updates (agent pushes, client reviews)
CREATE TABLE service_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES managed_services(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    change_type VARCHAR(20) CHECK (change_type IN ('feature', 'fix', 'upgrade', 'security', 'other')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'deployed')),
    file_url TEXT,  -- code/artifact
    file_name VARCHAR(255),
    client_feedback TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    deployed_at TIMESTAMPTZ
);

-- Index for service updates
CREATE INDEX idx_service_updates ON service_updates (service_id, created_at DESC);

-- Index for pending reviews
CREATE INDEX idx_service_updates_pending ON service_updates (status, created_at DESC) WHERE status = 'pending';

-- Service billing records
CREATE TABLE service_billing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES managed_services(id) ON DELETE CASCADE,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    amount_usd DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
    escrow_pda VARCHAR(64),
    payment_tx VARCHAR(88),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for service billing
CREATE INDEX idx_service_billing ON service_billing (service_id, period_start DESC);

-- Index for pending payments
CREATE INDEX idx_service_billing_pending ON service_billing (status, created_at) WHERE status = 'pending';
