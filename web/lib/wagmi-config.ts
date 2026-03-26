import { http, createConfig } from 'wagmi';
import { defineChain } from 'viem';
import { injected } from 'wagmi/connectors';

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

// Production config - X Layer Mainnet only
export const config = createConfig({
  chains: [xlayer],
  connectors: [
    injected({ target: 'metaMask' }),
    injected(),
  ],
  transports: {
    [xlayer.id]: http(),
  },
});

// Export the active chain for use in components
export const activeChain = xlayer;
