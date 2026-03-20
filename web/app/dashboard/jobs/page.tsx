"use client";

import { useState } from "react";
import Link from "next/link";

const STATUSES = ["ALL", "DRAFT", "OPEN", "BIDDING", "IN_PROGRESS", "COMPLETED"];

const MOCK_JOBS = [
  { id: "0x4f2a", title: "Smart Contract Audit - DeFi Protocol", status: "BIDDING", budget: "500 USDC", bids: 4, created: "2026-03-15" },
  { id: "0x3b1c", title: "Data Pipeline Optimization", status: "IN_PROGRESS", budget: "300 USDC", bids: 6, created: "2026-03-14" },
  { id: "0x1d8e", title: "API Integration Testing Suite", status: "COMPLETED", budget: "250 USDC", bids: 3, created: "2026-03-12" },
  { id: "0x9a7f", title: "Documentation for SDK v2.0", status: "OPEN", budget: "150 USDC", bids: 1, created: "2026-03-11" },
  { id: "0x5c3d", title: "Machine Learning Model Training", status: "DRAFT", budget: "800 USDC", bids: 0, created: "2026-03-10" },
  { id: "0x2e6b", title: "Frontend Component Library", status: "BIDDING", budget: "400 USDC", bids: 7, created: "2026-03-09" },
  { id: "0x8f4a", title: "Security Penetration Testing", status: "IN_PROGRESS", budget: "600 USDC", bids: 2, created: "2026-03-08" },
  { id: "0x7d2c", title: "Database Schema Migration", status: "COMPLETED", budget: "200 USDC", bids: 5, created: "2026-03-07" },
];

const statusBadgeClass = (status: string) => {
  switch (status) {
    case "BIDDING": return "bg-green-500/10 text-green-400 border-green-500/20";
    case "IN_PROGRESS": return "bg-neutral-800/50 text-white/70 border-neutral-700/40";
    case "COMPLETED": return "bg-neutral-800/50 text-gray-500 border-neutral-700/40";
    case "OPEN": return "bg-neutral-800/50 text-white/60 border-neutral-700/40";
    case "DRAFT": return "bg-neutral-800/50 text-gray-400 border-neutral-700/40";
    default: return "bg-neutral-800/50 text-gray-400 border-neutral-700/40";
  }
};

export default function JobsPage() {
  const [activeFilter, setActiveFilter] = useState("ALL");

  const filteredJobs =
    activeFilter === "ALL"
      ? MOCK_JOBS
      : MOCK_JOBS.filter((j) => j.status === activeFilter);

  return (
    <div className="space-y-6 font-mono">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-wide">Jobs</h1>
        <Link
          href="/dashboard/jobs/new"
          className="bg-white text-black px-4 py-2 text-sm font-medium tracking-wide hover:bg-white/90 transition-colors duration-150"
        >
          + New Job
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-6 text-sm">
        {STATUSES.map((status) => (
          <button
            key={status}
            onClick={() => setActiveFilter(status)}
            className={`tracking-wide pb-1 transition-colors duration-150 ${
              activeFilter === status
                ? "text-white border-b-2 border-white"
                : "text-gray-500 hover:text-white"
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Job Table */}
      {filteredJobs.length > 0 ? (
        <div className="border border-neutral-700/40 overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[80px_1fr_120px_100px_60px_100px] gap-4 px-4 py-3 border-b border-neutral-700/40 text-xs text-gray-500 tracking-wide">
            <span>ID</span>
            <span>Title</span>
            <span>Status</span>
            <span>Budget</span>
            <span>Bids</span>
            <span>Created</span>
          </div>

          {/* Table Rows */}
          {filteredJobs.map((job, i) => (
            <Link
              key={job.id}
              href={`/dashboard/jobs/${job.id}`}
              className={`grid grid-cols-[80px_1fr_120px_100px_60px_100px] gap-4 px-4 py-3 text-sm hover:border-neutral-600/60 transition-colors duration-150 ${
                i !== filteredJobs.length - 1 ? "border-b border-neutral-700/40" : ""
              }`}
            >
              <span className="text-gray-500">{job.id}</span>
              <span className="truncate">{job.title}</span>
              <span>
                <span className={`border px-2 py-0.5 text-xs tracking-wide ${statusBadgeClass(job.status)}`}>
                  {job.status}
                </span>
              </span>
              <span>{job.budget}</span>
              <span>{job.bids}</span>
              <span className="text-gray-500">{job.created}</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="border border-neutral-700/40 p-12 text-center">
          <p className="text-gray-500 mb-4">No jobs found.</p>
          <Link
            href="/dashboard/jobs/new"
            className="border border-neutral-700/40 px-4 py-2 text-sm font-medium tracking-wide hover:bg-[#1a1a1f] transition-colors duration-150"
          >
            Create One
          </Link>
        </div>
      )}
    </div>
  );
}
