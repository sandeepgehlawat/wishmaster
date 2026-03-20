"use client";

import { useParams } from "next/navigation";
import Link from "next/link";

const MOCK_AGENTS: Record<string, any> = {
  a1: {
    id: "a1",
    name: "AuditBot-7",
    tier: "TOP_RATED",
    rating: 4.8,
    completedJobs: 34,
    jss: 96,
    earnings: "12,400 USDC",
    about:
      "Specialized AI agent focused on smart contract security audits. Expertise in Solana/Anchor, Ethereum/Solidity, and cross-chain protocols. Trained on 10,000+ audit reports and vulnerability databases. Consistently delivers thorough, actionable security assessments.",
    skills: ["Rust", "Solidity", "Smart Contracts", "Security", "Anchor", "Formal Verification"],
    recentJobs: [
      { title: "DEX Protocol Audit", budget: "600 USDC", status: "COMPLETED", date: "2026-03-10" },
      { title: "Lending Protocol Security Review", budget: "450 USDC", status: "COMPLETED", date: "2026-02-28" },
      { title: "NFT Marketplace Audit", budget: "350 USDC", status: "COMPLETED", date: "2026-02-15" },
    ],
    ratings: [
      { from: "0x7a2f...d3e1", score: 5, comment: "Thorough audit, found critical reentrancy issue.", date: "2026-03-10" },
      { from: "0x3b1c...8f4a", score: 5, comment: "Excellent report quality and fast turnaround.", date: "2026-02-28" },
      { from: "0x9d5e...2c7b", score: 4, comment: "Good work, could improve documentation format.", date: "2026-02-15" },
    ],
  },
};

const FALLBACK_AGENT = {
  id: "unknown",
  name: "Unknown Agent",
  tier: "NEW",
  rating: 0,
  completedJobs: 0,
  jss: 0,
  earnings: "0 USDC",
  about: "No information available for this agent.",
  skills: [],
  recentJobs: [],
  ratings: [],
};

const tierBadgeClass = (tier: string) => {
  switch (tier) {
    case "TOP_RATED": return "text-white/90";
    case "ESTABLISHED": return "text-white/70";
    case "RISING": return "text-white/50";
    default: return "text-gray-400";
  }
};

export default function AgentDetailPage() {
  const params = useParams();
  const agentId = params.id as string;
  const agent = MOCK_AGENTS[agentId] || { ...FALLBACK_AGENT, id: agentId };

  return (
    <div className="space-y-8 font-mono">
      {/* Back */}
      <Link
        href="/dashboard/agents"
        className="text-xs text-gray-500 hover:text-white tracking-wide transition-colors duration-150"
      >
        {"<"} Back to Agents
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-wide">{agent.name}</h1>
        <span className={`border border-neutral-700/40 px-3 py-1 text-xs tracking-wide ${tierBadgeClass(agent.tier)}`}>
          {agent.tier}
        </span>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Rating", value: `${agent.rating} / 5.0` },
          { label: "Completed", value: agent.completedJobs },
          { label: "JSS", value: `${agent.jss}%` },
          { label: "Earnings", value: agent.earnings },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-[#1a1a1f] border border-neutral-700/40 p-4"
          >
            <p className="text-xs text-gray-500 tracking-wide">{stat.label}</p>
            <p className="text-xl font-bold mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* About */}
      <div>
        <h2 className="text-xs text-gray-500 tracking-wide mb-3">About</h2>
        <p className="text-sm leading-relaxed">{agent.about}</p>
      </div>

      {/* Skills */}
      <div>
        <h2 className="text-xs text-gray-500 tracking-wide mb-3">Skills</h2>
        <div className="flex flex-wrap gap-2">
          {agent.skills.map((skill: string) => (
            <span
              key={skill}
              className="border border-neutral-700/40 px-3 py-1 text-xs tracking-wide text-gray-300"
            >
              {skill}
            </span>
          ))}
          {agent.skills.length === 0 && (
            <span className="text-gray-500 text-sm">No skills listed</span>
          )}
        </div>
      </div>

      {/* Recent Jobs */}
      <div>
        <h2 className="text-lg font-bold tracking-wide mb-4">Recent Jobs</h2>
        {agent.recentJobs.length > 0 ? (
          <div className="bg-[#1a1a1f] border border-neutral-700/40 overflow-hidden">
            <div className="grid grid-cols-[1fr_120px_120px_100px] gap-4 px-4 py-3 border-b border-neutral-700/40 text-xs text-gray-500 tracking-wide">
              <span>Title</span>
              <span>Budget</span>
              <span>Status</span>
              <span>Date</span>
            </div>
            {agent.recentJobs.map((job: any, i: number) => (
              <div
                key={i}
                className={`grid grid-cols-[1fr_120px_120px_100px] gap-4 px-4 py-3 text-sm ${
                  i !== agent.recentJobs.length - 1 ? "border-b border-neutral-700/40" : ""
                }`}
              >
                <span>{job.title}</span>
                <span>{job.budget}</span>
                <span className="text-xs">
                  <span className="border border-green-500/20 bg-green-500/10 text-green-400 px-2 py-0.5">{job.status}</span>
                </span>
                <span className="text-gray-500">{job.date}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-[#1a1a1f] border border-neutral-700/40 p-8 text-center text-gray-500">
            No jobs yet
          </div>
        )}
      </div>

      {/* Ratings */}
      <div>
        <h2 className="text-lg font-bold tracking-wide mb-4">Ratings ({agent.ratings.length})</h2>
        {agent.ratings.length > 0 ? (
          <div className="bg-[#1a1a1f] border border-neutral-700/40 overflow-hidden">
            {agent.ratings.map((r: any, i: number) => (
              <div
                key={i}
                className={`p-4 ${
                  i !== agent.ratings.length - 1 ? "border-b border-neutral-700/40" : ""
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500">{r.from}</span>
                  <span className="text-sm">
                    {"* ".repeat(r.score)}({r.score}/5)
                  </span>
                </div>
                <p className="text-sm text-gray-300">{r.comment}</p>
                <p className="text-xs text-gray-600 mt-2">{r.date}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-[#1a1a1f] border border-neutral-700/40 p-8 text-center text-gray-500">
            No ratings yet
          </div>
        )}
      </div>
    </div>
  );
}
