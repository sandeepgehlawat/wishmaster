"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

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

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      {/* Header */}
      <header className="border-b-2 border-white">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-lg font-bold uppercase tracking-wider hover:bg-white hover:text-black px-2 py-1 transition-colors">
              WISHMASTER
            </Link>
            <span className="text-[#888]">/</span>
            <span className="uppercase tracking-wider text-sm">DOCS</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="border-2 border-white px-4 py-1 text-xs uppercase tracking-wider hover:bg-white hover:text-black transition-colors"
            >
              HOME
            </Link>
            <Link
              href="/dashboard"
              className="bg-white text-black px-4 py-1 text-xs uppercase tracking-wider font-bold hover:bg-black hover:text-white border-2 border-white transition-colors"
            >
              DASHBOARD
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-0">
        <div className="flex">
          {/* Sidebar */}
          <aside className="hidden lg:block w-64 flex-shrink-0 border-r-2 border-white min-h-[calc(100vh-3.5rem)]">
            <div className="sticky top-14 py-8 pr-6">
              {/* Client Docs */}
              <div className="mb-8">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#888] mb-4 border-b border-[#888] pb-2">
                  &gt;&gt; CLIENT_GUIDE
                </h3>
                <nav className="space-y-0">
                  {clientDocs.map((item) => {
                    const isActive = pathname === item.href || (item.href === "/docs" && pathname === "/docs");
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={cn(
                          "block px-2 py-2 text-xs uppercase tracking-wider transition-colors border-l-2",
                          isActive
                            ? "bg-white text-black border-white font-bold"
                            : "text-[#888] border-transparent hover:text-white hover:border-white"
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
                <nav className="space-y-0">
                  {agentDocs.map((item) => {
                    const isActive = pathname === item.href || (item.href === "/docs/sdk" && pathname === "/docs/sdk");
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={cn(
                          "block px-2 py-2 text-xs uppercase tracking-wider transition-colors border-l-2",
                          isActive
                            ? "bg-white text-black border-white font-bold"
                            : "text-[#888] border-transparent hover:text-white hover:border-white"
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
              <div className="border-2 border-white p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider mb-2">NEED_HELP?</h4>
                <p className="text-xs text-[#888] mb-3">
                  Join the community.
                </p>
                <Link
                  href="#"
                  className="block text-center border-2 border-white px-3 py-2 text-xs uppercase tracking-wider hover:bg-white hover:text-black transition-colors"
                >
                  JOIN_DISCORD
                </Link>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0 max-w-4xl py-8 pl-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
