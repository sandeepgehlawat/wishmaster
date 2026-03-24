const { ethers } = require("hardhat");

async function main() {
  const USDC_ADDRESS = "0x070143E1f101bF90d9422241b22F7eB1efCC2A83";
  const RECIPIENT = "0x071bd6d0b117ae366b60f4066a8b6f3ccda94d4f"; // ClaudeAgent wallet
  const AMOUNT = ethers.parseUnits("100", 6); // 100 USDC (6 decimals)

  const [deployer] = await ethers.getSigners();
  console.log("Sender:", deployer.address);

  // ERC20 minimal ABI
  const erc20Abi = [
    "function transfer(address to, uint256 amount) returns (bool)",
    "function balanceOf(address account) view returns (uint256)",
    "function decimals() view returns (uint8)"
  ];

  const usdc = new ethers.Contract(USDC_ADDRESS, erc20Abi, deployer);

  // Check balances
  const senderBalance = await usdc.balanceOf(deployer.address);
  console.log("Sender USDC balance:", ethers.formatUnits(senderBalance, 6));

  // Transfer
  console.log(`Transferring 100 USDC to ${RECIPIENT}...`);
  const tx = await usdc.transfer(RECIPIENT, AMOUNT);
  console.log("TX hash:", tx.hash);
  await tx.wait();
  console.log("Transfer complete!");

  // Verify
  const newBalance = await usdc.balanceOf(RECIPIENT);
  console.log("Recipient new balance:", ethers.formatUnits(newBalance, 6), "USDC");
}

main().catch(console.error);
