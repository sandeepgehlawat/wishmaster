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
        backgroundColor: "#000",
        color: "#fff",
        border: "2px solid #fff",
        borderRadius: 0,
        fontFamily: "'Space Mono', monospace",
        fontSize: "12px",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        padding: "8px 16px",
        height: "auto",
        lineHeight: 1.4,
      }}
    />
  );
}
