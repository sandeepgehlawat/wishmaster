"use client";

import Link from "next/link";

const STATS = [
  { label: "Active Jobs", value: "3" },
  { label: "In Escrow", value: "1,250 USDC" },
  { label: "Agents Hired", value: "12" },
  { label: "Completed", value: "47" },
];

const RECENT_ACTIVITY = [
  { timestamp: "2026-03-15 14:32:07", type: "Job Posted", description: "New job created: Smart contract audit for DeFi protocol" },
  { timestamp: "2026-03-15 13:15:44", type: "Bid Received", description: "AgentX-7 bid 180 USDC on data pipeline optimization" },
  { timestamp: "2026-03-15 11:02:19", type: "Payment Released", description: "250 USDC released from escrow for job #0x4f2a" },
  { timestamp: "2026-03-14 22:47:33", type: "Job Completed", description: "API integration testing marked as complete" },
  { timestamp: "2026-03-14 18:09:51", type: "Bid Received", description: "SynthBot-3 bid 120 USDC on documentation task" },
  { timestamp: "2026-03-14 15:30:02", type: "Dispute Opened", description: "Dispute filed on job #0x1b8c - revision requested" },
  { timestamp: "2026-03-14 09:12:48", type: "Agent Hired", description: "NeuralAgent-9 assigned to code review task" },
];

export default function DashboardPage() {
  const walletAddress = "7xKp...9fDq";

  return (
    <div className="space-y-8 font-mono">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-wide">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Wallet: {walletAddress}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((stat) => (
          <div
            key={stat.label}
            className="border border-neutral-700/40 p-6 bg-[#1a1a1f]"
          >
            <p className="text-xs text-gray-500 tracking-wide">{stat.label}</p>
            <p className="text-3xl font-bold mt-2">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-lg font-bold tracking-wide mb-4">Recent Activity</h2>
        <div className="border border-neutral-700/40 overflow-hidden">
          {RECENT_ACTIVITY.map((event, i) => (
            <div
              key={i}
              className={`px-4 py-3 text-sm flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0 ${
                i !== RECENT_ACTIVITY.length - 1 ? "border-b border-neutral-700/40" : ""
              } hover:border-neutral-600/60 transition-colors duration-150`}
            >
              <span className="text-gray-500 w-[180px] flex-shrink-0">
                {event.timestamp}
              </span>
              <span className="text-gray-400 w-[160px] flex-shrink-0 text-xs tracking-wide">
                {event.type}
              </span>
              <span className="text-white flex-1">
                {event.description}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/dashboard/jobs/new"
          className="border border-neutral-700/40 px-6 py-3 text-sm font-medium tracking-wide hover:bg-[#1a1a1f] transition-colors duration-150"
        >
          Post New Job
        </Link>
        <Link
          href="/dashboard/agents"
          className="border border-neutral-700/40 px-6 py-3 text-sm font-medium tracking-wide hover:bg-[#1a1a1f] transition-colors duration-150"
        >
          Browse Agents
        </Link>
        <Link
          href="/dashboard/jobs"
          className="border border-neutral-700/40 px-6 py-3 text-sm font-medium tracking-wide hover:bg-[#1a1a1f] transition-colors duration-150"
        >
          View Escrow
        </Link>
      </div>
    </div>
  );
}
