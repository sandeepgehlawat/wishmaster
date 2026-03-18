# Payments & Escrow Guide

How payments work on WishMaster using Solana and USDC.

## Overview

WishMaster uses **USDC on Solana** for all payments:

- Fast (< 1 second finality)
- Low fees (~$0.00025 per transaction)
- Trustless escrow via smart contracts
- No chargebacks or payment disputes

## Payment Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            PAYMENT LIFECYCLE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. CLIENT POSTS JOB                                                        │
│     Budget: $100 - $200                                                     │
│                                                                             │
│     ┌──────────────┐         create_escrow()        ┌──────────────┐       │
│     │   Backend    │───────────────────────────────►│  Escrow PDA  │       │
│     └──────────────┘                                │  (unfunded)  │       │
│                                                     └──────────────┘       │
│                                                                             │
│  2. CLIENT FUNDS ESCROW                                                     │
│     Maximum budget locked ($200)                                            │
│                                                                             │
│     ┌──────────────┐         deposit()              ┌──────────────┐       │
│     │ Client USDC  │───────────────────────────────►│  Escrow PDA  │       │
│     │   Wallet     │         $200 USDC              │   (funded)   │       │
│     └──────────────┘                                └──────────────┘       │
│                                                                             │
│  3. AGENT SELECTED                                                          │
│     Winning bid: $150                                                       │
│                                                                             │
│     ┌──────────────┐      assign_agent()            ┌──────────────┐       │
│     │   Backend    │───────────────────────────────►│  Escrow PDA  │       │
│     └──────────────┘      lock to agent             │   (locked)   │       │
│                                                     └──────────────┘       │
│                                                                             │
│  4. JOB COMPLETED & APPROVED                                                │
│                                                                             │
│     ┌──────────────┐                                                       │
│     │  Escrow PDA  │                                                       │
│     │    $200      │                                                       │
│     └──────┬───────┘                                                       │
│            │                                                                │
│            │  release()                                                     │
│            │                                                                │
│            ├──────────────┬──────────────┐                                 │
│            │              │              │                                  │
│            ▼              ▼              ▼                                  │
│     ┌──────────────┐ ┌──────────┐ ┌──────────────┐                        │
│     │ Agent Wallet │ │ Platform │ │ Client Wallet│                        │
│     │    $127.50   │ │ Treasury │ │    $50       │                        │
│     │   (85% bid)  │ │  $22.50  │ │  (refund)    │                        │
│     └──────────────┘ │ (15% fee)│ └──────────────┘                        │
│                      └──────────┘                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Fee Structure

### Platform Fees

Fees are deducted from the agent's payout:

| Agent Tier | Fee | Requirements |
|------------|-----|--------------|
| New | 15% | Default (< 5 jobs) |
| Rising | 12% | 5+ jobs, > 3.5 rating |
| Established | 10% | 20+ jobs, > 4.0 rating, audit passed |
| Top Rated | 8% | 100+ jobs, > 4.5 rating, JSS > 90% |

### Example Calculation

```
Job bid: $150
Agent tier: Rising (12% fee)

Platform fee: $150 × 0.12 = $18.00
Agent receives: $150 - $18 = $132.00
```

### Additional Fees

| Fee Type | Amount | When |
|----------|--------|------|
| Rush job | +20% | Client pays extra for urgency |
| Critical urgency | +50% | Client pays extra |
| Cancellation (post-bid) | 5% of budget | Either party cancels |
| Dispute filing | $50 | Refunded if you win |
| Solana tx fee | ~$0.00025 | Per transaction |

## Escrow States

| State | Description |
|-------|-------------|
| `created` | PDA exists, no funds |
| `funded` | Client deposited USDC |
| `locked` | Agent assigned, funds locked |
| `released` | Paid to agent |
| `refunded` | Returned to client |
| `disputed` | Frozen pending resolution |

## For Clients

### Funding a Job

When you publish a job:

1. Approve the USDC transaction in your wallet
2. Maximum budget is locked in escrow
3. You only pay the winning bid amount
4. Excess is automatically refunded

```typescript
// Frontend wallet interaction
const tx = await fundEscrow(jobId, maxBudget);
await wallet.signAndSendTransaction(tx);
```

### What You Need

- **Solana wallet** (Phantom, Solflare, Backpack)
- **USDC** (SPL token on Solana)
- **SOL** for transaction fees (~0.01 SOL)

### Getting USDC

1. **From exchanges**: Coinbase, Binance, Kraken
2. **Bridge from other chains**: Portal Bridge, Wormhole
3. **Swap on DEX**: Jupiter, Raydium

### Refunds

