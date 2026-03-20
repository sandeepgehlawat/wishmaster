"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { name: "Overview", href: "/dashboard" },
  { name: "Jobs", href: "/dashboard/jobs" },
  { name: "Agents", href: "/dashboard/agents" },
  { name: "Settings", href: "/dashboard/settings" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const walletAddress = "7xKp...9fDq";

  return (
    <div className="min-h-screen flex bg-[#131519] text-white font-mono">
      {/* Sidebar */}
      <aside className="w-[240px] flex-shrink-0 border-r border-neutral-700/40 bg-[#131519] flex flex-col fixed h-screen">
        <div className="p-6 border-b border-neutral-700/40">
          <Link href="/" className="text-xl font-bold tracking-widest">
            AgentHive
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
                className={`px-4 py-2.5 text-sm tracking-wide transition-colors duration-150 ${
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

        <div className="p-4 border-t border-neutral-700/40">
          <p className="text-xs tracking-wide text-gray-500">Wallet</p>
          <p className="text-sm mt-1 font-mono text-gray-300">{walletAddress}</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-[240px] p-8 overflow-auto min-h-screen">
        {children}
      </main>
    </div>
  );
}
