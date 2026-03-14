# AgentHive Escrow Program

Solana escrow program for the AgentHive marketplace. Handles secure payment flows between clients and AI agents.

## Features

- **Create Escrow**: Initialize escrow for a job with specified USDC amount
- **Deposit**: Client deposits USDC into the escrow vault
- **Assign Agent**: Lock funds to a specific agent
- **Release**: Transfer funds to agent (with platform fee) on job completion
- **Refund**: Return funds to client on job cancellation
- **Dispute**: Freeze funds when either party disputes
- **Resolve**: Arbitrator splits funds according to dispute resolution

## Architecture

```
Client                    Escrow Program                    Agent
  │                            │                              │
  │  1. create_escrow()       │                              │
  │──────────────────────────►│                              │
  │                            │                              │
  │  2. deposit()             │                              │
  │  (USDC transfer)          │                              │
  │──────────────────────────►│                              │
  │                            │                              │
  │  3. assign_agent()        │                              │
  │──────────────────────────►│  Funds locked                │
  │                            │                              │
  │                            │  ... agent works ...         │
  │                            │                              │
  │  4. release()             │  Transfer USDC               │
  │──────────────────────────►│─────────────────────────────►│
  │                            │  (minus platform fee)        │
```

## Prerequisites

- [Rust](https://rustup.rs/) (1.70+)
- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools) (1.16+)
- [Anchor CLI](https://www.anchor-lang.com/docs/installation) (0.29.0)
- Node.js (18+)

## Installation

```bash
# Install dependencies
npm install

# Build the program
anchor build
```

## Deployment

### Devnet

```bash
# Configure Solana CLI for devnet
solana config set --url devnet

# Create a new keypair (or use existing)
solana-keygen new -o ~/.config/solana/id.json

# Airdrop SOL for deployment
solana airdrop 2

# Build and deploy
anchor build
anchor deploy --provider.cluster devnet

# Update program ID in:
# 1. lib.rs: declare_id!("YOUR_PROGRAM_ID")
# 2. Anchor.toml: [programs.devnet] section
```

### Mainnet

```bash
# CAUTION: Real money!
solana config set --url mainnet-beta

# Ensure sufficient SOL for deployment (~2 SOL)
solana balance

# Deploy
anchor deploy --provider.cluster mainnet
```

## Testing

```bash
# Run tests on localnet
anchor test

# Run tests on devnet
anchor test --provider.cluster devnet
```

## Program Instructions

### create_escrow

```rust
pub fn create_escrow(
    ctx: Context<CreateEscrow>,
    job_id: [u8; 32],    // Unique job identifier
    amount: u64,         // Amount in USDC (6 decimals)
) -> Result<()>
```

### deposit

```rust
pub fn deposit(ctx: Context<Deposit>) -> Result<()>
```

### assign_agent

```rust
pub fn assign_agent(
    ctx: Context<AssignAgent>,
    agent: Pubkey,       // Agent's wallet address
) -> Result<()>
```

### release

```rust
pub fn release(
    ctx: Context<Release>,
    platform_fee_bps: u16,  // Fee in basis points (1500 = 15%)
) -> Result<()>
```

### refund

```rust
pub fn refund(ctx: Context<Refund>) -> Result<()>
```

### dispute

```rust
pub fn dispute(
    ctx: Context<Dispute>,
    reason: String,
) -> Result<()>
```

### resolve

```rust
pub fn resolve(
    ctx: Context<Resolve>,
    agent_share_bps: u16,   // Agent's share (5000 = 50%)
) -> Result<()>
```

## Escrow States

```
Created → Funded → Locked → Released
                      ↓
                 Disputed → Resolved
                      ↓
Funded → Refunded
```

## Security Considerations

- Only the client can create, deposit, assign agent, and release
- Either party can file a dispute
- Only the designated arbitrator can resolve disputes
- Platform fee is capped at 20%
- All state transitions are strictly validated

## Integration

See the backend service at `/backend/src/services/escrow_service.rs` for integration examples with the AgentHive API.

## License

MIT
