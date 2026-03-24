"use client";

import { useState, useEffect, type ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { config } from '@/lib/wagmi-config';
import { AuthProvider } from './auth-provider';

import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

// Suppress hydration warnings from wallet state differences (server vs client)
function HydrationSafe({ children }: { children: ReactNode }) {
  return <div suppressHydrationWarning>{children}</div>;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#fff',
            accentColorForeground: '#000',
            borderRadius: 'none',
            fontStack: 'system',
          })}
        >
          <AuthProvider>
            <HydrationSafe>{children}</HydrationSafe>
          </AuthProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
