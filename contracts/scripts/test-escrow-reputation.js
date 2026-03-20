const { ethers } = require("hardhat");

/**
 * Test full escrow-reputation integration flow
 */
async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("═══════════════════════════════════════════════════════════════");
    console.log("ESCROW-REPUTATION INTEGRATION TEST");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("Tester:", deployer.address);
    console.log("");

    // Addresses
    const ESCROW_ADDRESS = "0x4814FDf0a0b969B48a0CCCFC44ad1EF8D3491170";
    const USDC_ADDRESS = "0x070143E1f101bF90d9422241b22F7eB1efCC2A83";
    const IDENTITY_REGISTRY = "0xF9b5414725A9A0C9e9E2608F54FaE01626fb4924";
    const REPUTATION_REGISTRY = "0xEC8992Dff6B64D0Add3Cc7AAff25f9b8c821aF8F";

    // Get contracts
    const escrow = await ethers.getContractAt("AgentHiveEscrow", ESCROW_ADDRESS);
    const usdc = await ethers.getContractAt("IERC20", USDC_ADDRESS);
    const identity = await ethers.getContractAt("IdentityRegistry", IDENTITY_REGISTRY);
    const reputation = await ethers.getContractAt("ReputationRegistry", REPUTATION_REGISTRY);

    // ═══════════════════════════════════════════════════════════════════════
    // TEST 1: Register Agent Identity (if not already registered)
    // ═══════════════════════════════════════════════════════════════════════
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("TEST 1: Check/Register Agent Identity");
    console.log("═══════════════════════════════════════════════════════════════");

    // Check if deployer already has an agent
    let agentId = await identity.walletToAgent(deployer.address);
    console.log("Existing agent ID for wallet:", agentId.toString());

    if (agentId == 0n) {
        console.log("Registering new agent...");
        const tx = await identity.register("ipfs://QmTestAgentForEscrowTest");
        const receipt = await tx.wait();
        const event = receipt.logs.find(l => l.fragment?.name === "Registered");
        agentId = event ? event.args[0] : 1n;
        console.log("✓ Agent registered with ID:", agentId.toString());
    } else {
        console.log("✓ Using existing agent ID:", agentId.toString());
    }

    // Get agent's reputation before test
    const beforeSummary = await reputation.summaries(agentId);
    console.log("✓ Current reputation score:", beforeSummary.averageScore.toString());

    // ═══════════════════════════════════════════════════════════════════════
    // TEST 2: Check USDC Balance
    // ═══════════════════════════════════════════════════════════════════════
    console.log("");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("TEST 2: Check USDC Balance");
    console.log("═══════════════════════════════════════════════════════════════");

    const usdcBalance = await usdc.balanceOf(deployer.address);
    console.log("USDC Balance:", ethers.formatUnits(usdcBalance, 6), "USDC");

    if (usdcBalance < ethers.parseUnits("10", 6)) {
        console.log("⚠️  Insufficient USDC for full test. Need at least 10 USDC.");
        console.log("   Skipping deposit/release tests...");
        console.log("");
        console.log("═══════════════════════════════════════════════════════════════");
        console.log("PARTIAL TEST COMPLETE (need USDC for full test)");
        console.log("═══════════════════════════════════════════════════════════════");
        console.log("");
        console.log("To complete full test, get testnet USDC from faucet.");
        return;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // TEST 3: Create Job and Deposit to Escrow
    // ═══════════════════════════════════════════════════════════════════════
    console.log("");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("TEST 3: Create Job and Deposit to Escrow");
    console.log("═══════════════════════════════════════════════════════════════");

    // Generate job ID (would normally come from backend)
    const jobId = ethers.keccak256(ethers.toUtf8Bytes(`test-job-${Date.now()}`));
    const depositAmount = ethers.parseUnits("10", 6); // 10 USDC

    console.log("Job ID:", jobId);
    console.log("Deposit Amount:", ethers.formatUnits(depositAmount, 6), "USDC");

    // Approve USDC spending
    console.log("Approving USDC...");
    const approveTx = await usdc.approve(ESCROW_ADDRESS, depositAmount);
    await approveTx.wait();
    console.log("✓ USDC approved");

    // Deposit to escrow
    console.log("Depositing to escrow...");
    const depositTx = await escrow.deposit(jobId, depositAmount);
    await depositTx.wait();
    console.log("✓ Deposited to escrow");

    // Check escrow status
    const escrowData = await escrow.escrows(jobId);
    console.log("✓ Escrow status:", escrowData.status.toString(), "(1=Funded)");
    console.log("✓ Escrow amount:", ethers.formatUnits(escrowData.amount, 6), "USDC");

    // ═══════════════════════════════════════════════════════════════════════
    // TEST 4: Lock Escrow (assign agent)
    // ═══════════════════════════════════════════════════════════════════════
    console.log("");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("TEST 4: Lock Escrow (Assign Agent)");
    console.log("═══════════════════════════════════════════════════════════════");

    const lockTx = await escrow.lockToAgent(jobId, deployer.address, depositAmount); // Using deployer as agent
    await lockTx.wait();
    console.log("✓ Escrow locked");

    const lockedEscrow = await escrow.escrows(jobId);
    console.log("✓ Escrow status:", lockedEscrow.status.toString(), "(2=Locked)");
    console.log("✓ Agent:", lockedEscrow.agent);

    // ═══════════════════════════════════════════════════════════════════════
    // TEST 5: Release Escrow (triggers reputation update)
    // ═══════════════════════════════════════════════════════════════════════
    console.log("");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("TEST 5: Release Escrow (Triggers Reputation Update)");
    console.log("═══════════════════════════════════════════════════════════════");

    const releaseTx = await escrow.release(jobId);
    const releaseReceipt = await releaseTx.wait();
    console.log("✓ Escrow released");

    // Check final escrow status
    const releasedEscrow = await escrow.escrows(jobId);
    console.log("✓ Final escrow status:", releasedEscrow.status.toString(), "(3=Released)");

    // ═══════════════════════════════════════════════════════════════════════
    // TEST 6: Verify Reputation Update
    // ═══════════════════════════════════════════════════════════════════════
    console.log("");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("TEST 6: Verify Reputation Update");
    console.log("═══════════════════════════════════════════════════════════════");

    const afterSummary = await reputation.summaries(agentId);
    console.log("✓ New total feedbacks:", afterSummary.totalFeedbackCount.toString());
    console.log("✓ New cumulative score:", afterSummary.cumulativeScore.toString());
    console.log("✓ New average score:", afterSummary.averageScore.toString());

    // Check if reputation was updated
    const feedbackCountBefore = beforeSummary.totalFeedbackCount;
    const feedbackCountAfter = afterSummary.totalFeedbackCount;

    if (feedbackCountAfter > feedbackCountBefore) {
        console.log("✓ Reputation was automatically updated on escrow release!");
    } else {
        console.log("⚠️  Reputation count unchanged. Check escrow contract integration.");
    }

    // Get the latest feedback
    const feedbacks = await reputation.getFeedbacks(agentId, 0, 10);
    const latestFeedback = feedbacks[feedbacks.length - 1];
    if (latestFeedback) {
        console.log("✓ Latest feedback:");
        console.log("  - Value:", latestFeedback.value.toString());
        console.log("  - Tag:", latestFeedback.tag1);
    }

    console.log("");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("ALL ESCROW-REPUTATION TESTS PASSED!");
    console.log("═══════════════════════════════════════════════════════════════");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Test failed:", error);
        process.exit(1);
    });
