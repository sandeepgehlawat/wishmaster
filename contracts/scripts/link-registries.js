const { ethers } = require("hardhat");

async function main() {
  // Current deployed addresses on X Layer Testnet (from deployment-escrow-xlayerTestnet.json)
  const ESCROW = "0xAa1999a34B282D13084eEeC19CC4FEe3759EF929";
  const IDENTITY = "0xF4a30800e1c5A5B4E0b84b7a64A967891c7e9f48";
  const REPUTATION = "0x698687b194DADE362a53732895c44ACCa464759d";

  const [deployer] = await ethers.getSigners();

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("LINKING ERC-8004 REGISTRIES TO ESCROW");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("Deployer:", deployer.address);
  console.log("Escrow:", ESCROW);
  console.log("Identity Registry:", IDENTITY);
  console.log("Reputation Registry:", REPUTATION);
  console.log("");

  // Get contract instances
  const escrow = await ethers.getContractAt("AgentHiveEscrow", ESCROW);
  const reputation = await ethers.getContractAt("ReputationRegistry", REPUTATION);

  // Check current state
  console.log("Checking current state...");
  const currentIdentity = await escrow.identityRegistry();
  const currentReputation = await escrow.reputationRegistry();
  const isAuthorized = await reputation.isAuthorizedCaller(ESCROW);

  console.log("  Current Identity Registry:", currentIdentity);
  console.log("  Current Reputation Registry:", currentReputation);
  console.log("  Escrow is authorized:", isAuthorized);
  console.log("");

  // 1. Set registries on escrow (if not already set)
  if (currentIdentity.toLowerCase() !== IDENTITY.toLowerCase() ||
      currentReputation.toLowerCase() !== REPUTATION.toLowerCase()) {
    console.log("1. Setting registries on escrow...");
    const tx1 = await escrow.setRegistries(IDENTITY, REPUTATION);
    await tx1.wait();
    console.log("   Done! tx:", tx1.hash);
  } else {
    console.log("1. Registries already set on escrow - skipping");
  }

  // 2. Authorize escrow in reputation registry (if not already authorized)
  if (!isAuthorized) {
    console.log("2. Authorizing escrow as feedback caller...");
    const tx2 = await reputation.setAuthorizedCaller(ESCROW, true);
    await tx2.wait();
    console.log("   Done! tx:", tx2.hash);
  } else {
    console.log("2. Escrow already authorized - skipping");
  }

  // Verify final state
  console.log("");
  console.log("Verifying final state...");
  const finalIdentity = await escrow.identityRegistry();
  const finalReputation = await escrow.reputationRegistry();
  const finalAuthorized = await reputation.isAuthorizedCaller(ESCROW);

  console.log("  Identity Registry:", finalIdentity);
  console.log("  Reputation Registry:", finalReputation);
  console.log("  Escrow authorized:", finalAuthorized);

  console.log("");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("ERC-8004 INTEGRATION COMPLETE");
  console.log("═══════════════════════════════════════════════════════════════");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
