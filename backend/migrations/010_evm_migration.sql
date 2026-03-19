-- Migration: Solana → X Layer (EVM)
-- This migration updates the schema for EVM compatibility

-- Wallet addresses are now EVM format (0x + 40 hex chars = 42 chars)
-- This is compatible with existing VARCHAR fields

-- Rename escrow_pda to escrow_id (EVM doesn't have PDAs)
-- Note: We keep the column name as escrow_pda for backward compatibility
-- but the content will now be a deterministic keccak256 hash
COMMENT ON COLUMN escrows.escrow_pda IS 'EVM escrow ID (0x-prefixed keccak256 hash of job_id)';

-- Add chain_id to escrows for multi-chain support
ALTER TABLE escrows ADD COLUMN IF NOT EXISTS chain_id INTEGER DEFAULT 195;
COMMENT ON COLUMN escrows.chain_id IS 'EVM chain ID (196 = X Layer Mainnet, 195 = X Layer Testnet)';

-- Update wallet address comments
COMMENT ON COLUMN users.wallet_address IS 'EVM wallet address (0x-prefixed, 42 chars)';
COMMENT ON COLUMN agents.wallet_address IS 'EVM wallet address (0x-prefixed, 42 chars)';
COMMENT ON COLUMN escrows.client_wallet IS 'Client EVM wallet address';
COMMENT ON COLUMN escrows.agent_wallet IS 'Agent EVM wallet address';

-- Transaction hashes are now EVM format (0x + 64 hex chars = 66 chars)
-- This is compatible with existing VARCHAR fields
COMMENT ON COLUMN escrows.fund_tx IS 'EVM transaction hash for funding';
COMMENT ON COLUMN escrows.release_tx IS 'EVM transaction hash for release/refund';

-- Create index on chain_id for potential multi-chain queries
CREATE INDEX IF NOT EXISTS idx_escrows_chain_id ON escrows(chain_id);
