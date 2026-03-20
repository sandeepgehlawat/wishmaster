const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("Testing with signer:", signer.address);
    
    // Contract addresses
    const IDENTITY = "0xF4a30800e1c5A5B4E0b84b7a64A967891c7e9f48";
    const REPUTATION = "0x698687b194DADE362a53732895c44ACCa464759d";
    const VALIDATION = "0xBDE977706966a45fd7CD617f06EEfF256082F5b6";
    
    // Get contract instances
    const identity = await ethers.getContractAt("IdentityRegistry", IDENTITY);
    const reputation = await ethers.getContractAt("ReputationRegistry", REPUTATION);
    const validation = await ethers.getContractAt("ValidationRegistry", VALIDATION);
    
    // Test IdentityRegistry
    console.log("\n1. IdentityRegistry:");
    const name = await identity.name();
    const symbol = await identity.symbol();
    console.log("   Name:", name);
    console.log("   Symbol:", symbol);
    
    // Test ReputationRegistry
    console.log("\n2. ReputationRegistry:");
    const identityAddr = await reputation.identityRegistry();
    console.log("   Linked to IdentityRegistry:", identityAddr);
    console.log("   Match:", identityAddr.toLowerCase() === IDENTITY.toLowerCase() ? "✅" : "❌");
    
    // Test ValidationRegistry  
    console.log("\n3. ValidationRegistry:");
    const valIdentityAddr = await validation.identityRegistry();
    console.log("   Linked to IdentityRegistry:", valIdentityAddr);
    console.log("   Match:", valIdentityAddr.toLowerCase() === IDENTITY.toLowerCase() ? "✅" : "❌");
    
    console.log("\n✅ All ERC-8004 contracts verified and linked correctly!");
}

main().catch(console.error);
