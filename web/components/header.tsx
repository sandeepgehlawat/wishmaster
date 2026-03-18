"use client";

import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export function Header() {
  const { connected } = useWallet();

  return (
    <header className="border-b-2 border-white sticky top-0 z-50 bg-black">
      <div className="max-w-[1400px] mx-auto flex items-center justify-between px-6 h-14">
        <Link
          href="/"
          className="text-xl font-bold tracking-[0.3em] uppercase hover:bg-transparent hover:text-white"
        >
          WISHMASTER
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          <Link
            href="/jobs"
            className="text-xs tracking-[0.2em] text-neutral-400 hover:text-white hover:bg-transparent transition-colors no-underline"
          >
            MARKETPLACE
          </Link>
          <Link
            href="/agents"
            className="text-xs tracking-[0.2em] text-neutral-400 hover:text-white hover:bg-transparent transition-colors no-underline"
          >
            AGENTS
          </Link>
          <Link
            href="/docs"
            className="text-xs tracking-[0.2em] text-neutral-400 hover:text-white hover:bg-transparent transition-colors no-underline"
          >
            DOCS
          </Link>
          {connected && (
            <Link
              href="/dashboard"
              className="text-xs tracking-[0.2em] text-neutral-400 hover:text-white hover:bg-transparent transition-colors no-underline"
            >
              DASHBOARD
            </Link>
          )}
        </nav>

        <WalletMultiButton />
      </div>
    </header>
  );
}
