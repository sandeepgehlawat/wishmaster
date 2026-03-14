use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("11111111111111111111111111111111"); // Replace with actual program ID

#[program]
pub mod agenthive_escrow {
    use super::*;

    /// Create a new escrow for a job
    pub fn create_escrow(
        ctx: Context<CreateEscrow>,
        job_id: [u8; 32],
        amount: u64,
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;

        escrow.client = ctx.accounts.client.key();
        escrow.job_id = job_id;
        escrow.amount = amount;
        escrow.agent = None;
        escrow.status = EscrowStatus::Created;
        escrow.created_at = Clock::get()?.unix_timestamp;
        escrow.bump = ctx.bumps.escrow;

        emit!(EscrowCreated {
            job_id,
            client: escrow.client,
            amount,
        });

        Ok(())
    }

    /// Deposit USDC into escrow
    pub fn deposit(ctx: Context<Deposit>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;

        require!(
            escrow.status == EscrowStatus::Created,
            EscrowError::InvalidStatus
        );

        // Transfer USDC from client to escrow vault
        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.client_token_account.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.client.to_account_info(),
            },
        );

        token::transfer(transfer_ctx, escrow.amount)?;

        escrow.status = EscrowStatus::Funded;
        escrow.funded_at = Some(Clock::get()?.unix_timestamp);

        emit!(EscrowFunded {
            job_id: escrow.job_id,
            amount: escrow.amount,
        });

        Ok(())
    }

    /// Assign agent to escrow (locks funds)
    pub fn assign_agent(ctx: Context<AssignAgent>, agent: Pubkey) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;

        require!(
            escrow.status == EscrowStatus::Funded,
            EscrowError::InvalidStatus
        );
        require!(
            ctx.accounts.authority.key() == escrow.client,
            EscrowError::Unauthorized
        );

        escrow.agent = Some(agent);
        escrow.status = EscrowStatus::Locked;

        emit!(AgentAssigned {
            job_id: escrow.job_id,
            agent,
        });

        Ok(())
    }

    /// Release funds to agent (on job completion)
    pub fn release(ctx: Context<Release>, platform_fee_bps: u16) -> Result<()> {
        let escrow = &ctx.accounts.escrow;

        require!(
            escrow.status == EscrowStatus::Locked,
            EscrowError::InvalidStatus
        );
        require!(
            ctx.accounts.authority.key() == escrow.client,
            EscrowError::Unauthorized
        );
        require!(platform_fee_bps <= 2000, EscrowError::FeeTooHigh); // Max 20%

        let agent = escrow.agent.ok_or(EscrowError::NoAgentAssigned)?;
        require!(
            ctx.accounts.agent_token_account.owner == agent,
            EscrowError::InvalidAgent
        );

        // Calculate amounts
        let platform_fee = (escrow.amount as u128)
            .checked_mul(platform_fee_bps as u128)
            .unwrap()
            .checked_div(10000)
            .unwrap() as u64;

        let agent_amount = escrow.amount.checked_sub(platform_fee).unwrap();

        // Transfer to agent
        let seeds = &[
            b"escrow",
            escrow.job_id.as_ref(),
            &[escrow.bump],
        ];
        let signer = &[&seeds[..]];

        let transfer_to_agent = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.agent_token_account.to_account_info(),
                authority: ctx.accounts.escrow.to_account_info(),
            },
            signer,
        );
        token::transfer(transfer_to_agent, agent_amount)?;

        // Transfer fee to platform
        if platform_fee > 0 {
            let transfer_to_platform = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.platform_token_account.to_account_info(),
                    authority: ctx.accounts.escrow.to_account_info(),
                },
                signer,
            );
            token::transfer(transfer_to_platform, platform_fee)?;
        }

        emit!(EscrowReleased {
            job_id: escrow.job_id,
            agent,
            agent_amount,
            platform_fee,
        });

        Ok(())
    }

    /// Refund funds to client (on cancellation)
    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        let escrow = &ctx.accounts.escrow;

        require!(
            escrow.status == EscrowStatus::Funded,
            EscrowError::InvalidStatus
        );
        require!(
            ctx.accounts.authority.key() == escrow.client,
            EscrowError::Unauthorized
        );

        let seeds = &[
            b"escrow",
            escrow.job_id.as_ref(),
            &[escrow.bump],
        ];
        let signer = &[&seeds[..]];

        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.client_token_account.to_account_info(),
                authority: ctx.accounts.escrow.to_account_info(),
            },
            signer,
        );

        token::transfer(transfer_ctx, escrow.amount)?;

        emit!(EscrowRefunded {
            job_id: escrow.job_id,
            amount: escrow.amount,
        });

        Ok(())
    }

    /// File a dispute (freezes funds)
    pub fn dispute(ctx: Context<Dispute>, reason: String) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;

        require!(
            escrow.status == EscrowStatus::Locked,
            EscrowError::InvalidStatus
        );

        // Either client or agent can dispute
        let is_client = ctx.accounts.authority.key() == escrow.client;
        let is_agent = escrow.agent.map(|a| a == ctx.accounts.authority.key()).unwrap_or(false);
        require!(is_client || is_agent, EscrowError::Unauthorized);

        escrow.status = EscrowStatus::Disputed;

        emit!(DisputeFiled {
            job_id: escrow.job_id,
            filed_by: ctx.accounts.authority.key(),
            reason,
        });

        Ok(())
    }

    /// Resolve dispute (arbitrator only)
    pub fn resolve(ctx: Context<Resolve>, agent_share_bps: u16) -> Result<()> {
        let escrow = &ctx.accounts.escrow;

        require!(
            escrow.status == EscrowStatus::Disputed,
            EscrowError::InvalidStatus
        );
        require!(agent_share_bps <= 10000, EscrowError::InvalidShare);

        let agent = escrow.agent.ok_or(EscrowError::NoAgentAssigned)?;

        // Calculate split
        let agent_amount = (escrow.amount as u128)
            .checked_mul(agent_share_bps as u128)
            .unwrap()
            .checked_div(10000)
            .unwrap() as u64;

        let client_amount = escrow.amount.checked_sub(agent_amount).unwrap();

        let seeds = &[
            b"escrow",
            escrow.job_id.as_ref(),
            &[escrow.bump],
        ];
        let signer = &[&seeds[..]];

        // Transfer to agent
        if agent_amount > 0 {
            let transfer_to_agent = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.agent_token_account.to_account_info(),
                    authority: ctx.accounts.escrow.to_account_info(),
                },
                signer,
            );
            token::transfer(transfer_to_agent, agent_amount)?;
        }

        // Transfer to client
        if client_amount > 0 {
            let transfer_to_client = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.client_token_account.to_account_info(),
                    authority: ctx.accounts.escrow.to_account_info(),
                },
                signer,
            );
            token::transfer(transfer_to_client, client_amount)?;
        }

        emit!(DisputeResolved {
            job_id: escrow.job_id,
            agent_amount,
            client_amount,
        });

        Ok(())
    }
}

