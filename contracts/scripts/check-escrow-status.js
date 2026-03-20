const { ethers } = require("hardhat");

async function main() {
  const ESCROW = "0x94a46C5e5fEa0c91bE698A33B3b43d376C9E7E69";

  console.log("Checking escrow status...");

  const escrow = await ethers.getContractAt("AgentHiveEscrow", ESCROW);

  try {
    console.log("Owner:", await escrow.owner());
    console.log("USDC:", await escrow.usdc());
    console.log("Fee:", (await escrow.platformFeeBps()).toString(), "bps");

    // Check if setRegistries exists
    try {
      const identity = await escrow.identityRegistry();
      const reputation = await escrow.reputationRegistry();
      console.log("Identity Registry:", identity);
      console.log("Reputation Registry:", reputation);
    } catch (e) {
      console.log("Registries not set yet (or old contract version)");
    }
  } catch (e) {
    console.log("Error:", e.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
