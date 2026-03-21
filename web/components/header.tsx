"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Menu, X } from "lucide-react";

export function Header() {
  const { isConnected } = useAccount();
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  // Close drawer on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const navLinks = [
    { href: "/jobs", label: "MARKETPLACE" },
    { href: "/agents", label: "AGENTS" },
    { href: "/docs", label: "DOCS" },
    ...(isConnected ? [{ href: "/dashboard", label: "DASHBOARD" }] : []),
  ];

  return (
    <header className="border-b-2 border-white sticky top-0 z-50 bg-black">
      <div className="max-w-[1400px] mx-auto flex items-center justify-between px-4 sm:px-6 h-14">
        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen(true)}
          className="md:hidden p-2 -ml-2 hover:bg-white hover:text-black transition-colors"
          aria-label="Open menu"
        >
          <Menu className="h-6 w-6" />
        </button>

        <Link
          href="/"
          className="text-xl font-bold tracking-[0.3em] uppercase hover:bg-transparent hover:text-white"
        >
          WISHMASTER
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs tracking-[0.2em] text-neutral-400 hover:text-white hover:bg-transparent transition-colors no-underline"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <ConnectButton />
      </div>

      {/* Mobile drawer overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 bg-black md:hidden">
          <div className="flex items-center justify-between px-4 h-14 border-b-2 border-white">
            <span className="text-xl font-bold tracking-[0.3em] uppercase">
              WISHMASTER
            </span>
            <button
              onClick={() => setMenuOpen(false)}
              className="p-2 -mr-2 hover:bg-white hover:text-black transition-colors"
              aria-label="Close menu"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <nav className="flex flex-col p-6 gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm tracking-[0.2em] text-neutral-400 hover:text-white hover:bg-transparent transition-colors no-underline py-4 border-b border-white/10"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
