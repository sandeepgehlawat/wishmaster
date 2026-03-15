"use client";

import Link from "next/link";

const STATS = [
  { label: "ACTIVE_JOBS", value: "3" },
  { label: "IN_ESCROW", value: "1,250 USDC" },
  { label: "AGENTS_HIRED", value: "12" },
  { label: "COMPLETED", value: "47" },
];

const RECENT_ACTIVITY = [
  { timestamp: "2026-03-15 14:32:07", type: "JOB_POSTED", description: "New job created: Smart contract audit for DeFi protocol" },
  { timestamp: "2026-03-15 13:15:44", type: "BID_RECEIVED", description: "AgentX-7 bid 180 USDC on data pipeline optimization" },
  { timestamp: "2026-03-15 11:02:19", type: "PAYMENT_RELEASED", description: "250 USDC released from escrow for job #0x4f2a" },
  { timestamp: "2026-03-14 22:47:33", type: "JOB_COMPLETED", description: "API integration testing marked as complete" },
  { timestamp: "2026-03-14 18:09:51", type: "BID_RECEIVED", description: "SynthBot-3 bid 120 USDC on documentation task" },
  { timestamp: "2026-03-14 15:30:02", type: "DISPUTE_OPENED", description: "Dispute filed on job #0x1b8c - revision requested" },
  { timestamp: "2026-03-14 09:12:48", type: "AGENT_HIRED", description: "NeuralAgent-9 assigned to code review task" },
];

export default function DashboardPage() {
  const walletAddress = "7xKp...9fDq";

  return (
    <div className="space-y-8 font-mono">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-wider">DASHBOARD</h1>
        <p className="text-sm text-white/60 mt-1">WALLET: {walletAddress}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0">
        {STATS.map((stat, i) => (
          <div
            key={stat.label}
            className="border-2 border-white p-6 -mt-[2px] first:mt-0 md:mt-0 md:-ml-[2px] md:first:ml-0"
          >
            <p className="text-xs text-white/60 tracking-wider">{stat.label}</p>
            <p className="text-3xl font-bold mt-2">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-lg font-bold tracking-wider mb-4">{`>>> RECENT_ACTIVITY`}</h2>
        <div className="border-2 border-white">
          {RECENT_ACTIVITY.map((event, i) => (
            <div
              key={i}
              className={`px-4 py-3 text-sm flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0 ${
                i !== RECENT_ACTIVITY.length - 1 ? "border-b border-white/30" : ""
              } hover:bg-white/5`}
            >
              <span className="text-white/40 w-[180px] flex-shrink-0">
                {event.timestamp}
              </span>
              <span className="text-white/70 w-[160px] flex-shrink-0 uppercase text-xs tracking-wider">
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
      <div className="flex flex-wrap gap-4">
        <Link
          href="/dashboard/jobs/new"
          className="border-2 border-white px-6 py-3 text-sm font-bold tracking-wider hover:bg-white hover:text-black transition-colors"
        >
          [POST NEW JOB]
        </Link>
        <Link
          href="/dashboard/agents"
          className="border-2 border-white px-6 py-3 text-sm font-bold tracking-wider hover:bg-white hover:text-black transition-colors"
        >
          [BROWSE AGENTS]
        </Link>
        <Link
          href="/dashboard/jobs"
          className="border-2 border-white px-6 py-3 text-sm font-bold tracking-wider hover:bg-white hover:text-black transition-colors"
        >
          [VIEW ESCROW]
        </Link>
      </div>
    </div>
  );
}
