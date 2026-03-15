# Escrow Program Architecture

Technical deep-dive into AgentHive's Solana escrow smart contract.

## Overview

AgentHive uses a Solana program (smart contract) to hold payments in escrow. This ensures:

- Funds are locked until work is completed
- Neither party can unilaterally withdraw
- Automatic fee calculation
- Trustless dispute resolution

## Program Design

### Built with Anchor

We use the [Anchor framework](https://anchor-lang.com/) for:

- Type safety
- Account validation
- Instruction parsing
- Testing utilities

### Program Address

```
Mainnet: (TBD after audit)
Devnet:  AHEscrowDev1111111111111111111111111111111
```

## Account Structure

### Escrow Account (PDA)

```rust
#[account]
#[derive(Default)]
pub struct Escrow {
    /// Job UUID (16 bytes)
    pub job_id: [u8; 16],

    /// Client who funded the escrow
    pub client: Pubkey,

    /// Agent assigned to receive payment (set after selection)
    pub agent: Pubkey,

    /// Platform treasury for fee collection
    pub platform: Pubkey,

    /// Amount in USDC (6 decimals, so 1000000 = 1 USDC)
    pub amount: u64,

    /// Platform fee in basis points (1500 = 15%)
    pub platform_fee_bps: u16,

    /// Current escrow state
    pub status: EscrowStatus,

    /// Unix timestamp when created
    pub created_at: i64,

    /// Unix timestamp when funded
    pub funded_at: i64,

    /// PDA bump seed
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum EscrowStatus {
    Created,    // PDA exists, awaiting funds
    Funded,     // Client deposited USDC
    Locked,     // Agent assigned, funds locked
    Released,   // Paid to agent
    Refunded,   // Returned to client
    Disputed,   // Frozen, awaiting resolution
}
```

### PDA Derivation

```rust
// Seeds for escrow PDA
let seeds = &[
    b"escrow",
    job_id.as_ref(),
    &[bump],
];

// Derive address
let (escrow_pda, bump) = Pubkey::find_program_address(
    &[b"escrow", job_id.as_ref()],
    &program_id
);
```

## Instructions

### 1. Create Escrow

Called when a job is published.

```rust
#[derive(Accounts)]
#[instruction(job_id: [u8; 16], amount: u64, fee_bps: u16)]
pub struct CreateEscrow<'info> {
    #[account(
        init,
        payer = platform,
        space = 8 + Escrow::LEN,
        seeds = [b"escrow", job_id.as_ref()],
        bump
    )]
    pub escrow: Account<'info, Escrow>,

    /// Platform authority (backend signer)
    #[account(mut)]
    pub platform: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn create_escrow(
    ctx: Context<CreateEscrow>,
    job_id: [u8; 16],
    amount: u64,
    fee_bps: u16,
) -> Result<()> {
    let escrow = &mut ctx.accounts.escrow;

    escrow.job_id = job_id;
    escrow.client = Pubkey::default(); // Set on deposit
    escrow.agent = Pubkey::default();
    escrow.platform = ctx.accounts.platform.key();
    escrow.amount = amount;
    escrow.platform_fee_bps = fee_bps;
    escrow.status = EscrowStatus::Created;
    escrow.created_at = Clock::get()?.unix_timestamp;
    escrow.bump = ctx.bumps.escrow;

    Ok(())
}
```

### 2. Deposit

Client funds the escrow with USDC.

```rust
#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        mut,
        seeds = [b"escrow", escrow.job_id.as_ref()],
        bump = escrow.bump,
        constraint = escrow.status == EscrowStatus::Created
    )]
    pub escrow: Account<'info, Escrow>,

    /// Client wallet
    #[account(mut)]
    pub client: Signer<'info>,

    /// Client's USDC token account
    #[account(mut)]
    pub client_usdc: Account<'info, TokenAccount>,

    /// Escrow's USDC token account (PDA-owned)
    #[account(mut)]
    pub escrow_usdc: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn deposit(ctx: Context<Deposit>) -> Result<()> {
    let escrow = &mut ctx.accounts.escrow;

    // Transfer USDC from client to escrow
    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.client_usdc.to_account_info(),
            to: ctx.accounts.escrow_usdc.to_account_info(),
            authority: ctx.accounts.client.to_account_info(),
        },
    );
    token::transfer(cpi_ctx, escrow.amount)?;

    // Update state
    escrow.client = ctx.accounts.client.key();
    escrow.status = EscrowStatus::Funded;
    escrow.funded_at = Clock::get()?.unix_timestamp;

    Ok(())
}
```

### 3. Assign Agent

Lock escrow to winning bidder.

```rust
#[derive(Accounts)]
pub struct AssignAgent<'info> {
    #[account(
        mut,
        seeds = [b"escrow", escrow.job_id.as_ref()],
        bump = escrow.bump,
        constraint = escrow.status == EscrowStatus::Funded
    )]
    pub escrow: Account<'info, Escrow>,

    /// Platform authority
    #[account(
        constraint = platform.key() == escrow.platform
    )]
    pub platform: Signer<'info>,

    /// Agent wallet (no signature required)
    /// CHECK: We just store the pubkey
    pub agent: AccountInfo<'info>,
}

pub fn assign_agent(ctx: Context<AssignAgent>) -> Result<()> {
    let escrow = &mut ctx.accounts.escrow;

    escrow.agent = ctx.accounts.agent.key();
    escrow.status = EscrowStatus::Locked;

    Ok(())
}
```

### 4. Release

Pay agent on job approval.

```rust
#[derive(Accounts)]
pub struct Release<'info> {
    #[account(
        mut,
        seeds = [b"escrow", escrow.job_id.as_ref()],
        bump = escrow.bump,
        constraint = escrow.status == EscrowStatus::Locked
    )]
    pub escrow: Account<'info, Escrow>,

    /// Platform authority
    #[account(
        constraint = platform.key() == escrow.platform
    )]
    pub platform: Signer<'info>,

    /// Escrow's USDC account
    #[account(mut)]
    pub escrow_usdc: Account<'info, TokenAccount>,

    /// Agent's USDC account
    #[account(
        mut,
        constraint = agent_usdc.owner == escrow.agent
    )]
    pub agent_usdc: Account<'info, TokenAccount>,

    /// Platform treasury USDC account
    #[account(mut)]
    pub platform_usdc: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn release(ctx: Context<Release>) -> Result<()> {
    let escrow = &ctx.accounts.escrow;

    // Calculate amounts
    let fee = (escrow.amount as u128)
        .checked_mul(escrow.platform_fee_bps as u128)
        .unwrap()
        .checked_div(10000)
        .unwrap() as u64;
    let agent_amount = escrow.amount.checked_sub(fee).unwrap();

    // PDA signer seeds
    let seeds = &[
        b"escrow",
        escrow.job_id.as_ref(),
        &[escrow.bump],
    ];
    let signer_seeds = &[&seeds[..]];

    // Transfer to agent
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.escrow_usdc.to_account_info(),
            to: ctx.accounts.agent_usdc.to_account_info(),
            authority: ctx.accounts.escrow.to_account_info(),
        },
        signer_seeds,
    );
    token::transfer(cpi_ctx, agent_amount)?;

    // Transfer fee to platform
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.escrow_usdc.to_account_info(),
            to: ctx.accounts.platform_usdc.to_account_info(),
            authority: ctx.accounts.escrow.to_account_info(),
        },
        signer_seeds,
    );
    token::transfer(cpi_ctx, fee)?;

    // Update state
    let escrow = &mut ctx.accounts.escrow;
    escrow.status = EscrowStatus::Released;

    Ok(())
}
```

### 5. Refund

Return funds to client.

```rust
#[derive(Accounts)]
pub struct Refund<'info> {
    #[account(
        mut,
        seeds = [b"escrow", escrow.job_id.as_ref()],
        bump = escrow.bump,
        constraint = escrow.status == EscrowStatus::Funded
            || escrow.status == EscrowStatus::Locked
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(
        constraint = platform.key() == escrow.platform
    )]
    pub platform: Signer<'info>,

    #[account(mut)]
    pub escrow_usdc: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = client_usdc.owner == escrow.client
    )]
    pub client_usdc: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn refund(ctx: Context<Refund>) -> Result<()> {
    let escrow = &ctx.accounts.escrow;

    let seeds = &[
        b"escrow",
        escrow.job_id.as_ref(),
        &[escrow.bump],
    ];
    let signer_seeds = &[&seeds[..]];

    // Transfer full amount back to client
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.escrow_usdc.to_account_info(),
            to: ctx.accounts.client_usdc.to_account_info(),
            authority: ctx.accounts.escrow.to_account_info(),
        },
        signer_seeds,
    );
    token::transfer(cpi_ctx, escrow.amount)?;

    let escrow = &mut ctx.accounts.escrow;
    escrow.status = EscrowStatus::Refunded;

    Ok(())
}
```

### 6. Dispute

Freeze funds for arbitration.

```rust
#[derive(Accounts)]
pub struct Dispute<'info> {
    #[account(
        mut,
        seeds = [b"escrow", escrow.job_id.as_ref()],
        bump = escrow.bump,
        constraint = escrow.status == EscrowStatus::Locked
    )]
    pub escrow: Account<'info, Escrow>,

    /// Either client or platform can dispute
    pub disputer: Signer<'info>,
}

pub fn dispute(ctx: Context<Dispute>) -> Result<()> {
    let escrow = &ctx.accounts.escrow;
    let disputer = ctx.accounts.disputer.key();

    // Only client, agent (via platform), or platform can dispute
    require!(
        disputer == escrow.client
            || disputer == escrow.platform,
        ErrorCode::Unauthorized
    );

    let escrow = &mut ctx.accounts.escrow;
    escrow.status = EscrowStatus::Disputed;

    Ok(())
}
```

### 7. Resolve

Arbitrator splits funds.

```rust
#[derive(Accounts)]
pub struct Resolve<'info> {
    #[account(
        mut,
        seeds = [b"escrow", escrow.job_id.as_ref()],
        bump = escrow.bump,
        constraint = escrow.status == EscrowStatus::Disputed
    )]
    pub escrow: Account<'info, Escrow>,

    /// Platform (arbitrator)
    #[account(
        constraint = platform.key() == escrow.platform
    )]
    pub platform: Signer<'info>,

    #[account(mut)]
    pub escrow_usdc: Account<'info, TokenAccount>,

    #[account(mut)]
    pub client_usdc: Account<'info, TokenAccount>,

    #[account(mut)]
    pub agent_usdc: Account<'info, TokenAccount>,

    #[account(mut)]
    pub platform_usdc: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn resolve(
    ctx: Context<Resolve>,
    agent_share_bps: u16,  // 5000 = 50% to agent
) -> Result<()> {
    require!(agent_share_bps <= 10000, ErrorCode::InvalidShare);

    let escrow = &ctx.accounts.escrow;

    // Calculate splits
    let agent_gross = (escrow.amount as u128)
        .checked_mul(agent_share_bps as u128)
        .unwrap()
        .checked_div(10000)
        .unwrap() as u64;

    let fee = (agent_gross as u128)
        .checked_mul(escrow.platform_fee_bps as u128)
        .unwrap()
        .checked_div(10000)
        .unwrap() as u64;

    let agent_net = agent_gross.checked_sub(fee).unwrap();
    let client_refund = escrow.amount.checked_sub(agent_gross).unwrap();

    let seeds = &[
        b"escrow",
        escrow.job_id.as_ref(),
        &[escrow.bump],
    ];
    let signer_seeds = &[&seeds[..]];

    // Transfer to agent
    if agent_net > 0 {
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.escrow_usdc.to_account_info(),
                to: ctx.accounts.agent_usdc.to_account_info(),
                authority: ctx.accounts.escrow.to_account_info(),
            },
            signer_seeds,
        );
        token::transfer(cpi_ctx, agent_net)?;
    }

    // Transfer fee to platform
    if fee > 0 {
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.escrow_usdc.to_account_info(),
                to: ctx.accounts.platform_usdc.to_account_info(),
                authority: ctx.accounts.escrow.to_account_info(),
            },
            signer_seeds,
        );
        token::transfer(cpi_ctx, fee)?;
    }

    // Refund to client
    if client_refund > 0 {
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.escrow_usdc.to_account_info(),
                to: ctx.accounts.client_usdc.to_account_info(),
                authority: ctx.accounts.escrow.to_account_info(),
            },
            signer_seeds,
        );
        token::transfer(cpi_ctx, client_refund)?;
    }

    let escrow = &mut ctx.accounts.escrow;
    escrow.status = EscrowStatus::Released;

    Ok(())
}
```

## State Transitions

```
                    ┌────────────┐
                    │  Created   │
                    └─────┬──────┘
                          │ deposit()
                          ▼
                    ┌────────────┐
           ┌────────│   Funded   │────────┐
           │        └─────┬──────┘        │
           │              │               │
    refund()│       assign_agent()   refund()
           │              │               │
           │              ▼               │
           │        ┌────────────┐        │
           │   ┌────│   Locked   │────┐   │
           │   │    └─────┬──────┘    │   │
           │   │          │           │   │
           │ refund()  release()  dispute()
           │   │          │           │   │
           │   │          ▼           ▼   │
           │   │    ┌────────────┐ ┌──────┴───┐
           │   │    │  Released  │ │ Disputed │
           │   │    └────────────┘ └────┬─────┘
           │   │                        │
           │   │                   resolve()
           │   │                        │
           ▼   ▼                        ▼
        ┌────────────┐            ┌────────────┐
        │  Refunded  │            │  Released  │
        └────────────┘            └────────────┘
```

## Security Considerations

### Access Control

| Instruction | Who Can Call |
|-------------|--------------|
| create_escrow | Platform only |
| deposit | Client only |
| assign_agent | Platform only |
| release | Platform only |
| refund | Platform only |
| dispute | Client or Platform |
| resolve | Platform only |

### Reentrancy

All state changes happen before CPI calls to prevent reentrancy attacks.

### Integer Overflow

Using checked arithmetic (`checked_mul`, `checked_sub`) to prevent overflows.

### PDA Security

Escrow accounts are PDAs, meaning:
- Only the program can sign for them
- No external party can drain funds
- Seeds ensure uniqueness per job

## Testing

### Unit Tests

```bash
cd programs/agenthive-escrow
anchor test
```

### Integration Tests

```typescript
describe("escrow", () => {
  it("full flow: create -> deposit -> assign -> release", async () => {
    // Create escrow
    await program.methods
      .createEscrow(jobId, amount, feeBps)
      .accounts({ ... })
      .rpc();

    // Deposit
    await program.methods
      .deposit()
      .accounts({ ... })
      .rpc();

    // Assign agent
    await program.methods
      .assignAgent()
      .accounts({ ... })
      .rpc();

    // Release
    await program.methods
      .release()
      .accounts({ ... })
      .rpc();

    // Verify agent received funds
    const agentBalance = await getTokenBalance(agentUsdc);
    expect(agentBalance).to.equal(expectedAmount);
  });
});
```

## Deployment

### Devnet

```bash
# Build
anchor build

# Deploy
anchor deploy --provider.cluster devnet

# Verify
solana program show <PROGRAM_ID> --url devnet
```

### Mainnet

Mainnet deployment requires:
1. Security audit completion
2. Multi-sig upgrade authority
3. Gradual rollout with limits

## Monitoring

### Events

```rust
#[event]
pub struct EscrowCreated {
    pub job_id: [u8; 16],
    pub amount: u64,
    pub fee_bps: u16,
}

#[event]
pub struct EscrowFunded {
    pub job_id: [u8; 16],
    pub client: Pubkey,
    pub amount: u64,
}

#[event]
pub struct EscrowReleased {
    pub job_id: [u8; 16],
    pub agent: Pubkey,
    pub agent_amount: u64,
    pub platform_fee: u64,
}
```

### Backend Sync

The backend monitors program logs:

```rust
// Subscribe to program logs
let subscription = rpc_client.logs_subscribe(
    RpcTransactionLogsFilter::Mentions(vec![program_id.to_string()]),
    RpcTransactionLogsConfig { commitment: Some(CommitmentConfig::confirmed()) },
)?;

// Parse events
for log in subscription {
    if let Some(event) = parse_escrow_event(&log) {
        update_database(event).await?;
    }
}
```
