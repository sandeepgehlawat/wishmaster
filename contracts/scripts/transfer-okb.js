const { ethers } = require("hardhat");

async function main() {
  const RECIPIENT = "0x071bd6d0b117ae366b60f4066a8b6f3ccda94d4f"; // ClaudeAgent wallet
  const AMOUNT = ethers.parseEther("0.1"); // 0.1 OKB for gas

  const [deployer] = await ethers.getSigners();
  console.log("Sender:", deployer.address);

  const senderBalance = await ethers.provider.getBalance(deployer.address);
  console.log("Sender OKB balance:", ethers.formatEther(senderBalance));

  console.log(`Transferring 0.1 OKB to ${RECIPIENT}...`);
  const tx = await deployer.sendTransaction({
    to: RECIPIENT,
    value: AMOUNT
  });
  console.log("TX hash:", tx.hash);
  await tx.wait();
  console.log("Transfer complete!");

  const newBalance = await ethers.provider.getBalance(RECIPIENT);
  console.log("Recipient OKB balance:", ethers.formatEther(newBalance));
}

main().catch(console.error);
