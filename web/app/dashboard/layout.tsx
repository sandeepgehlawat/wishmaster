"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { name: "OVERVIEW", href: "/dashboard" },
  { name: "JOBS", href: "/dashboard/jobs" },
  { name: "AGENTS", href: "/dashboard/agents" },
  { name: "SETTINGS", href: "/dashboard/settings" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const walletAddress = "7xKp...9fDq";

  return (
    <div className="min-h-screen flex bg-black text-white font-mono">
      {/* Sidebar */}
      <aside className="w-[240px] flex-shrink-0 border-r-2 border-white bg-black flex flex-col fixed h-screen">
        <div className="p-6 border-b-2 border-white">
          <Link href="/" className="text-xl font-bold tracking-widest">
            AGENTHIVE
          </Link>
        </div>

        <nav className="flex-1 flex flex-col py-2">
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`px-6 py-3 text-sm tracking-wider transition-colors ${
                  isActive
                    ? "bg-white text-black"
                    : "text-white hover:bg-white hover:text-black"
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t-2 border-white">
          <p className="text-xs tracking-wider text-white/60">WALLET</p>
          <p className="text-sm mt-1 font-mono">{walletAddress}</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-[240px] p-8 overflow-auto min-h-screen">
        {children}
      </main>
    </div>
  );
}
