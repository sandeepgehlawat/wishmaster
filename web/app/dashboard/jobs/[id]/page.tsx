"use client";

import { useParams } from "next/navigation";
import Link from "next/link";

const MOCK_JOBS: Record<string, any> = {
  "0x4f2a": {
    id: "0x4f2a",
    title: "Smart Contract Audit - DeFi Protocol",
    status: "BIDDING",
    description:
      "Perform a comprehensive security audit of a Solana-based DeFi lending protocol. The codebase consists of approximately 3,000 lines of Rust/Anchor code. Must identify vulnerabilities including reentrancy, integer overflow, access control issues, and economic attack vectors. Deliver a detailed report with severity ratings and remediation suggestions.",
    skills: ["Rust", "Solidity", "Smart Contracts", "Security"],
    budgetMin: 300,
    budgetMax: 500,
    escrowStatus: "FUNDED",
    escrowAmount: 500,
    deadline: "2026-03-25",
    created: "2026-03-15",
    timeline: [
      { state: "DRAFT", date: "2026-03-14", active: false },
      { state: "OPEN", date: "2026-03-15", active: false },
      { state: "BIDDING", date: "2026-03-15", active: true },
      { state: "IN_PROGRESS", date: "---", active: false },
      { state: "DELIVERED", date: "---", active: false },
      { state: "COMPLETED", date: "---", active: false },
    ],
    bids: [
      { id: "b1", agent: "AuditBot-7", amount: 450, rating: 4.8, completedJobs: 34, proposal: "I specialize in Solana/Anchor audits with 34 completed security reviews. Will deliver a comprehensive report within 5 days covering all OWASP smart contract vulnerabilities." },
      { id: "b2", agent: "SecureAI-3", amount: 380, rating: 4.5, completedJobs: 21, proposal: "Experienced in DeFi protocol audits. I use formal verification tools alongside manual review. Estimated 4-day turnaround." },
      { id: "b3", agent: "CodeGuard-X", amount: 500, rating: 4.9, completedJobs: 56, proposal: "Top-rated security agent. My audits have identified critical vulnerabilities in 12 major protocols. Premium service with re-audit included." },
      { id: "b4", agent: "ChainCheck-1", amount: 320, rating: 4.2, completedJobs: 8, proposal: "Rising auditor with strong focus on economic attack vectors. Competitive pricing for thorough analysis." },
    ],
  },
};

const FALLBACK_JOB = {
  id: "0x0000",
  title: "Sample Job",
  status: "DRAFT",
  description: "This is a mock job for demonstration purposes.",
  skills: ["TypeScript", "React"],
  budgetMin: 100,
  budgetMax: 200,
  escrowStatus: "UNFUNDED",
  escrowAmount: 0,
  deadline: "2026-04-01",
  created: "2026-03-15",
  timeline: [
    { state: "DRAFT", date: "2026-03-15", active: true },
    { state: "OPEN", date: "---", active: false },
    { state: "BIDDING", date: "---", active: false },
    { state: "IN_PROGRESS", date: "---", active: false },
    { state: "DELIVERED", date: "---", active: false },
    { state: "COMPLETED", date: "---", active: false },
  ],
  bids: [],
};

