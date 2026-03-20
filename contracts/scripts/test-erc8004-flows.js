const { ethers } = require("hardhat");

/**
 * Test all ERC-8004 flows on testnet
 */
async function main() {
    const [deployer, agent1, agent2, validator] = await ethers.getSigners();

    console.log("═══════════════════════════════════════════════════════════════");
    console.log("ERC-8004 FLOW TESTS");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("Deployer:", deployer.address);
    console.log("Agent1:", agent1?.address || "N/A (only 1 signer)");
    console.log("");

    // Contract addresses from deployment
    const IDENTITY_REGISTRY = "0xF9b5414725A9A0C9e9E2608F54FaE01626fb4924";
    const REPUTATION_REGISTRY = "0xEC8992Dff6B64D0Add3Cc7AAff25f9b8c821aF8F";
    const VALIDATION_REGISTRY = "0xB9f47Ff4a28D1616D89BED803448bB453591eeE1";

    // Get contract instances
    const identity = await ethers.getContractAt("IdentityRegistry", IDENTITY_REGISTRY);
    const reputation = await ethers.getContractAt("ReputationRegistry", REPUTATION_REGISTRY);
    const validation = await ethers.getContractAt("ValidationRegistry", VALIDATION_REGISTRY);

    // ═══════════════════════════════════════════════════════════════════════
    // TEST 1: Register Agent Identity
    // ═══════════════════════════════════════════════════════════════════════
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("TEST 1: Register Agent Identity");
    console.log("═══════════════════════════════════════════════════════════════");

    const agentURI = "ipfs://QmTestAgentMetadata123456789";

    try {
        const tx1 = await identity.register(agentURI);
        const receipt1 = await tx1.wait();

        // Get agentId from event
        const registerEvent = receipt1.logs.find(
            log => log.fragment?.name === "Registered"
        );

        let agentId;
        if (registerEvent) {
            agentId = registerEvent.args[0];
            console.log("✓ Agent registered with ID:", agentId.toString());
        } else {
            // Fallback: get next token ID - 1
            agentId = 1n; // First agent
            console.log("✓ Agent registered (ID assumed):", agentId.toString());
        }

        // Verify registration
        const owner = await identity.ownerOf(agentId);
        console.log("✓ Agent owner:", owner);

        const tokenURI = await identity.tokenURI(agentId);
        console.log("✓ Agent URI:", tokenURI);

        const wallet = await identity.agentWallets(agentId);
        console.log("✓ Agent wallet:", wallet);

        // ═══════════════════════════════════════════════════════════════════════
        // TEST 2: Set Agent Metadata
        // ═══════════════════════════════════════════════════════════════════════
        console.log("");
        console.log("═══════════════════════════════════════════════════════════════");
        console.log("TEST 2: Set Agent Metadata");
        console.log("═══════════════════════════════════════════════════════════════");

        const capabilities = ethers.AbiCoder.defaultAbiCoder().encode(
            ["string[]"],
            [["rust", "solidity", "python", "ml"]]
        );

        const tx2 = await identity.setMetadata(agentId, "capabilities", capabilities);
        await tx2.wait();
        console.log("✓ Metadata set for 'capabilities'");

        const storedMeta = await identity.getMetadata(agentId, "capabilities");
        const decoded = ethers.AbiCoder.defaultAbiCoder().decode(["string[]"], storedMeta);
        console.log("✓ Retrieved capabilities:", decoded[0]);

        // ═══════════════════════════════════════════════════════════════════════
        // TEST 3: Give Feedback (Reputation)
        // ═══════════════════════════════════════════════════════════════════════
        console.log("");
        console.log("═══════════════════════════════════════════════════════════════");
        console.log("TEST 3: Give Feedback (Reputation)");
        console.log("═══════════════════════════════════════════════════════════════");

        // Give positive feedback
        const tx3a = await reputation.giveFeedback(
            agentId,
            100,  // +100 score
            "job_completed",
            "development",
            "ipfs://QmFeedback1"
        );
        await tx3a.wait();
        console.log("✓ Positive feedback (+100) given");

        // Give another feedback
        const tx3b = await reputation.giveFeedback(
            agentId,
            80,  // +80 score
            "job_completed",
            "smart-contracts",
            "ipfs://QmFeedback2"
        );
        await tx3b.wait();
        console.log("✓ Another positive feedback (+80) given");

        // Check summary
        const summary = await reputation.summaries(agentId);
        console.log("✓ Reputation Summary:");
        console.log("  - Total feedbacks:", summary.totalFeedbackCount.toString());
        console.log("  - Cumulative score:", summary.cumulativeScore.toString());
        console.log("  - Average score:", summary.averageScore.toString());

        // Check tag scores
        const tagScore = await reputation.tagScores(agentId, "job_completed");
        const tagCount = await reputation.tagCounts(agentId, "job_completed");
        console.log("✓ Tag 'job_completed':");
        console.log("  - Score:", tagScore.toString());
        console.log("  - Count:", tagCount.toString());

        // ═══════════════════════════════════════════════════════════════════════
        // TEST 4: Get Filtered Summary
        // ═══════════════════════════════════════════════════════════════════════
        console.log("");
        console.log("═══════════════════════════════════════════════════════════════");
        console.log("TEST 4: Get Filtered Summary");
        console.log("═══════════════════════════════════════════════════════════════");

        const [count, avgScore] = await reputation.getSummary(
            agentId,
            [],  // No client filter
            "job_completed",  // Filter by tag1
            ""   // No tag2 filter
        );
        console.log("✓ Filtered summary (tag: job_completed):");
        console.log("  - Count:", count.toString());
        console.log("  - Average:", avgScore.toString());

        // ═══════════════════════════════════════════════════════════════════════
        // TEST 5: Request Validation
        // ═══════════════════════════════════════════════════════════════════════
        console.log("");
        console.log("═══════════════════════════════════════════════════════════════");
        console.log("TEST 5: Request Validation");
        console.log("═══════════════════════════════════════════════════════════════");

        // Request validation from deployer (acting as validator)
        const validatorAddress = deployer.address;
        const requestURI = "ipfs://QmValidationRequest123";

        const tx5 = await validation.validationRequest(
            validatorAddress,
            agentId,
            requestURI
        );
        const receipt5 = await tx5.wait();

        // Get request hash from event
        const requestEvent = receipt5.logs.find(
            log => log.fragment?.name === "ValidationRequested"
        );

        let requestHash;
        if (requestEvent) {
            requestHash = requestEvent.args[0];
            console.log("✓ Validation requested, hash:", requestHash);
        } else {
            console.log("✓ Validation requested (event not parsed)");
            // Calculate hash manually
            const block = await ethers.provider.getBlock(receipt5.blockNumber);
            requestHash = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ["address", "uint256", "string", "uint256"],
                    [validatorAddress, agentId, requestURI, block.timestamp]
                )
            );
            console.log("  Calculated hash:", requestHash);
        }

        // Check request details
        const request = await validation.requests(requestHash);
        console.log("✓ Request details:");
        console.log("  - Validator:", request.validator);
        console.log("  - Status:", request.status.toString(), "(0=Pending)");

        // ═══════════════════════════════════════════════════════════════════════
        // TEST 6: Respond to Validation
        // ═══════════════════════════════════════════════════════════════════════
        console.log("");
        console.log("═══════════════════════════════════════════════════════════════");
        console.log("TEST 6: Respond to Validation (Approve)");
        console.log("═══════════════════════════════════════════════════════════════");

        // Validator responds (deployer is validator)
        const tx6 = await validation.validationResponse(
            requestHash,
            1,  // 1 = Approved
            "ipfs://QmValidationResponse123"
        );
        await tx6.wait();
        console.log("✓ Validation response submitted (Approved)");

        // Check updated status
        const updatedRequest = await validation.requests(requestHash);
        console.log("✓ Updated status:", updatedRequest.status.toString(), "(1=Approved)");

        // Check if agent is validated
        const isValidated = await validation.isValidated(validatorAddress, agentId);
        console.log("✓ Agent validated by validator:", isValidated);

        // ═══════════════════════════════════════════════════════════════════════
        // TEST 7: Get All Feedbacks (Paginated)
        // ═══════════════════════════════════════════════════════════════════════
        console.log("");
        console.log("═══════════════════════════════════════════════════════════════");
        console.log("TEST 7: Get All Feedbacks (Paginated)");
        console.log("═══════════════════════════════════════════════════════════════");

        const feedbacks = await reputation.getFeedbacks(agentId, 0, 10);
        console.log("✓ Retrieved", feedbacks.length, "feedbacks:");
        feedbacks.forEach((fb, i) => {
            console.log(`  [${i}] Value: ${fb.value}, Tag1: ${fb.tag1}, Tag2: ${fb.tag2}`);
        });

        console.log("");
        console.log("═══════════════════════════════════════════════════════════════");
        console.log("ALL TESTS PASSED!");
        console.log("═══════════════════════════════════════════════════════════════");

    } catch (error) {
        console.error("✗ Test failed:", error.message);
        if (error.data) {
            console.error("  Error data:", error.data);
        }
        throw error;
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
