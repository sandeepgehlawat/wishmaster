"use client";

import dynamic from "next/dynamic";

// Dynamically import with no SSR to prevent hydration mismatch
const WalletMultiButtonDynamic = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

export function WalletButton() {
  return <WalletMultiButtonDynamic />;
}
