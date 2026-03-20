const { ethers, network } = require("hardhat");

async function main() {
  console.log("Deploying AgentHiveEscrow to", network.name);
  console.log("Chain ID:", network.config.chainId);

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // Get balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), network.name === "localhost" ? "ETH" : "OKB");

  let usdcAddress;

  // Deploy MockUSDC on localhost and testnet, use real USDC on mainnet
  if (network.name === "localhost" || network.name === "hardhat" || network.name === "xlayerTestnet") {
    console.log("\nDeploying MockUSDC for testing...");
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mockUSDC = await MockUSDC.deploy();
    await mockUSDC.waitForDeployment();
    usdcAddress = await mockUSDC.getAddress();
    console.log("MockUSDC deployed to:", usdcAddress);

    // On testnet, mint some tokens to deployer for testing
    if (network.name === "xlayerTestnet") {
      const mintAmount = ethers.parseUnits("10000", 6); // 10,000 USDC
      await mockUSDC.mint(deployer.address, mintAmount);
      console.log("Minted 10,000 MockUSDC to deployer");
    }
  } else {
    // USDC addresses for X Layer (update these after USDC is available)
    const USDC_ADDRESSES = {
      xlayer: "0x0000000000000000000000000000000000000000", // Update with actual mainnet USDC
      xlayerTestnet: "0x0000000000000000000000000000000000000000", // Update with actual testnet USDC
    };

    usdcAddress = USDC_ADDRESSES[network.name];
    if (!usdcAddress || usdcAddress === "0x0000000000000000000000000000000000000000") {
      console.error("ERROR: USDC address not configured for", network.name);
      process.exit(1);
    }
  }

  // Deploy escrow contract
  console.log("\nDeploying AgentHiveEscrow...");
  const Escrow = await ethers.getContractFactory("AgentHiveEscrow");
  const escrow = await Escrow.deploy(usdcAddress);
  await escrow.waitForDeployment();

  const escrowAddress = await escrow.getAddress();
  console.log("AgentHiveEscrow deployed to:", escrowAddress);

  // Log configuration
  console.log("\n=== Deployment Summary ===");
  console.log("Network:", network.name);
  console.log("Chain ID:", network.config.chainId);
  console.log("Escrow Contract:", escrowAddress);
  console.log("USDC Token:", usdcAddress);
  console.log("Owner:", deployer.address);

  // Get current fee
  const feeBps = await escrow.platformFeeBps();
  console.log("Platform Fee:", Number(feeBps) / 100, "%");

  console.log("\n=== Environment Variables ===");
  console.log(`ESCROW_CONTRACT_ADDRESS=${escrowAddress}`);
  console.log(`USDC_TOKEN_ADDRESS=${usdcAddress}`);
  console.log(`CHAIN_ID=${network.config.chainId}`);

  // Save deployment info to file
  const fs = require("fs");
  const deploymentInfo = {
    network: network.name,
    chainId: network.config.chainId,
    escrowContract: escrowAddress,
    usdcToken: usdcAddress,
    owner: deployer.address,
    deployedAt: new Date().toISOString(),
  };

  fs.writeFileSync(
    `deployment-${network.name}.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log(`\nDeployment info saved to deployment-${network.name}.json`);

  // Verify contract on explorer (if not localhost)
  if (network.name !== "localhost" && network.name !== "hardhat") {
    console.log("\nWaiting for block confirmations...");
    await new Promise((resolve) => setTimeout(resolve, 30000));

    console.log("\nTo verify contract on OKLink Explorer:");
    console.log(`npx hardhat verify --network ${network.name} ${escrowAddress} ${usdcAddress}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
