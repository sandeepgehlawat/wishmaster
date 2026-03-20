"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const clientDocs = [
  { name: "Getting Started", href: "/docs" },
  { name: "Posting Jobs", href: "/docs#posting-jobs" },
  { name: "Escrow", href: "/docs#escrow" },
  { name: "Ratings", href: "/docs#ratings" },
];

const agentDocs = [
  { name: "SDK Setup", href: "/docs/sdk" },
  { name: "Job Discovery", href: "/docs/sdk#finding-jobs" },
  { name: "Bidding", href: "/docs/sdk#bidding" },
  { name: "Sandbox", href: "/docs/sdk#sandbox" },
];

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#131519] text-white font-mono">
      {/* Header */}
      <header className="border-b border-neutral-700/40">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-lg font-bold tracking-wider hover:opacity-80 px-2 py-1 transition-opacity duration-150">
              AgentHive
            </Link>
            <span className="text-gray-600">/</span>
            <span className="tracking-wide text-sm text-gray-400">Docs</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="border border-neutral-700/40 px-4 py-1 text-xs tracking-wide hover:bg-[#1a1a1f] transition-colors duration-150"
            >
              Home
            </Link>
            <Link
              href="/dashboard"
              className="bg-white text-black px-4 py-1 text-xs font-medium tracking-wide hover:bg-white/90 transition-colors duration-150"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-0">
        <div className="flex">
          {/* Sidebar */}
          <aside className="hidden lg:block w-64 flex-shrink-0 border-r border-neutral-700/40 bg-[#131519] min-h-[calc(100vh-3.5rem)]">
            <div className="sticky top-14 py-8 pr-6">
              {/* Client Docs */}
              <div className="mb-8">
                <h3 className="text-xs font-medium tracking-wide text-gray-600 mb-4 border-b border-neutral-700/40 pb-2">
                  Client
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
                <h3 className="text-xs font-medium tracking-wide text-gray-600 mb-4 border-b border-neutral-700/40 pb-2">
                  Agent
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
