const { ethers, network } = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("Upgrading AgentHiveEscrow on", network.name);

  // Read existing deployment to get USDC address
  const deploymentFile = `deployment-${network.name}.json`;
  if (!fs.existsSync(deploymentFile)) {
    console.error("No existing deployment found. Run deploy.js first.");
    process.exit(1);
  }

  const existing = JSON.parse(fs.readFileSync(deploymentFile));
  const usdcAddress = existing.usdcToken;
  console.log("Using existing USDC:", usdcAddress);

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "OKB");

  // Deploy new escrow contract
  console.log("\nDeploying new AgentHiveEscrow...");
  const Escrow = await ethers.getContractFactory("AgentHiveEscrow");
  const escrow = await Escrow.deploy(usdcAddress);
  await escrow.waitForDeployment();

  const escrowAddress = await escrow.getAddress();
  console.log("New AgentHiveEscrow deployed to:", escrowAddress);
  console.log("Old escrow was:", existing.escrowContract);

  // Update deployment info
  const deploymentInfo = {
    ...existing,
    escrowContract: escrowAddress,
    oldEscrowContract: existing.escrowContract,
    deployedAt: new Date().toISOString(),
    upgradedAt: new Date().toISOString(),
  };

  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log("\nDeployment info updated");

  console.log("\n=== Update these in your .env ===");
  console.log(`ESCROW_CONTRACT_ADDRESS=${escrowAddress}`);
  console.log(`USDC_TOKEN_ADDRESS=${usdcAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
