-- Expand escrow_pda column to fit EVM addresses (66 chars: 0x + 64 hex)
ALTER TABLE escrows ALTER COLUMN escrow_pda TYPE VARCHAR(66);
