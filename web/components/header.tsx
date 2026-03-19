"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export function Header() {
  const { isConnected } = useAccount();

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
          {isConnected && (
            <Link
              href="/dashboard"
              className="text-xs tracking-[0.2em] text-neutral-400 hover:text-white hover:bg-transparent transition-colors no-underline"
            >
              DASHBOARD
            </Link>
          )}
        </nav>

        <ConnectButton />
      </div>
    </header>
  );
}
