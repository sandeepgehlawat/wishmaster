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
      <div className="min-h-screen flex items-center justify-center bg-black text-white font-mono">
        <div className="text-center max-w-md p-8 border-2 border-white">
          <h1 className="text-2xl font-bold tracking-wider mb-4">
            {">>> CONNECT_WALLET"}
          </h1>
          <p className="text-sm text-white/60 mb-8">
            Connect your wallet to access the dashboard.
          </p>
          <ConnectButton />
          <p className="text-xs text-white/40 mt-6">
            SUPPORTED: METAMASK, OKXWALLET
          </p>
        </div>
      </div>
    );
  }

  // Connected but loading auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white font-mono">
        <div className="text-center max-w-md p-8 border-2 border-white">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <h1 className="text-xl font-bold tracking-wider mb-2">
            AUTHENTICATING...
          </h1>
          <p className="text-sm text-white/60">
            Please approve the signature request in your wallet.
          </p>
        </div>
      </div>
    );
  }

  // Connected but not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white font-mono">
        <div className="text-center max-w-md p-8 border-2 border-white">
          <h1 className="text-2xl font-bold tracking-wider mb-4">
            {">>> VERIFY_IDENTITY"}
          </h1>
          <p className="text-sm text-white/60 mb-4">
            Sign a message to prove wallet ownership.
          </p>
          {error && (
            <div className="border-2 border-white bg-white/10 p-3 mb-6 text-left">
              <p className="text-xs text-white/80">{error}</p>
            </div>
          )}
          <button
            onClick={signIn}
            className="border-2 border-white px-6 py-3 text-sm font-bold tracking-wider bg-white text-black hover:bg-black hover:text-white transition-colors"
          >
            [SIGN IN]
          </button>
          <p className="text-xs text-white/40 mt-6">
            NO GAS FEES * NO PERMISSIONS * JUST A SIGNATURE
          </p>
        </div>
      </div>
    );
  }

  const sidebarContent = (
    <>
      <div className="p-6 border-b-2 border-white">
        <Link href="/" className="text-xl font-bold tracking-widest hover:bg-transparent hover:text-white">
          WISHMASTER
        </Link>
      </div>

      {/* Post Job Button */}
      <div className="p-4 border-b border-white/20">
        <Link
          href="/dashboard/jobs/new"
          className="block w-full text-center border-2 border-white px-4 py-3 text-sm font-bold tracking-wider bg-white text-black hover:bg-black hover:text-white transition-colors"
        >
          [+ POST JOB]
        </Link>
      </div>

      <nav className="flex-1 flex flex-col py-2 gap-0.5 px-2">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`px-6 py-3 text-sm tracking-wider transition-colors hover:no-underline ${
                isActive
                  ? "bg-[#1a1a1f] text-white border-l-2 border-white"
                  : "text-neutral-400 hover:bg-[#1a1a1f] hover:text-white"
              }`}
            >
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Wallet Info */}
      <div className="p-4 border-t-2 border-white">
        <p className="text-xs tracking-wider text-white/60 mb-2">CONNECTED_WALLET</p>
        <p className="text-sm font-mono mb-3">{shortAddress}</p>
        <button
          onClick={signOut}
          className="w-full border-2 border-white px-3 py-2 text-xs font-bold tracking-wider hover:bg-white hover:text-black transition-colors"
        >
          [DISCONNECT]
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#131519] text-white font-mono">
      {/* Mobile top bar */}
      <div className="md:hidden h-14 border-b-2 border-white bg-black px-4 flex items-center justify-between sticky top-0 z-30">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 -ml-2 hover:bg-white hover:text-black transition-colors"
          aria-label="Open sidebar"
        >
          <Menu className="h-6 w-6" />
        </button>
        <Link href="/" className="text-lg font-bold tracking-widest hover:bg-transparent hover:text-white">
          WISHMASTER
        </Link>
        <span className="text-xs text-white/60 tracking-wider">{shortAddress}</span>
      </div>

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex w-[240px] flex-shrink-0 border-r-2 border-white bg-black flex-col fixed h-screen">
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
          className={`fixed inset-y-0 left-0 z-40 w-[240px] bg-black border-r-2 border-white flex flex-col transition-transform duration-300 md:hidden ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between p-4 border-b-2 border-white">
            <Link href="/" className="text-lg font-bold tracking-widest hover:bg-transparent hover:text-white">
              WISHMASTER
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1 hover:bg-white hover:text-black transition-colors"
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Post Job Button */}
          <div className="p-4 border-b border-white/20">
            <Link
              href="/dashboard/jobs/new"
              className="block w-full text-center border-2 border-white px-4 py-3 text-sm font-bold tracking-wider bg-white text-black hover:bg-black hover:text-white transition-colors"
            >
              [+ POST JOB]
            </Link>
          </div>

          <nav className="flex-1 flex flex-col py-2 gap-0.5 px-2">
            {NAV_ITEMS.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`px-6 py-3 text-sm tracking-wider transition-colors hover:no-underline ${
                    isActive
                      ? "bg-[#1a1a1f] text-white border-l-2 border-white"
                      : "text-neutral-400 hover:bg-[#1a1a1f] hover:text-white"
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Wallet Info */}
          <div className="p-4 border-t-2 border-white">
            <p className="text-xs tracking-wider text-white/60 mb-2">CONNECTED_WALLET</p>
            <p className="text-sm font-mono mb-3">{shortAddress}</p>
            <button
              onClick={signOut}
              className="w-full border-2 border-white px-3 py-2 text-xs font-bold tracking-wider hover:bg-white hover:text-black transition-colors"
            >
              [DISCONNECT]
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 md:ml-[240px] p-4 md:p-8 overflow-auto min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
}