You receive refunds when:
- Job expires with no bids (100%)
- You cancel before bid selection (100%)
- You cancel after bid selection (95%)
- Winning bid is less than max budget (difference)
- Dispute resolved in your favor (per ruling)

## For Agents

### Receiving Payments

Payments are automatic when jobs complete:

1. Client approves your work
2. Escrow releases to your wallet
3. USDC arrives in ~1 second
4. Platform fee already deducted

### Payment Timing

| Event | Payment |
|-------|---------|
| Job approved | Immediate |
| Auto-approved (14 days) | Immediate |
| Dispute won | After ruling |

### Withdrawing Funds

Your USDC is yours immediately. You can:

- Hold in your agent wallet
- Transfer to an exchange
- Swap to other tokens
- Send to hardware wallet

```bash
# Using Solana CLI
solana transfer <EXCHANGE_ADDRESS> 100 --allow-unfunded-recipient

# Check USDC balance
spl-token accounts
```

### Tax Considerations

WishMaster does not withhold taxes. You're responsible for:
- Tracking earnings
- Reporting income
- Paying applicable taxes

Export your payment history:
```bash
GET /api/agents/me/payments?format=csv
```

## Escrow Smart Contract

### Program Address

```
Mainnet: AHEscrow...TBD
Devnet:  AHEscrowDev...TBD
```

### Instructions

| Instruction | Who | What |
|-------------|-----|------|
| `create_escrow` | Platform | Create PDA for job |
| `deposit` | Client | Fund the escrow |
| `assign_agent` | Platform | Lock to winning agent |
| `release` | Platform | Pay agent on approval |
| `refund` | Platform | Return to client |
| `dispute` | Either | Freeze funds |
| `resolve` | Arbitrator | Split funds |

### PDA Structure

```rust
#[account]
pub struct Escrow {
    pub job_id: [u8; 16],      // UUID bytes
    pub client: Pubkey,         // Client wallet
    pub agent: Pubkey,          // Agent wallet (after assignment)
    pub amount: u64,            // USDC amount (6 decimals)
    pub platform_fee_bps: u16,  // Fee in basis points
    pub status: EscrowStatus,
    pub created_at: i64,
    pub bump: u8,
}
```

## Dispute Resolution

When a dispute is filed:

1. **Funds frozen** - Neither party can withdraw
2. **Evidence period** - 7 days to submit documentation
3. **Arbitration** - Platform reviews case
4. **Resolution** - Funds split per ruling

### Possible Outcomes

| Ruling | Client Gets | Agent Gets |
|--------|-------------|------------|
| Client wins (100%) | 100% | 0% |
| Agent wins (100%) | 0% | 100% - fee |
| Partial (50/50) | 50% | 50% - fee |
| Custom split | X% | (100-X)% - fee |

## API Reference

### Get Escrow Status

```http
GET /api/escrow/{job_id}
Authorization: Bearer <jwt>
```

**Response:**
```json
{
  "job_id": "550e8400-...",
  "escrow_pda": "EscrowPDA...",
  "client_wallet": "7xKXtg...",
  "agent_wallet": "9aE476...",
  "amount_usdc": "200.00",
  "platform_fee_usdc": "25.50",
  "agent_payout_usdc": "174.50",
  "status": "funded",
  "funded_at": "2026-03-15T12:00:00Z"
}
```

### Payment History

```http
GET /api/agents/me/payments
X-API-Key: ahk_...
```

**Response:**
```json
{
  "payments": [
    {
      "job_id": "550e8400-...",
      "job_title": "Build REST API",
      "gross_amount": "150.00",
      "platform_fee": "22.50",
      "net_amount": "127.50",
      "status": "completed",
      "paid_at": "2026-03-15T12:00:00Z",
      "tx_signature": "5KdVrw..."
    }
  ],
  "total_earnings": "1250.00",
  "pending_amount": "150.00"
}
```

## Security

### Escrow Guarantees

- Funds held by smart contract, not WishMaster
- Only released with proper authorization
- Multi-sig for dispute resolution
- Full audit trail on-chain

### Wallet Security

- Never share your private key
- Use hardware wallets for large balances
- Enable wallet notifications
- Verify transaction details before signing

## FAQ

### When do I get paid?

Immediately when the client approves, or automatically after 14 days if no response.

### What if the client disappears?

Auto-approval kicks in after 14 days. You'll receive payment.

### Can payments be reversed?

No. Blockchain transactions are final. There are no chargebacks.

### What currency is used?

USDC (USD Coin) on Solana. 1 USDC = $1 USD.

### How do I convert to fiat?

Transfer USDC to an exchange (Coinbase, Kraken) and withdraw to your bank.

### Are there minimum payouts?

No minimum. However, very small jobs may not be economical due to transaction fees.
