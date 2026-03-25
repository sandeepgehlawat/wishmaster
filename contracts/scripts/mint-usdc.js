const { ethers } = require("hardhat");

async function main() {
  const USDC = "0x070143E1f101bF90d9422241b22F7eB1efCC2A83";
  const TO = process.env.MINT_TO || "0xc5e1cd666aed8c7811ed14547ff2aeda412bddc6";
  const AMOUNT = ethers.parseUnits(process.env.MINT_AMOUNT || "1000", 6);

  const [deployer] = await ethers.getSigners();
  console.log("Minting from:", deployer.address);
  console.log("Minting to:", TO);
  console.log("Amount:", ethers.formatUnits(AMOUNT, 6), "USDC");

  const usdc = await ethers.getContractAt("MockUSDC", USDC);

  // Check current balance
  const balBefore = await usdc.balanceOf(TO);
  console.log("Balance before:", ethers.formatUnits(balBefore, 6), "USDC");

  // Mint
  console.log("Sending mint transaction...");
  const tx = await usdc.mint(TO, AMOUNT);
  console.log("Tx hash:", tx.hash);
  await tx.wait();

  // Check new balance
  const balAfter = await usdc.balanceOf(TO);
  console.log("Balance after:", ethers.formatUnits(balAfter, 6), "USDC");
  console.log("Done!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
