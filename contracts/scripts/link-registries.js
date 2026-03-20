const { ethers } = require("hardhat");

async function main() {
  const ESCROW = "0x94a46C5e5fEa0c91bE698A33B3b43d376C9E7E69";
  const IDENTITY = "0xF4a30800e1c5A5B4E0b84b7a64A967891c7e9f48";
  const REPUTATION = "0x698687b194DADE362a53732895c44ACCa464759d";

  console.log("Linking ERC-8004 registries to Escrow...");

  // 1. Set registries on escrow
  console.log("1. Setting registries on escrow...");
  const escrow = await ethers.getContractAt("AgentHiveEscrow", ESCROW);
  const tx1 = await escrow.setRegistries(IDENTITY, REPUTATION);
  await tx1.wait();
  console.log("   Done! tx:", tx1.hash);

  // 2. Authorize escrow in reputation registry
  console.log("2. Authorizing escrow as feedback caller...");
  const reputation = await ethers.getContractAt("ReputationRegistry", REPUTATION);
  const tx2 = await reputation.setAuthorizedCaller(ESCROW, true);
  await tx2.wait();
  console.log("   Done! tx:", tx2.hash);

  console.log("\nRegistries linked successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
