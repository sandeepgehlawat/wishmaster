const { ethers } = require("hardhat");

/**
 * Setup existing escrow with ERC-8004 registries
 */
async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("═══════════════════════════════════════════════════════════════");
    console.log("ESCROW SETUP WITH ERC-8004 REGISTRIES");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("Deployer:", deployer.address);
    console.log("");

    // Addresses
    const ESCROW_ADDRESS = "0x4814FDf0a0b969B48a0CCCFC44ad1EF8D3491170";
    const IDENTITY_REGISTRY = "0xF9b5414725A9A0C9e9E2608F54FaE01626fb4924";
    const REPUTATION_REGISTRY = "0xEC8992Dff6B64D0Add3Cc7AAff25f9b8c821aF8F";

    console.log("Escrow:", ESCROW_ADDRESS);
    console.log("Identity Registry:", IDENTITY_REGISTRY);
    console.log("Reputation Registry:", REPUTATION_REGISTRY);
    console.log("");

    // Get contracts
    const escrow = await ethers.getContractAt("AgentHiveEscrow", ESCROW_ADDRESS);
    const reputation = await ethers.getContractAt("ReputationRegistry", REPUTATION_REGISTRY);

    // Set fee to max allowed (10%)
    console.log("1. Setting platform fee to 1000 bps (10%)...");
    const txFee = await escrow.setFee(1000);
    await txFee.wait();
    console.log("   Fee set successfully");

    // Set registries
    console.log("2. Setting registry addresses...");
    const tx1 = await escrow.setRegistries(IDENTITY_REGISTRY, REPUTATION_REGISTRY);
    await tx1.wait();
    console.log("   Registries set successfully");

    // Authorize escrow as feedback caller
    console.log("3. Authorizing escrow as reputation caller...");
    const tx2 = await reputation.setAuthorizedCaller(ESCROW_ADDRESS, true);
    await tx2.wait();
    console.log("   Escrow authorized successfully");

    // Verify setup
    console.log("4. Verifying setup...");
    const identityReg = await escrow.identityRegistry();
    const repReg = await escrow.reputationRegistry();
    const fee = await escrow.platformFeeBps();
    const isAuthorized = await reputation.authorizedCallers(ESCROW_ADDRESS);

    console.log("   Identity Registry:", identityReg);
    console.log("   Reputation Registry:", repReg);
    console.log("   Platform Fee:", fee.toString(), "bps");
    console.log("   Escrow authorized:", isAuthorized);

    console.log("");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("UPDATE .env FILE:");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`ESCROW_CONTRACT_ADDRESS=${ESCROW_ADDRESS}`);
    console.log("");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("SETUP COMPLETE");
    console.log("═══════════════════════════════════════════════════════════════");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Setup failed:", error);
        process.exit(1);
    });