// ============================================================================
// Accounts
// ============================================================================

#[derive(Accounts)]
#[instruction(job_id: [u8; 32])]
pub struct CreateEscrow<'info> {
    #[account(mut)]
    pub client: Signer<'info>,

    #[account(
        init,
        payer = client,
        space = 8 + Escrow::INIT_SPACE,
        seeds = [b"escrow", job_id.as_ref()],
        bump
    )]
    pub escrow: Account<'info, Escrow>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub client: Signer<'info>,

    #[account(
        mut,
        constraint = escrow.client == client.key()
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(
        mut,
        constraint = client_token_account.owner == client.key()
    )]
    pub client_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct AssignAgent<'info> {
    pub authority: Signer<'info>,

    #[account(mut)]
    pub escrow: Account<'info, Escrow>,
}

#[derive(Accounts)]
pub struct Release<'info> {
    pub authority: Signer<'info>,

    #[account(mut)]
    pub escrow: Account<'info, Escrow>,

    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub agent_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub platform_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Refund<'info> {
    pub authority: Signer<'info>,

    #[account(mut)]
    pub escrow: Account<'info, Escrow>,

    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub client_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Dispute<'info> {
    pub authority: Signer<'info>,

    #[account(mut)]
    pub escrow: Account<'info, Escrow>,
}

#[derive(Accounts)]
pub struct Resolve<'info> {
    /// Arbitrator authority (platform-controlled)
    pub arbitrator: Signer<'info>,

    #[account(mut)]
    pub escrow: Account<'info, Escrow>,

    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub agent_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub client_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

// ============================================================================
// State
// ============================================================================

#[account]
#[derive(InitSpace)]
pub struct Escrow {
    pub client: Pubkey,
    pub job_id: [u8; 32],
    pub amount: u64,
    pub agent: Option<Pubkey>,
    pub status: EscrowStatus,
    pub created_at: i64,
    pub funded_at: Option<i64>,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum EscrowStatus {
    Created,
    Funded,
    Locked,
    Released,
    Refunded,
    Disputed,
}

// ============================================================================
// Events
// ============================================================================

#[event]
pub struct EscrowCreated {
    pub job_id: [u8; 32],
    pub client: Pubkey,
    pub amount: u64,
}

#[event]
pub struct EscrowFunded {
    pub job_id: [u8; 32],
    pub amount: u64,
}

#[event]
pub struct AgentAssigned {
    pub job_id: [u8; 32],
    pub agent: Pubkey,
}

#[event]
pub struct EscrowReleased {
    pub job_id: [u8; 32],
    pub agent: Pubkey,
    pub agent_amount: u64,
    pub platform_fee: u64,
}

#[event]
pub struct EscrowRefunded {
    pub job_id: [u8; 32],
    pub amount: u64,
}

#[event]
pub struct DisputeFiled {
    pub job_id: [u8; 32],
    pub filed_by: Pubkey,
    pub reason: String,
}

#[event]
pub struct DisputeResolved {
    pub job_id: [u8; 32],
    pub agent_amount: u64,
    pub client_amount: u64,
}

// ============================================================================
// Errors
// ============================================================================

#[error_code]
pub enum EscrowError {
    #[msg("Invalid escrow status for this operation")]
    InvalidStatus,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Platform fee too high")]
    FeeTooHigh,
    #[msg("No agent assigned")]
    NoAgentAssigned,
    #[msg("Invalid agent")]
    InvalidAgent,
    #[msg("Invalid share percentage")]
    InvalidShare,
}
