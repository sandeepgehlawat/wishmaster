"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Menu, X } from "lucide-react";

const NAV_ITEMS = [
  { name: "OVERVIEW", href: "/dashboard" },
  { name: "JOBS", href: "/dashboard/jobs" },
  { name: "SERVICES", href: "/dashboard/services" },
  { name: "AGENTS", href: "/dashboard/agents" },
  { name: "SETTINGS", href: "/dashboard/settings" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { isConnected, address } = useAccount();
  const { isAuthenticated, isLoading, signIn, signOut, error } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "NOT_CONNECTED";

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Lock body scroll when sidebar open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  // Not connected - show connect prompt
  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#131519] text-white font-mono px-4">
        <div className="text-center max-w-md p-8 border border-neutral-700/40 bg-[#1a1a1f]">
          <h1 className="text-2xl font-bold tracking-wider mb-4">
            {">>> CONNECT_WALLET"}
          </h1>
          <p className="text-sm text-neutral-400 mb-8">
            Connect your wallet to access the dashboard.
          </p>
          <ConnectButton />
          <p className="text-xs text-neutral-500 mt-6">
            SUPPORTED: METAMASK, OKXWALLET
          </p>
        </div>
      </div>
    );
  }

  // Connected but loading auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#131519] text-white font-mono px-4">
        <div className="text-center max-w-md p-8 border border-neutral-700/40 bg-[#1a1a1f]">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <h1 className="text-xl font-bold tracking-wider mb-2">
            AUTHENTICATING...
          </h1>
          <p className="text-sm text-neutral-400">
            Please approve the signature request in your wallet.
          </p>
        </div>
      </div>
    );
  }

  // Connected but not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#131519] text-white font-mono px-4">
        <div className="text-center max-w-md p-8 border border-neutral-700/40 bg-[#1a1a1f]">
          <h1 className="text-2xl font-bold tracking-wider mb-4">
            {">>> VERIFY_IDENTITY"}
          </h1>
          <p className="text-sm text-neutral-400 mb-4">
            Sign a message to prove wallet ownership.
          </p>
          {error && (
            <div className="border border-neutral-700/40 bg-[#131519] p-3 mb-6 text-left">
              <p className="text-xs text-neutral-300">{error}</p>
            </div>
          )}
          <button
            onClick={signIn}
            className="bg-white text-black px-6 py-3 text-sm font-bold tracking-wider hover:bg-neutral-200 transition-colors"
          >
            [SIGN IN]
          </button>
          <p className="text-xs text-neutral-500 mt-6">
            NO GAS FEES * NO PERMISSIONS * JUST A SIGNATURE
          </p>
        </div>
      </div>
    );
  }

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(href + "/");
  };

  const sidebarContent = (
    <>
      <div className="p-6 border-b border-neutral-700/40">
        <Link href="/" className="text-xl font-bold tracking-widest hover:bg-transparent hover:text-white no-underline">
          WISHMASTER
        </Link>
      </div>

      {/* Post Job Button */}
      <div className="p-4 border-b border-neutral-700/40">
        <Link
          href="/dashboard/jobs/new"
          className="block w-full text-center bg-white text-black px-4 py-3 text-sm font-bold tracking-wider hover:bg-neutral-200 transition-colors no-underline"
        >
          [+ POST JOB]
        </Link>
      </div>

      <nav className="flex-1 flex flex-col py-2 gap-0.5 px-2" aria-label="Dashboard navigation">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className={`px-6 py-3 text-sm tracking-wider transition-colors hover:no-underline ${
              isActive(item.href)
                ? "bg-[#1a1a1f] text-white border-l-2 border-secondary-400"
                : "text-neutral-400 hover:bg-[#1a1a1f] hover:text-white"
            }`}
            aria-current={isActive(item.href) ? "page" : undefined}
          >
            {item.name}
          </Link>
        ))}
      </nav>

      {/* Wallet Info */}
      <div className="p-4 border-t border-neutral-700/40">
        <p className="text-xs tracking-wider text-neutral-500 mb-2">CONNECTED_WALLET</p>
        <p className="text-sm font-mono mb-3 text-neutral-300">{shortAddress}</p>
        <button
          onClick={signOut}
          className="w-full border border-neutral-700/40 px-3 py-2 text-xs font-bold tracking-wider text-neutral-400 hover:border-neutral-500 hover:text-white transition-colors"
        >
          [DISCONNECT]
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#131519] text-white font-mono">
      {/* Mobile top bar */}
      <div className="md:hidden h-14 border-b border-neutral-700/40 bg-[#131519] px-4 flex items-center justify-between sticky top-0 z-30 gap-2">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 -ml-2 hover:bg-[#1a1a1f] transition-colors flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Open sidebar"
        >
          <Menu className="h-6 w-6" />
        </button>
        <Link href="/" className="text-lg font-bold tracking-widest hover:bg-transparent hover:text-white flex-shrink-0 no-underline">
          WISHMASTER
        </Link>
        <span className="text-[10px] text-neutral-500 tracking-wider flex-shrink-0">{shortAddress}</span>
      </div>

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex w-[240px] flex-shrink-0 border-r border-neutral-700/40 bg-[#0e1015] flex-col fixed h-screen">
          {sidebarContent}
        </aside>

        {/* Mobile Sidebar Backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Mobile Sidebar Drawer */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-[260px] bg-[#0e1015] border-r border-neutral-700/40 flex flex-col transition-transform duration-300 md:hidden ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          role="dialog"
          aria-modal="true"
          aria-label="Sidebar navigation"
        >
          <div className="flex items-center justify-between p-4 border-b border-neutral-700/40">
            <Link href="/" className="text-lg font-bold tracking-widest hover:bg-transparent hover:text-white no-underline">
              WISHMASTER
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 hover:bg-[#1a1a1f] transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Post Job Button */}
          <div className="p-4 border-b border-neutral-700/40">
            <Link
              href="/dashboard/jobs/new"
              className="block w-full text-center bg-white text-black px-4 py-3 text-sm font-bold tracking-wider hover:bg-neutral-200 transition-colors no-underline"
            >
              [+ POST JOB]
            </Link>
          </div>

          <nav className="flex-1 flex flex-col py-2 gap-0.5 px-2" aria-label="Dashboard navigation">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`px-6 py-3 text-sm tracking-wider transition-colors hover:no-underline min-h-[48px] flex items-center ${
                  isActive(item.href)
                    ? "bg-[#1a1a1f] text-white border-l-2 border-secondary-400"
                    : "text-neutral-400 hover:bg-[#1a1a1f] hover:text-white"
                }`}
                aria-current={isActive(item.href) ? "page" : undefined}
              >
                {item.name}
              </Link>
            ))}
          </nav>

          {/* Wallet Info */}
          <div className="p-4 border-t border-neutral-700/40">
            <p className="text-xs tracking-wider text-neutral-500 mb-2">CONNECTED_WALLET</p>
            <p className="text-sm font-mono mb-3 text-neutral-300">{shortAddress}</p>
            <button
              onClick={signOut}
              className="w-full border border-neutral-700/40 px-3 py-2 text-xs font-bold tracking-wider text-neutral-400 hover:border-neutral-500 hover:text-white transition-colors"
            >
              [DISCONNECT]
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 md:ml-[240px] p-4 md:p-8 overflow-x-hidden min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
}
