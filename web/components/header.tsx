"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
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
    { href: "/features", label: "FEATURES" },
    { href: "/jobs", label: "MARKETPLACE" },
    { href: "/agents", label: "AGENTS" },
    { href: "/docs", label: "DOCS" },
    ...(isConnected ? [{ href: "/dashboard", label: "DASHBOARD" }] : []),
  ];

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <header className="border-b-2 border-white sticky top-0 z-50 bg-[#131519]" role="banner">
      <div className="max-w-[1400px] mx-auto flex items-center justify-between px-4 sm:px-6 h-14 gap-2">
        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen(true)}
          className="md:hidden p-2 -ml-2 hover:bg-white hover:text-black transition-colors flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Open navigation menu"
        >
          <Menu className="h-6 w-6" />
        </button>

        <Link
          href="/"
          className="flex items-center gap-2 text-lg sm:text-xl font-bold tracking-[0.3em] uppercase hover:bg-transparent hover:text-white flex-shrink-0"
          aria-label="WishMaster home"
        >
          <Image src="/Logo Wishmaster.png" alt="WishMaster logo" width={32} height={32} className="w-7 h-7 sm:w-8 sm:h-8" />
          WISHMASTER
        </Link>

        <nav className="hidden md:flex items-center gap-8" aria-label="Main navigation">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`nav-link text-xs tracking-[0.2em] hover:text-white hover:bg-transparent transition-colors no-underline whitespace-nowrap ${
                isActive(link.href)
                  ? "text-white"
                  : "text-neutral-400"
              }`}
              aria-current={isActive(link.href) ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex-shrink-0 [&_button]:!text-[10px] [&_button]:!px-3 [&_button]:!py-1.5 sm:[&_button]:!text-xs sm:[&_button]:!px-4 sm:[&_button]:!py-2">
          <ConnectButton />
        </div>
      </div>

      {/* Mobile drawer overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 bg-[#131519] md:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div className="flex items-center justify-between px-4 h-14 border-b-2 border-white">
            <span className="flex items-center gap-2 text-xl font-bold tracking-[0.3em] uppercase">
              <Image src="/Logo Wishmaster.png" alt="WishMaster logo" width={32} height={32} className="w-8 h-8" />
              WISHMASTER
            </span>
            <button
              onClick={() => setMenuOpen(false)}
              className="p-2 -mr-2 hover:bg-white hover:text-black transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Close navigation menu"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <nav className="flex flex-col p-6 gap-1" aria-label="Mobile navigation">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm tracking-[0.2em] hover:text-white hover:bg-transparent transition-colors no-underline py-4 border-b border-white/10 min-h-[48px] flex items-center ${
                  isActive(link.href)
                    ? "text-white"
                    : "text-neutral-400"
                }`}
                aria-current={isActive(link.href) ? "page" : undefined}
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-6">
              <ConnectButton />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
