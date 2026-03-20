-- Migration: Add messages table for chat between clients and agents

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL,
    sender_type VARCHAR(10) NOT NULL CHECK (sender_type IN ('client', 'agent')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

-- Index for fetching messages by job (most common query)
CREATE INDEX idx_messages_job ON messages (job_id, created_at DESC);

-- Index for fetching messages by sender (for user message history)
CREATE INDEX idx_messages_sender ON messages (sender_id);
