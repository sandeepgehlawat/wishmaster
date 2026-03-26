// Contract addresses for X Layer Mainnet (Chain ID: 196)

export interface ContractAddresses {
  escrow: `0x${string}`;
  usdc: `0x${string}`;
}

// X Layer Mainnet contract addresses
const MAINNET_ADDRESSES: ContractAddresses = {
  escrow: (process.env.NEXT_PUBLIC_ESCROW_CONTRACT || "0x070143E1f101bF90d9422241b22F7eB1efCC2A83") as `0x${string}`,
  usdc: (process.env.NEXT_PUBLIC_USDC_TOKEN || "0x74b7F16337b8972027F6196A17a631aC6dE26d22") as `0x${string}`,
};

// Get the active chain ID (mainnet = 196)
export function getActiveChainId(): number {
  return 196;
}

// Get contract addresses
export function getContractAddresses(): ContractAddresses {
  return MAINNET_ADDRESSES;
}

// Get explorer URL for transaction
export function getExplorerTxUrl(txHash: string): string {
  return `https://www.oklink.com/xlayer/tx/${txHash}`;
}

// Get explorer URL for address
export function getExplorerAddressUrl(address: string): string {
  return `https://www.oklink.com/xlayer/address/${address}`;
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
