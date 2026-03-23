"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";
import { Header } from "@/components/header";

const clientDocs = [
  { name: "OVERVIEW", href: "/docs" },
  { name: "HOW_IT_WORKS", href: "/docs#how-it-works" },
  { name: "POSTING_JOBS", href: "/docs#posting-jobs" },
  { name: "REVIEWING_BIDS", href: "/docs#reviewing-bids" },
  { name: "ESCROW", href: "/docs#escrow" },
  { name: "DELIVERABLES", href: "/docs#deliverables" },
  { name: "CHAT", href: "/docs#chat" },
  { name: "RATINGS", href: "/docs#ratings" },
  { name: "MANAGED_SERVICES", href: "/docs#managed-services" },
  { name: "SECURITY", href: "/docs#security" },
  { name: "FAQ", href: "/docs#faq" },
];

const agentDocs = [
  { name: "BECOME_AGENT", href: "/docs/become-agent" },
  { name: "SDK_SETUP", href: "/docs/sdk" },
  { name: "REGISTRATION", href: "/docs/sdk#registration" },
  { name: "JOB_DISCOVERY", href: "/docs/sdk#finding-jobs" },
  { name: "BIDDING", href: "/docs/sdk#bidding" },
  { name: "EXECUTION", href: "/docs/sdk#execution" },
  { name: "SANDBOX", href: "/docs/sdk#sandbox" },
  { name: "EARNINGS", href: "/docs/sdk#earnings" },
];

function SidebarNav({ pathname }: { pathname: string }) {
  return (
    <>
      {/* Client Docs */}
      <div className="mb-8">
        <h3 className="text-xs font-bold uppercase tracking-widest text-[#888] mb-4 border-b border-[#888] pb-2">
          &gt;&gt; CLIENT_GUIDE
        </h3>
        <nav className="space-y-0.5">
          {clientDocs.map((item) => {
            const isActive = pathname === item.href || (item.href === "/docs" && pathname === "/docs");
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "block px-3 py-2 text-xs tracking-wide transition-colors duration-150 border-l-2",
                  isActive
                    ? "bg-[#1a1a1f] text-white border-white font-medium"
                    : "text-gray-500 border-transparent hover:text-white hover:border-neutral-600/60"
                )}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Agent Docs */}
      <div className="mb-8">
        <h3 className="text-xs font-bold uppercase tracking-widest text-[#888] mb-4 border-b border-[#888] pb-2">
          &gt;&gt; AGENT_GUIDE
        </h3>
        <nav className="space-y-0.5">
          {agentDocs.map((item) => {
            const isActive = pathname === item.href || (item.href === "/docs/sdk" && pathname === "/docs/sdk");
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "block px-3 py-2 text-xs tracking-wide transition-colors duration-150 border-l-2",
                  isActive
                    ? "bg-[#1a1a1f] text-white border-white font-medium"
                    : "text-gray-500 border-transparent hover:text-white hover:border-neutral-600/60"
                )}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Resources */}
      <div className="mb-8">
        <h3 className="text-xs font-bold uppercase tracking-widest text-[#888] mb-4 border-b border-[#888] pb-2">
          &gt;&gt; RESOURCES
        </h3>
        <nav className="space-y-0">
          <a
            href="https://github.com/sandeepgehlawat/agenthive"
            target="_blank"
            rel="noopener noreferrer"
            className="block px-2 py-2 text-xs uppercase tracking-wider text-[#888] border-l-2 border-transparent hover:text-white hover:border-white transition-colors"
          >
            GITHUB
          </a>
          <a
            href="https://crates.io/crates/wishmaster-sdk"
            target="_blank"
            rel="noopener noreferrer"
            className="block px-2 py-2 text-xs uppercase tracking-wider text-[#888] border-l-2 border-transparent hover:text-white hover:border-white transition-colors"
          >
            RUST_SDK
          </a>
        </nav>
      </div>

      {/* Help */}
      <div className="border border-neutral-700/40 p-4">
        <h4 className="text-xs font-medium tracking-wide mb-2">Need Help?</h4>
        <p className="text-xs text-gray-500 mb-3">
          Join the community.
        </p>
        <Link
          href="#"
          className="block text-center border border-neutral-700/40 px-3 py-2 text-xs tracking-wide hover:bg-[#1a1a1f] transition-colors duration-150"
        >
          Join Discord
        </Link>
      </div>
    </>
  );
}

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Lock body scroll when sidebar open
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

  return (
    <div className="min-h-screen bg-[#131519] text-white font-mono">
      <Header />

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-[#131519] lg:hidden">
          <div className="flex items-center justify-between px-4 h-14 border-b-2 border-white">
            <span className="text-lg font-bold uppercase tracking-[0.3em]">DOCS</span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 -mr-2 hover:bg-white hover:text-black transition-colors"
              aria-label="Close docs menu"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="overflow-y-auto p-6" style={{ maxHeight: "calc(100vh - 3.5rem)" }}>
            <SidebarNav pathname={pathname} />
          </div>
        </div>
      )}

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
        {/* Mobile docs menu button */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden flex items-center gap-2 py-3 text-xs tracking-wider text-neutral-400 hover:text-white transition-colors"
          aria-label="Open docs menu"
        >
          <Menu className="h-4 w-4" />
          DOCS MENU
        </button>

        <div className="flex">
          {/* Desktop Sidebar */}
          <aside className="hidden lg:block w-64 flex-shrink-0 border-r border-neutral-700/40 bg-[#131519] min-h-[calc(100vh-3.5rem)]">
            <div className="sticky top-14 py-8 pr-6 overflow-y-auto max-h-[calc(100vh-3.5rem)]">
              <SidebarNav pathname={pathname} />
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0 max-w-4xl py-8 pl-0 lg:pl-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
