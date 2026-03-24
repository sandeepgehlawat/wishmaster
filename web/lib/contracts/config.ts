// Contract addresses per chain

export interface ContractAddresses {
  escrow: `0x${string}`;
  usdc: `0x${string}`;
}

// Chain-specific contract addresses
const addresses: Record<number, ContractAddresses> = {
  // X Layer Mainnet (196)
  196: {
    escrow: (process.env.NEXT_PUBLIC_ESCROW_CONTRACT || "0x0000000000000000000000000000000000000000") as `0x${string}`,
    usdc: (process.env.NEXT_PUBLIC_USDC_TOKEN || "0x74b7f16337b8972027f6196a17a631ac6de26d22") as `0x${string}`, // X Layer mainnet USDC
  },
  // X Layer Testnet (1952)
  1952: {
    escrow: (process.env.NEXT_PUBLIC_ESCROW_CONTRACT || "0xAa1999a34B282D13084eEeC19CC4FEe3759EF929") as `0x${string}`,
    usdc: (process.env.NEXT_PUBLIC_USDC_TOKEN || "0x070143E1f101bF90d9422241b22F7eB1efCC2A83") as `0x${string}`, // MockUSDC deployed
  },
  // Localhost (31337)
  31337: {
    escrow: (process.env.NEXT_PUBLIC_ESCROW_CONTRACT || "0x5FbDB2315678afecb367f032d93F642f64180aa3") as `0x${string}`,
    usdc: (process.env.NEXT_PUBLIC_USDC_TOKEN || "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512") as `0x${string}`,
  },
};

// Get the active chain ID from environment
export function getActiveChainId(): number {
  return parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "1952");
}

// Get contract addresses for current chain
export function getContractAddresses(): ContractAddresses {
  const chainId = getActiveChainId();
  return addresses[chainId] || addresses[1952]; // Default to testnet
}

// Get explorer URL for transaction
export function getExplorerTxUrl(txHash: string): string {
  const chainId = getActiveChainId();
  switch (chainId) {
    case 196:
      return `https://www.oklink.com/xlayer/tx/${txHash}`;
    case 1952:
      return `https://www.oklink.com/xlayer-test/tx/${txHash}`;
    default:
      return `https://www.oklink.com/xlayer-test/tx/${txHash}`;
  }
}

// Get explorer URL for address
export function getExplorerAddressUrl(address: string): string {
  const chainId = getActiveChainId();
  switch (chainId) {
    case 196:
      return `https://www.oklink.com/xlayer/address/${address}`;
    case 1952:
      return `https://www.oklink.com/xlayer-test/address/${address}`;
    default:
      return `https://www.oklink.com/xlayer-test/address/${address}`;
  }
}

// USDC has 6 decimals
export const USDC_DECIMALS = 6;

// Convert USDC amount to wei (6 decimals)
export function toUsdcWei(amount: number): bigint {
  return BigInt(Math.floor(amount * 10 ** USDC_DECIMALS));
}

// Convert USDC wei to display amount
export function fromUsdcWei(wei: bigint): number {
  return Number(wei) / 10 ** USDC_DECIMALS;
}
