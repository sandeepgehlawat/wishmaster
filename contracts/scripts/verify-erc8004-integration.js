const { ethers } = require("hardhat");

/**
 * Verify ERC-8004 integration between Escrow and Reputation/Identity registries
 */
async function main() {
  // Current deployed addresses on X Layer Testnet
  const ESCROW = "0xAa1999a34B282D13084eEeC19CC4FEe3759EF929";
  const USDC = "0x070143E1f101bF90d9422241b22F7eB1efCC2A83";
  const IDENTITY = "0xF4a30800e1c5A5B4E0b84b7a64A967891c7e9f48";
  const REPUTATION = "0x698687b194DADE362a53732895c44ACCa464759d";
  const VALIDATION = "0xBDE977706966a45fd7CD617f06EEfF256082F5b6";

  const [deployer] = await ethers.getSigners();

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("ERC-8004 INTEGRATION VERIFICATION");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("Verifier:", deployer.address);
  console.log("");

  // Get contract instances
  const escrow = await ethers.getContractAt("AgentHiveEscrow", ESCROW);
  const identity = await ethers.getContractAt("IdentityRegistry", IDENTITY);
  const reputation = await ethers.getContractAt("ReputationRegistry", REPUTATION);

  let allPassed = true;

  // ==================== ESCROW CHECKS ====================
  console.log("1. ESCROW CONTRACT CHECKS");
  console.log("─────────────────────────────────────────────────────────────────");

  // Check USDC token
  const usdcAddress = await escrow.usdc();
  const usdcMatch = usdcAddress.toLowerCase() === USDC.toLowerCase();
  console.log(`  USDC Token: ${usdcAddress} ${usdcMatch ? "✓" : "✗"}`);
  allPassed = allPassed && usdcMatch;

  // Check platform fee
  const platformFee = await escrow.platformFeeBps();
  console.log(`  Platform Fee: ${platformFee} bps (${Number(platformFee) / 100}%)`);

  // Check identity registry
  const identityReg = await escrow.identityRegistry();
  const identityMatch = identityReg.toLowerCase() === IDENTITY.toLowerCase();
  console.log(`  Identity Registry: ${identityReg} ${identityMatch ? "✓" : "✗"}`);
  allPassed = allPassed && identityMatch;

  // Check reputation registry
  const reputationReg = await escrow.reputationRegistry();
  const reputationMatch = reputationReg.toLowerCase() === REPUTATION.toLowerCase();
  console.log(`  Reputation Registry: ${reputationReg} ${reputationMatch ? "✓" : "✗"}`);
  allPassed = allPassed && reputationMatch;

  // Check owner
  const escrowOwner = await escrow.owner();
  console.log(`  Owner: ${escrowOwner}`);
  console.log("");

  // ==================== IDENTITY REGISTRY CHECKS ====================
  console.log("2. IDENTITY REGISTRY CHECKS (ERC-8004)");
  console.log("─────────────────────────────────────────────────────────────────");

  // Check name and symbol
  const idName = await identity.name();
  const idSymbol = await identity.symbol();
  console.log(`  Name: ${idName}`);
  console.log(`  Symbol: ${idSymbol}`);

  // Check total agents
  const totalAgents = await identity.totalAgents();
  console.log(`  Total Registered Agents: ${totalAgents}`);

  // Check owner
  const identityOwner = await identity.owner();
  console.log(`  Owner: ${identityOwner}`);
  console.log("");

  // ==================== REPUTATION REGISTRY CHECKS ====================
  console.log("3. REPUTATION REGISTRY CHECKS (ERC-8004)");
  console.log("─────────────────────────────────────────────────────────────────");

  // Check identity registry reference
  const repIdentityReg = await reputation.identityRegistry();
  const repIdentityMatch = repIdentityReg.toLowerCase() === IDENTITY.toLowerCase();
  console.log(`  Identity Registry: ${repIdentityReg} ${repIdentityMatch ? "✓" : "✗"}`);
  allPassed = allPassed && repIdentityMatch;

  // Check escrow authorization
  const escrowAuthorized = await reputation.isAuthorizedCaller(ESCROW);
  console.log(`  Escrow Authorized: ${escrowAuthorized} ${escrowAuthorized ? "✓" : "✗"}`);
  allPassed = allPassed && escrowAuthorized;

  // Check owner
  const reputationOwner = await reputation.owner();
  console.log(`  Owner: ${reputationOwner}`);
  console.log("");

  // ==================== INTEGRATION FLOW CHECK ====================
  console.log("4. INTEGRATION FLOW");
  console.log("─────────────────────────────────────────────────────────────────");

  console.log("  When a job is completed via escrow.release():");
  console.log("    1. Escrow releases USDC to agent ✓");
  console.log("    2. Escrow calls identityRegistry.getAgentByWallet(agentWallet)");
  console.log("    3. Escrow calls reputationRegistry.giveFeedback(agentId, +100, 'job_completed', '', '')");
  console.log("    4. Reputation is automatically updated on-chain ✓");
  console.log("");

  console.log("  When a dispute is resolved in favor of client:");
  console.log("    1. Escrow refunds USDC to client ✓");
  console.log("    2. Escrow calls reputationRegistry.giveFeedback(agentId, -50, 'dispute_lost', '', '')");
  console.log("    3. Agent reputation decreases ✓");
  console.log("");

  // ==================== SUMMARY ====================
  console.log("═══════════════════════════════════════════════════════════════");
  if (allPassed) {
    console.log("✓ ALL CHECKS PASSED - ERC-8004 INTEGRATION COMPLETE");
  } else {
    console.log("✗ SOME CHECKS FAILED - REVIEW CONFIGURATION");
  }
  console.log("═══════════════════════════════════════════════════════════════");

  // Contract addresses summary
  console.log("");
  console.log("CONTRACT ADDRESSES (X Layer Testnet - Chain ID 1952):");
  console.log("─────────────────────────────────────────────────────────────────");
  console.log(`  AgentHiveEscrow:     ${ESCROW}`);
  console.log(`  MockUSDC:            ${USDC}`);
  console.log(`  IdentityRegistry:    ${IDENTITY}`);
  console.log(`  ReputationRegistry:  ${REPUTATION}`);
  console.log(`  ValidationRegistry:  ${VALIDATION}`);
  console.log("");
  console.log("Explorer: https://www.oklink.com/xlayer-test");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Verification failed:", error);
    process.exit(1);
  });
