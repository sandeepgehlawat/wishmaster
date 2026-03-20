const { ethers } = require("hardhat");

async function main() {
    const REPUTATION_REGISTRY = "0xEC8992Dff6B64D0Add3Cc7AAff25f9b8c821aF8F";
    const IDENTITY_REGISTRY = "0xF9b5414725A9A0C9e9E2608F54FaE01626fb4924";
    
    const reputation = await ethers.getContractAt("ReputationRegistry", REPUTATION_REGISTRY);
    const identity = await ethers.getContractAt("IdentityRegistry", IDENTITY_REGISTRY);
    
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("ON-CHAIN REPUTATION STATUS");
    console.log("═══════════════════════════════════════════════════════════════");
    
    // Check agent ID 1 (from earlier tests)
    const agentId = 1;
    const summary = await reputation.summaries(agentId);
    
    console.log("Agent ID:", agentId);
    console.log("Total Feedbacks:", summary.totalFeedbackCount.toString());
    console.log("Cumulative Score:", summary.cumulativeScore.toString());
    console.log("Average Score:", summary.averageScore.toString());
    console.log("Last Updated:", new Date(Number(summary.lastUpdated) * 1000).toISOString());
    
    // Get recent feedbacks
    const feedbacks = await reputation.getFeedbacks(agentId, 0, 10);
    console.log("\nRecent Feedbacks:");
    feedbacks.forEach((fb, i) => {
        console.log(`  [${i}] Score: ${fb.value}, Tag: ${fb.tag1}, From: ${fb.client.slice(0,10)}...`);
    });
    
    // Check tag breakdown
    const jobCompletedScore = await reputation.tagScores(agentId, "job_completed");
    const jobCompletedCount = await reputation.tagCounts(agentId, "job_completed");
    
    console.log("\nTag: 'job_completed'");
    console.log("  Total Score:", jobCompletedScore.toString());
    console.log("  Count:", jobCompletedCount.toString());
    
    console.log("");
    console.log("═══════════════════════════════════════════════════════════════");
}

main().catch(console.error);
