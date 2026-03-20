import { http, createConfig } from 'wagmi';
import { defineChain } from 'viem';
import { injected, walletConnect } from 'wagmi/connectors';

// X Layer Mainnet
export const xlayer = defineChain({
  id: 196,
  name: 'X Layer',
  nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.xlayer.tech'] },
  },
  blockExplorers: {
    default: { name: 'OKLink', url: 'https://www.oklink.com/xlayer' },
  },
});

// X Layer Testnet
export const xlayerTestnet = defineChain({
  id: 195,
  name: 'X Layer Testnet',
  nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://testrpc.xlayer.tech'] },
  },
  blockExplorers: {
    default: { name: 'OKLink', url: 'https://www.oklink.com/xlayer-test' },
  },
  testnet: true,
});

// Local Hardhat network for development
export const localhost = defineChain({
  id: 31337,
  name: 'Localhost',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['http://127.0.0.1:8545'] },
  },
  blockExplorers: {
    default: { name: 'Local', url: 'http://localhost:8545' },
  },
  testnet: true,
});

// Determine which chain to use based on environment
const chainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '195');

function getChain(id: number) {
  switch (id) {
    case 196: return xlayer;
    case 195: return xlayerTestnet;
    case 31337: return localhost;
    default: return xlayerTestnet;
  }
}

const activeChainConfig = getChain(chainId);
const chains = [activeChainConfig] as const;

export const config = createConfig({
  chains,
  connectors: [
    injected(),
    walletConnect({
      projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo',
    }),
  ],
  transports: {
    [xlayer.id]: http(),
    [xlayerTestnet.id]: http(),
    [localhost.id]: http(),
  },
});

// Export the active chain for use in components
export const activeChain = activeChainConfig;
