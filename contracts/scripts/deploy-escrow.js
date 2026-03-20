const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Deploy AgentHiveEscrow with ERC-8004 integration
 */
async function main() {
    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();

    console.log("═══════════════════════════════════════════════════════════════");
    console.log("ESCROW DEPLOYMENT WITH ERC-8004 INTEGRATION");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("Network:", network.name, "(Chain ID:", network.chainId.toString(), ")");
    console.log("Deployer:", deployer.address);
    console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "OKB");
    console.log("");

    // Configuration - X Layer Testnet
    const USDC_ADDRESS = "0x070143E1f101bF90d9422241b22F7eB1efCC2A83"; // USDC on X Layer testnet
    const IDENTITY_REGISTRY = "0xF4a30800e1c5A5B4E0b84b7a64A967891c7e9f48";
    const REPUTATION_REGISTRY = "0x698687b194DADE362a53732895c44ACCa464759d";
    const PLATFORM_FEE_BPS = 500; // 5%

    console.log("Configuration:");
    console.log("  USDC:", USDC_ADDRESS);
    console.log("  Identity Registry:", IDENTITY_REGISTRY);
    console.log("  Reputation Registry:", REPUTATION_REGISTRY);
    console.log("  Platform Fee:", PLATFORM_FEE_BPS, "bps (", PLATFORM_FEE_BPS / 100, "%)");
    console.log("");

    // Deploy Escrow
    console.log("1. Deploying AgentHiveEscrow...");
    const AgentHiveEscrow = await ethers.getContractFactory("AgentHiveEscrow");
    const escrow = await AgentHiveEscrow.deploy(USDC_ADDRESS);
    await escrow.waitForDeployment();
    const escrowAddress = await escrow.getAddress();
    console.log("   Escrow deployed to:", escrowAddress);

    // Set platform fee
    console.log("2. Setting platform fee...");
    const txFee = await escrow.setFee(PLATFORM_FEE_BPS);
    await txFee.wait();
    console.log("   Platform fee set to", PLATFORM_FEE_BPS, "bps");

    // Set registries
    console.log("3. Setting registry addresses...");
    const tx1 = await escrow.setRegistries(IDENTITY_REGISTRY, REPUTATION_REGISTRY);
    await tx1.wait();
    console.log("   Registries set successfully");

    // Authorize escrow as feedback caller in ReputationRegistry
    console.log("4. Authorizing escrow as reputation caller...");
    const reputation = await ethers.getContractAt("ReputationRegistry", REPUTATION_REGISTRY);
    const tx2 = await reputation.setAuthorizedCaller(escrowAddress, true);
    await tx2.wait();
    console.log("   Escrow authorized successfully");

    // Verify setup
    console.log("5. Verifying setup...");
    const identityReg = await escrow.identityRegistry();
    const repReg = await escrow.reputationRegistry();
    const isAuthorized = await reputation.authorizedCallers(escrowAddress);
    console.log("   Identity Registry:", identityReg);
    console.log("   Reputation Registry:", repReg);
    console.log("   Escrow authorized:", isAuthorized);

    // Save deployment info
    const deploymentInfo = {
        network: network.name,
        chainId: network.chainId.toString(),
        timestamp: new Date().toISOString(),
        escrow: escrowAddress,
        usdc: USDC_ADDRESS,
        identityRegistry: IDENTITY_REGISTRY,
        reputationRegistry: REPUTATION_REGISTRY,
        platformFeeBps: PLATFORM_FEE_BPS,
    };

    const filename = `deployment-escrow-${network.name || network.chainId}.json`;
    fs.writeFileSync(path.join(__dirname, "..", filename), JSON.stringify(deploymentInfo, null, 2));
    console.log("");
    console.log("Deployment info saved to:", filename);

    console.log("");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("UPDATE .env FILE:");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`ESCROW_CONTRACT_ADDRESS=${escrowAddress}`);
    console.log("");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("DEPLOYMENT COMPLETE");
    console.log("═══════════════════════════════════════════════════════════════");

    return escrowAddress;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Deployment failed:", error);
        process.exit(1);
    });
