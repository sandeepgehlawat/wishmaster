const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Deploy ERC-8004 Identity, Reputation, and Validation Registries
 *
 * Usage:
 *   npx hardhat run scripts/deploy-erc8004.js --network xlayerTestnet
 *   npx hardhat run scripts/deploy-erc8004.js --network xlayerMainnet
 */
async function main() {
    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();

    console.log("═══════════════════════════════════════════════════════════════");
    console.log("ERC-8004 DEPLOYMENT");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("Network:", network.name, "(Chain ID:", network.chainId.toString(), ")");
    console.log("Deployer:", deployer.address);
    console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
    console.log("");

    // Track deployed addresses
    const deployed = {};

    // ═══════════════════════════════════════════════════════════════════════
    // 1. Deploy IdentityRegistry
    // ═══════════════════════════════════════════════════════════════════════
    console.log("1. Deploying IdentityRegistry...");
    const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
    const identity = await IdentityRegistry.deploy();
    await identity.waitForDeployment();
    deployed.identityRegistry = await identity.getAddress();
    console.log("   IdentityRegistry deployed to:", deployed.identityRegistry);

    // ═══════════════════════════════════════════════════════════════════════
    // 2. Deploy ReputationRegistry
    // ═══════════════════════════════════════════════════════════════════════
    console.log("2. Deploying ReputationRegistry...");
    const ReputationRegistry = await ethers.getContractFactory("ReputationRegistry");
    const reputation = await ReputationRegistry.deploy(deployed.identityRegistry);
    await reputation.waitForDeployment();
    deployed.reputationRegistry = await reputation.getAddress();
    console.log("   ReputationRegistry deployed to:", deployed.reputationRegistry);

    // ═══════════════════════════════════════════════════════════════════════
    // 3. Deploy ValidationRegistry
    // ═══════════════════════════════════════════════════════════════════════
    console.log("3. Deploying ValidationRegistry...");
    const ValidationRegistry = await ethers.getContractFactory("ValidationRegistry");
    const validation = await ValidationRegistry.deploy(deployed.identityRegistry);
    await validation.waitForDeployment();
    deployed.validationRegistry = await validation.getAddress();
    console.log("   ValidationRegistry deployed to:", deployed.validationRegistry);

    // ═══════════════════════════════════════════════════════════════════════
    // 4. Update AgentHiveEscrow with registry addresses (if deployed)
    // ═══════════════════════════════════════════════════════════════════════
    const escrowAddress = process.env.ESCROW_CONTRACT_ADDRESS;
    if (escrowAddress && escrowAddress !== "0x") {
        console.log("4. Updating AgentHiveEscrow with registry addresses...");
        try {
            const escrow = await ethers.getContractAt("AgentHiveEscrow", escrowAddress);
            const tx = await escrow.setRegistries(
                deployed.identityRegistry,
                deployed.reputationRegistry
            );
            await tx.wait();
            console.log("   Escrow updated successfully");
            deployed.escrowUpdated = true;

            // Authorize escrow as feedback caller in ReputationRegistry
            console.log("5. Authorizing Escrow as feedback caller...");
            const authTx = await reputation.setAuthorizedCaller(escrowAddress, true);
            await authTx.wait();
            console.log("   Escrow authorized successfully");
            deployed.escrowAuthorized = true;
        } catch (error) {
            console.log("   Warning: Could not update escrow:", error.message);
            deployed.escrowUpdated = false;
        }
    } else {
        console.log("4. Skipping escrow update (ESCROW_CONTRACT_ADDRESS not set)");
        deployed.escrowUpdated = false;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Save deployment info
    // ═══════════════════════════════════════════════════════════════════════
    const deploymentInfo = {
        network: network.name,
        chainId: network.chainId.toString(),
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        contracts: {
            IdentityRegistry: deployed.identityRegistry,
            ReputationRegistry: deployed.reputationRegistry,
            ValidationRegistry: deployed.validationRegistry,
        },
        escrowUpdated: deployed.escrowUpdated || false,
        escrowAuthorized: deployed.escrowAuthorized || false,
    };

    const filename = `deployment-erc8004-${network.name || network.chainId}.json`;
    const filepath = path.join(__dirname, "..", filename);
    fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));
    console.log("");
    console.log("Deployment info saved to:", filename);

    // ═══════════════════════════════════════════════════════════════════════
    // Output for .env file
    // ═══════════════════════════════════════════════════════════════════════
    console.log("");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("ADD TO .env FILE:");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`IDENTITY_REGISTRY_ADDRESS=${deployed.identityRegistry}`);
    console.log(`REPUTATION_REGISTRY_ADDRESS=${deployed.reputationRegistry}`);
    console.log(`VALIDATION_REGISTRY_ADDRESS=${deployed.validationRegistry}`);
    console.log("");

    // ═══════════════════════════════════════════════════════════════════════
    // Verify contracts on block explorer (optional)
    // ═══════════════════════════════════════════════════════════════════════
    if (process.env.ETHERSCAN_API_KEY) {
        console.log("═══════════════════════════════════════════════════════════════");
        console.log("VERIFICATION COMMANDS:");
        console.log("═══════════════════════════════════════════════════════════════");
        console.log(`npx hardhat verify --network ${network.name} ${deployed.identityRegistry}`);
        console.log(`npx hardhat verify --network ${network.name} ${deployed.reputationRegistry} "${deployed.identityRegistry}"`);
        console.log(`npx hardhat verify --network ${network.name} ${deployed.validationRegistry} "${deployed.identityRegistry}"`);
    }

    console.log("");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("DEPLOYMENT COMPLETE");
    console.log("═══════════════════════════════════════════════════════════════");

    return deployed;
}

main()
    .then((deployed) => {
        console.log("All contracts deployed successfully!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("Deployment failed:", error);
        process.exit(1);
    });
