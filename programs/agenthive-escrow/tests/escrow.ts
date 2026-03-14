import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AgenthiveEscrow } from "../target/types/agenthive_escrow";
import {
  createMint,
  createAccount,
  mintTo,
  getAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { assert, expect } from "chai";

describe("agenthive-escrow", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.AgenthiveEscrow as Program<AgenthiveEscrow>;

  // Test accounts
  let client: anchor.web3.Keypair;
  let agent: anchor.web3.Keypair;
  let platform: anchor.web3.Keypair;
  let arbitrator: anchor.web3.Keypair;
  let mint: anchor.web3.PublicKey;
  let clientTokenAccount: anchor.web3.PublicKey;
  let agentTokenAccount: anchor.web3.PublicKey;
  let platformTokenAccount: anchor.web3.PublicKey;
  let vault: anchor.web3.PublicKey;

  // Test job ID (32 bytes)
  const jobId = Buffer.alloc(32);
  jobId.write("job_12345678901234567890123456", "utf8");

  // Escrow PDA
  let escrowPda: anchor.web3.PublicKey;
  let escrowBump: number;

  const ESCROW_AMOUNT = 1_000_000_000; // 1000 USDC (6 decimals)
  const PLATFORM_FEE_BPS = 1500; // 15%

  before(async () => {
    // Generate keypairs
    client = anchor.web3.Keypair.generate();
    agent = anchor.web3.Keypair.generate();
    platform = anchor.web3.Keypair.generate();
    arbitrator = anchor.web3.Keypair.generate();

    // Airdrop SOL to test accounts
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        client.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      )
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        agent.publicKey,
        1 * anchor.web3.LAMPORTS_PER_SOL
      )
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        platform.publicKey,
        1 * anchor.web3.LAMPORTS_PER_SOL
      )
    );

    // Create USDC-like mint
    mint = await createMint(
      provider.connection,
      client,
      client.publicKey,
      null,
      6 // 6 decimals like USDC
    );

    // Create token accounts
    clientTokenAccount = await createAccount(
      provider.connection,
      client,
      mint,
      client.publicKey
    );

    agentTokenAccount = await createAccount(
      provider.connection,
      agent,
      mint,
      agent.publicKey
    );

    platformTokenAccount = await createAccount(
      provider.connection,
      platform,
      mint,
      platform.publicKey
    );

    // Mint tokens to client
    await mintTo(
      provider.connection,
      client,
      mint,
      clientTokenAccount,
      client,
      ESCROW_AMOUNT * 10 // Mint plenty for tests
    );

    // Derive escrow PDA
    [escrowPda, escrowBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), jobId],
      program.programId
    );

    // Create vault token account (owned by escrow PDA)
    vault = await createAccount(
      provider.connection,
      client,
      mint,
      escrowPda,
      undefined,
      TOKEN_PROGRAM_ID
    );
  });

  describe("create_escrow", () => {
    it("creates a new escrow", async () => {
      const tx = await program.methods
        .createEscrow(Array.from(jobId), new anchor.BN(ESCROW_AMOUNT))
        .accounts({
          client: client.publicKey,
          escrow: escrowPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([client])
        .rpc();

      console.log("Create escrow tx:", tx);

      // Verify escrow state
      const escrow = await program.account.escrow.fetch(escrowPda);
      assert.equal(escrow.client.toBase58(), client.publicKey.toBase58());
      assert.equal(escrow.amount.toNumber(), ESCROW_AMOUNT);
      assert.deepEqual(escrow.status, { created: {} });
      assert.isNull(escrow.agent);
    });
  });

  describe("deposit", () => {
    it("deposits USDC into escrow", async () => {
      const clientBalanceBefore = await getAccount(
        provider.connection,
        clientTokenAccount
      );

      const tx = await program.methods
        .deposit()
        .accounts({
          client: client.publicKey,
          escrow: escrowPda,
          clientTokenAccount,
          vault,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([client])
        .rpc();

      console.log("Deposit tx:", tx);

      // Verify balances
      const clientBalanceAfter = await getAccount(
        provider.connection,
        clientTokenAccount
      );
      const vaultBalance = await getAccount(provider.connection, vault);

      assert.equal(
        vaultBalance.amount.toString(),
        ESCROW_AMOUNT.toString()
      );
      assert.equal(
        (BigInt(clientBalanceBefore.amount.toString()) - BigInt(ESCROW_AMOUNT)).toString(),
        clientBalanceAfter.amount.toString()
      );

      // Verify escrow status
      const escrow = await program.account.escrow.fetch(escrowPda);
      assert.deepEqual(escrow.status, { funded: {} });
      assert.isNotNull(escrow.fundedAt);
    });

    it("fails if not client", async () => {
      // Create another escrow for this test
      const jobId2 = Buffer.alloc(32);
      jobId2.write("job_999999999999999999999999999", "utf8");

      const [escrowPda2] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), jobId2],
        program.programId
      );

      await program.methods
        .createEscrow(Array.from(jobId2), new anchor.BN(100))
        .accounts({
          client: client.publicKey,
          escrow: escrowPda2,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([client])
        .rpc();

      // Try to deposit as agent (should fail)
      try {
        await program.methods
          .deposit()
          .accounts({
            client: agent.publicKey, // Wrong signer
            escrow: escrowPda2,
            clientTokenAccount: agentTokenAccount,
            vault,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([agent])
          .rpc();

        assert.fail("Should have thrown");
      } catch (err) {
        expect(err.message).to.include("constraint");
      }
    });
  });

  describe("assign_agent", () => {
    it("assigns agent to escrow", async () => {
      const tx = await program.methods
        .assignAgent(agent.publicKey)
        .accounts({
          authority: client.publicKey,
          escrow: escrowPda,
        })
        .signers([client])
        .rpc();

      console.log("Assign agent tx:", tx);

      // Verify escrow state
      const escrow = await program.account.escrow.fetch(escrowPda);
      assert.equal(escrow.agent.toBase58(), agent.publicKey.toBase58());
      assert.deepEqual(escrow.status, { locked: {} });
    });

    it("fails if not funded", async () => {
      // Create unfunded escrow
      const jobId3 = Buffer.alloc(32);
      jobId3.write("job_unfunded_test_0000000000000", "utf8");

      const [escrowPda3] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), jobId3],
        program.programId
      );

      await program.methods
        .createEscrow(Array.from(jobId3), new anchor.BN(100))
        .accounts({
          client: client.publicKey,
          escrow: escrowPda3,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([client])
        .rpc();

      try {
        await program.methods
          .assignAgent(agent.publicKey)
          .accounts({
            authority: client.publicKey,
            escrow: escrowPda3,
          })
          .signers([client])
          .rpc();

        assert.fail("Should have thrown");
      } catch (err) {
        expect(err.message).to.include("InvalidStatus");
      }
    });
  });

  describe("release", () => {
    it("releases funds to agent with platform fee", async () => {
      const agentBalanceBefore = await getAccount(
        provider.connection,
        agentTokenAccount
      );
      const platformBalanceBefore = await getAccount(
        provider.connection,
        platformTokenAccount
      );

      const tx = await program.methods
        .release(PLATFORM_FEE_BPS)
        .accounts({
          authority: client.publicKey,
          escrow: escrowPda,
          vault,
          agentTokenAccount,
          platformTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([client])
        .rpc();

      console.log("Release tx:", tx);

      // Calculate expected amounts
      const platformFee = Math.floor(
        (ESCROW_AMOUNT * PLATFORM_FEE_BPS) / 10000
      );
      const agentAmount = ESCROW_AMOUNT - platformFee;

      // Verify balances
      const agentBalanceAfter = await getAccount(
        provider.connection,
        agentTokenAccount
      );
      const platformBalanceAfter = await getAccount(
        provider.connection,
        platformTokenAccount
      );
      const vaultBalanceAfter = await getAccount(provider.connection, vault);

      assert.equal(vaultBalanceAfter.amount.toString(), "0");
      assert.equal(
        (BigInt(agentBalanceBefore.amount.toString()) + BigInt(agentAmount)).toString(),
        agentBalanceAfter.amount.toString()
      );
      assert.equal(
        (BigInt(platformBalanceBefore.amount.toString()) + BigInt(platformFee)).toString(),
        platformBalanceAfter.amount.toString()
      );

      console.log(`Agent received: ${agentAmount / 1e6} USDC`);
      console.log(`Platform fee: ${platformFee / 1e6} USDC`);
    });
  });

  describe("refund", () => {
    it("refunds funds to client", async () => {
      // Create and fund a new escrow
      const jobId4 = Buffer.alloc(32);
      jobId4.write("job_refund_test_00000000000000", "utf8");

      const [escrowPda4, bump4] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), jobId4],
        program.programId
      );

      const vault4 = await createAccount(
        provider.connection,
        client,
        mint,
        escrowPda4,
        undefined,
        TOKEN_PROGRAM_ID
      );

      const refundAmount = 500_000_000; // 500 USDC

      await program.methods
        .createEscrow(Array.from(jobId4), new anchor.BN(refundAmount))
        .accounts({
          client: client.publicKey,
          escrow: escrowPda4,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([client])
        .rpc();

      await program.methods
        .deposit()
        .accounts({
          client: client.publicKey,
          escrow: escrowPda4,
          clientTokenAccount,
          vault: vault4,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([client])
        .rpc();

      // Now refund
      const clientBalanceBefore = await getAccount(
        provider.connection,
        clientTokenAccount
      );

      const tx = await program.methods
        .refund()
        .accounts({
          authority: client.publicKey,
          escrow: escrowPda4,
          vault: vault4,
          clientTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([client])
        .rpc();

      console.log("Refund tx:", tx);

      // Verify refund
      const clientBalanceAfter = await getAccount(
        provider.connection,
        clientTokenAccount
      );

      assert.equal(
        (BigInt(clientBalanceBefore.amount.toString()) + BigInt(refundAmount)).toString(),
        clientBalanceAfter.amount.toString()
      );
    });
  });

  describe("dispute", () => {
    it("allows client to file dispute", async () => {
      // Create, fund, and assign new escrow
      const jobId5 = Buffer.alloc(32);
      jobId5.write("job_dispute_test_000000000000", "utf8");

      const [escrowPda5] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), jobId5],
        program.programId
      );

      const vault5 = await createAccount(
        provider.connection,
        client,
        mint,
        escrowPda5,
        undefined,
        TOKEN_PROGRAM_ID
      );

      await program.methods
        .createEscrow(Array.from(jobId5), new anchor.BN(100_000_000))
        .accounts({
          client: client.publicKey,
          escrow: escrowPda5,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([client])
        .rpc();

      await program.methods
        .deposit()
        .accounts({
          client: client.publicKey,
          escrow: escrowPda5,
          clientTokenAccount,
          vault: vault5,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([client])
        .rpc();

      await program.methods
        .assignAgent(agent.publicKey)
        .accounts({
          authority: client.publicKey,
          escrow: escrowPda5,
        })
        .signers([client])
        .rpc();

      // File dispute
      const tx = await program.methods
        .dispute("Work not delivered as promised")
        .accounts({
          authority: client.publicKey,
          escrow: escrowPda5,
        })
        .signers([client])
        .rpc();

      console.log("Dispute tx:", tx);

      // Verify status
      const escrow = await program.account.escrow.fetch(escrowPda5);
      assert.deepEqual(escrow.status, { disputed: {} });
    });
  });

  describe("resolve", () => {
    it("arbitrator resolves dispute with 50/50 split", async () => {
      // Create disputed escrow
      const jobId6 = Buffer.alloc(32);
      jobId6.write("job_resolve_test_00000000000", "utf8");

      const [escrowPda6] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), jobId6],
        program.programId
      );

      const vault6 = await createAccount(
        provider.connection,
        client,
        mint,
        escrowPda6,
        undefined,
        TOKEN_PROGRAM_ID
      );

      const disputeAmount = 200_000_000; // 200 USDC

      await program.methods
        .createEscrow(Array.from(jobId6), new anchor.BN(disputeAmount))
        .accounts({
          client: client.publicKey,
          escrow: escrowPda6,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([client])
        .rpc();

      await program.methods
        .deposit()
        .accounts({
          client: client.publicKey,
          escrow: escrowPda6,
          clientTokenAccount,
          vault: vault6,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([client])
        .rpc();

      await program.methods
        .assignAgent(agent.publicKey)
        .accounts({
          authority: client.publicKey,
          escrow: escrowPda6,
        })
        .signers([client])
        .rpc();

      await program.methods
        .dispute("Dispute for resolution test")
        .accounts({
          authority: client.publicKey,
          escrow: escrowPda6,
        })
        .signers([client])
        .rpc();

      // Record balances before resolution
      const agentBalanceBefore = await getAccount(
        provider.connection,
        agentTokenAccount
      );
      const clientBalanceBefore = await getAccount(
        provider.connection,
        clientTokenAccount
      );

      // Resolve with 50% to agent
      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(
          arbitrator.publicKey,
          1 * anchor.web3.LAMPORTS_PER_SOL
        )
      );

      const tx = await program.methods
        .resolve(5000) // 50% to agent
        .accounts({
          arbitrator: arbitrator.publicKey,
          escrow: escrowPda6,
          vault: vault6,
          agentTokenAccount,
          clientTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([arbitrator])
        .rpc();

      console.log("Resolve tx:", tx);

      // Verify split
      const expectedAgentAmount = disputeAmount / 2;
      const expectedClientAmount = disputeAmount / 2;

      const agentBalanceAfter = await getAccount(
        provider.connection,
        agentTokenAccount
      );
      const clientBalanceAfter = await getAccount(
        provider.connection,
        clientTokenAccount
      );

      assert.equal(
        (BigInt(agentBalanceBefore.amount.toString()) + BigInt(expectedAgentAmount)).toString(),
        agentBalanceAfter.amount.toString()
      );
      assert.equal(
        (BigInt(clientBalanceBefore.amount.toString()) + BigInt(expectedClientAmount)).toString(),
        clientBalanceAfter.amount.toString()
      );

      console.log(`Agent received: ${expectedAgentAmount / 1e6} USDC`);
      console.log(`Client received: ${expectedClientAmount / 1e6} USDC`);
    });
  });
});
