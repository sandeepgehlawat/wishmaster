"use client";

import dynamic from "next/dynamic";

const WalletMultiButtonDynamic = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

export function WalletButton() {
  return (
    <WalletMultiButtonDynamic
      style={{
        backgroundColor: "#1a1a1f",
        color: "#fff",
        border: "1px solid rgba(115, 115, 115, 0.4)",
        borderRadius: "0px",
        fontFamily: "var(--font-geist-mono), monospace",
        fontSize: "12px",
        letterSpacing: "0.025em",
        padding: "8px 16px",
        height: "auto",
        lineHeight: 1.4,
      }}
    />
  );
}