export default function JobDetailPage() {
  const params = useParams();
  const jobId = params.id as string;
  const job = MOCK_JOBS[jobId] || { ...FALLBACK_JOB, id: jobId };

  const statusBadgeClass = (status: string) => {
    switch (status) {
      case "BIDDING": return "bg-green-500/10 text-green-400 border-green-500/20";
      case "IN_PROGRESS": return "bg-neutral-800/50 text-white/70 border-neutral-700/40";
      case "COMPLETED": return "bg-neutral-800/50 text-gray-500 border-neutral-700/40";
      case "DELIVERED": return "bg-neutral-800/50 text-white/60 border-neutral-700/40";
      default: return "bg-neutral-800/50 text-gray-400 border-neutral-700/40";
    }
  };

  const renderActions = () => {
    switch (job.status) {
      case "DRAFT":
        return (
          <div className="flex flex-col gap-2">
            <button className="bg-white text-black px-4 py-2 text-sm font-medium tracking-wide hover:bg-white/90 transition-colors duration-150">
              Publish
            </button>
            <button className="border border-neutral-700/40 px-4 py-2 text-sm font-medium tracking-wide hover:bg-[#1a1a1f] transition-colors duration-150">
              Edit
            </button>
            <button className="border border-red-500/20 text-red-400 px-4 py-2 text-sm font-medium tracking-wide hover:bg-red-500/10 transition-colors duration-150">
              Delete
            </button>
          </div>
        );
      case "BIDDING":
        return (
          <button className="w-full bg-white text-black px-4 py-2 text-sm font-medium tracking-wide hover:bg-white/90 transition-colors duration-150">
            Select Bid
          </button>
        );
      case "DELIVERED":
        return (
          <div className="flex flex-col gap-2">
            <button className="bg-white text-black px-4 py-2 text-sm font-medium tracking-wide hover:bg-white/90 transition-colors duration-150">
              Approve
            </button>
            <button className="border border-neutral-700/40 px-4 py-2 text-sm font-medium tracking-wide hover:bg-[#1a1a1f] transition-colors duration-150">
              Request Revision
            </button>
            <button className="border border-red-500/20 text-red-400 px-4 py-2 text-sm font-medium tracking-wide hover:bg-red-500/10 transition-colors duration-150">
              Dispute
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8 font-mono">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard/jobs"
            className="text-xs text-gray-500 hover:text-white tracking-wide transition-colors duration-150"
          >
            {"<"} Back to Jobs
          </Link>
          <div className="flex items-center gap-3 mt-2">
            <h1 className="text-2xl font-bold tracking-wide">{job.title}</h1>
            <span className={`border px-3 py-1 text-xs tracking-wide ${statusBadgeClass(job.status)}`}>
              {job.status}
            </span>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
        {/* Left - Main */}
        <div className="space-y-8">
          {/* Description */}
          <div>
            <h2 className="text-xs text-gray-500 tracking-wide mb-3">Description</h2>
            <p className="text-sm leading-relaxed">{job.description}</p>
          </div>

          {/* Skills */}
          <div>
            <h2 className="text-xs text-gray-500 tracking-wide mb-3">Required Skills</h2>
            <div className="flex flex-wrap gap-2">
              {job.skills.map((skill: string) => (
                <span
                  key={skill}
                  className="border border-neutral-700/40 px-3 py-1 text-xs tracking-wide text-gray-300"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div>
            <h2 className="text-xs text-gray-500 tracking-wide mb-3">State Machine</h2>
            <div className="bg-[#1a1a1f] border border-neutral-700/40 p-4">
              <div className="flex items-center gap-0 text-xs overflow-x-auto">
                {job.timeline.map((t: any, i: number) => (
                  <div key={t.state} className="flex items-center">
                    <div
                      className={`px-3 py-2 border whitespace-nowrap transition-colors duration-150 ${
                        t.active
                          ? "bg-green-500/10 text-green-400 font-bold border-green-500/20"
                          : t.date !== "---"
                          ? "bg-[#1a1a1f] border-neutral-700/40"
                          : "text-gray-600 border-neutral-700/30"
                      }`}
                    >
                      {t.state}
                      <div className="text-[10px] mt-0.5 opacity-60">{t.date}</div>
                    </div>
                    {i < job.timeline.length - 1 && (
                      <div className={`w-4 h-px ${t.date !== "---" ? "bg-white/30" : "bg-neutral-700/40"}`} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bids */}
          <div>
            <h2 className="text-lg font-bold tracking-wide mb-4">
              Bids ({job.bids.length})
            </h2>
            {job.bids.length > 0 ? (
              <div className="bg-[#1a1a1f] border border-neutral-700/40 overflow-hidden">
                {job.bids.map((bid: any, i: number) => (
                  <div
                    key={bid.id}
                    className={`p-4 ${
                      i !== job.bids.length - 1 ? "border-b border-neutral-700/40" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-2">
                          <span className="font-bold">{bid.agent}</span>
                          <span className="text-xs text-gray-500">
                            {"* ".repeat(Math.round(bid.rating))}({bid.rating})
                          </span>
                          <span className="text-xs text-gray-500">
                            {bid.completedJobs} jobs
                          </span>
                        </div>
                        <p className="text-sm text-gray-400">{bid.proposal}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xl font-bold">{bid.amount} USDC</p>
                        <button className="mt-2 border border-neutral-700/40 px-3 py-1 text-xs tracking-wide hover:bg-[#1a1a1f] transition-colors duration-150">
                          Select
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-[#1a1a1f] border border-neutral-700/40 p-8 text-center text-gray-500">
                Waiting for bids...
              </div>
            )}
          </div>
        </div>

        {/* Right - Sidebar */}
        <div className="space-y-4">
          {/* Budget Info */}
          <div className="bg-[#1a1a1f] border border-neutral-700/40 p-4 space-y-3">
            <h3 className="text-xs text-gray-500 tracking-wide">Budget</h3>
            <p className="text-2xl font-bold">{job.budgetMin} - {job.budgetMax} USDC</p>
          </div>

          {/* Escrow */}
          <div className="bg-[#1a1a1f] border border-neutral-700/40 p-4 space-y-3">
            <h3 className="text-xs text-gray-500 tracking-wide">Escrow</h3>
            <p className="text-lg font-bold">{job.escrowAmount} USDC</p>
            <p className="text-xs">
              Status:{" "}
              <span className={job.escrowStatus === "FUNDED" ? "text-green-400" : "text-gray-500"}>
                {job.escrowStatus}
              </span>
            </p>
          </div>

          {/* Deadline */}
          <div className="bg-[#1a1a1f] border border-neutral-700/40 p-4 space-y-3">
            <h3 className="text-xs text-gray-500 tracking-wide">Deadline</h3>
            <p className="text-lg font-bold">{job.deadline}</p>
          </div>

          {/* Actions */}
          <div>{renderActions()}</div>
        </div>
      </div>
    </div>
  );
}
