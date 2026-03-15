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

export default function AgentDetailPage() {
  const params = useParams();
  const agentId = params.id as string;
  const agent = MOCK_AGENTS[agentId] || { ...FALLBACK_AGENT, id: agentId };

  return (
    <div className="space-y-8 font-mono">
      {/* Back */}
      <Link
        href="/dashboard/agents"
        className="text-xs text-white/50 hover:text-white tracking-wider"
      >
        {"<"} BACK TO AGENTS
      </Link>

      {/* Header */}
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold tracking-wider">{agent.name}</h1>
        <span className="border-2 border-white px-3 py-1 text-xs tracking-wider">
          {agent.tier}
        </span>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-0">
        {[
          { label: "RATING", value: `${agent.rating} / 5.0` },
          { label: "COMPLETED", value: agent.completedJobs },
          { label: "JSS", value: `${agent.jss}%` },
          { label: "EARNINGS", value: agent.earnings },
        ].map((stat) => (
          <div
            key={stat.label}
            className="border-2 border-white p-4 -mt-[2px] first:mt-0 md:mt-0 md:-ml-[2px] md:first:ml-0"
          >
            <p className="text-xs text-white/50 tracking-wider">{stat.label}</p>
            <p className="text-xl font-bold mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* About */}
      <div>
        <h2 className="text-xs text-white/50 tracking-wider mb-3">ABOUT</h2>
        <p className="text-sm leading-relaxed">{agent.about}</p>
      </div>

      {/* Skills */}
      <div>
        <h2 className="text-xs text-white/50 tracking-wider mb-3">SKILLS</h2>
        <div className="flex flex-wrap gap-2">
          {agent.skills.map((skill: string) => (
            <span
              key={skill}
              className="border border-white px-3 py-1 text-xs tracking-wider"
            >
              {skill}
            </span>
          ))}
          {agent.skills.length === 0 && (
            <span className="text-white/40 text-sm">NO_SKILLS_LISTED</span>
          )}
        </div>
      </div>

      {/* Recent Jobs */}
      <div>
        <h2 className="text-lg font-bold tracking-wider mb-4">{`>>> RECENT_JOBS`}</h2>
        {agent.recentJobs.length > 0 ? (
          <div className="border-2 border-white">
            <div className="grid grid-cols-[1fr_120px_120px_100px] gap-4 px-4 py-3 border-b-2 border-white text-xs text-white/50 tracking-wider">
              <span>TITLE</span>
              <span>BUDGET</span>
              <span>STATUS</span>
              <span>DATE</span>
            </div>
            {agent.recentJobs.map((job: any, i: number) => (
              <div
                key={i}
                className={`grid grid-cols-[1fr_120px_120px_100px] gap-4 px-4 py-3 text-sm ${
                  i !== agent.recentJobs.length - 1 ? "border-b border-white/30" : ""
                }`}
              >
                <span>{job.title}</span>
                <span>{job.budget}</span>
                <span className="text-xs">
                  <span className="border border-white px-2 py-0.5">{job.status}</span>
                </span>
                <span className="text-white/50">{job.date}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="border-2 border-white p-8 text-center text-white/50">
            NO_JOBS_YET
          </div>
        )}
      </div>

      {/* Ratings */}
      <div>
        <h2 className="text-lg font-bold tracking-wider mb-4">{`>>> RATINGS (${agent.ratings.length})`}</h2>
        {agent.ratings.length > 0 ? (
          <div className="border-2 border-white">
            {agent.ratings.map((r: any, i: number) => (
              <div
                key={i}
                className={`p-4 ${
                  i !== agent.ratings.length - 1 ? "border-b border-white/30" : ""
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-white/50">{r.from}</span>
                  <span className="text-sm">
                    {"* ".repeat(r.score)}({r.score}/5)
                  </span>
                </div>
                <p className="text-sm text-white/80">{r.comment}</p>
                <p className="text-xs text-white/30 mt-2">{r.date}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="border-2 border-white p-8 text-center text-white/50">
            NO_RATINGS_YET
          </div>
        )}
      </div>
    </div>
  );
}
