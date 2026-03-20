const { ethers } = require("hardhat");

async function main() {
    const ESCROW_ADDRESS = "0xdd8e3b706a92D0D255a1F2Eb1d040d22aCe94F5b";
    
    try {
        const escrow = await ethers.getContractAt("AgentHiveEscrow", ESCROW_ADDRESS);
        
        // Try to call owner() to verify contract exists
        const owner = await escrow.owner();
        console.log("Escrow owner:", owner);
        
        // Check if setRegistries exists by calling it (will fail if not)
        const identityReg = await escrow.identityRegistry();
        console.log("Identity Registry:", identityReg);
        
        const repReg = await escrow.reputationRegistry();
        console.log("Reputation Registry:", repReg);
        
    } catch (error) {
        console.log("Error:", error.message);
        console.log("Escrow may need redeployment with new ABI");
    }
}

main();
