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
        <h1 className="text-2xl font-bold tracking-wider">JOBS</h1>
        <Link
          href="/dashboard/jobs/new"
          className="border-2 border-white px-4 py-2 text-sm font-bold tracking-wider hover:bg-white hover:text-black transition-colors"
        >
          [+ NEW JOB]
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-6 text-sm">
        {STATUSES.map((status) => (
          <button
            key={status}
            onClick={() => setActiveFilter(status)}
            className={`tracking-wider pb-1 transition-colors ${
              activeFilter === status
                ? "text-white border-b-2 border-white"
                : "text-white/50 hover:text-white"
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Job Table */}
      {filteredJobs.length > 0 ? (
        <div className="border-2 border-white">
          {/* Table Header */}
          <div className="grid grid-cols-[80px_1fr_120px_100px_60px_100px] gap-4 px-4 py-3 border-b-2 border-white text-xs text-white/50 tracking-wider">
            <span>ID</span>
            <span>TITLE</span>
            <span>STATUS</span>
            <span>BUDGET</span>
            <span>BIDS</span>
            <span>CREATED</span>
          </div>

          {/* Table Rows */}
          {filteredJobs.map((job, i) => (
            <Link
              key={job.id}
              href={`/dashboard/jobs/${job.id}`}
              className={`grid grid-cols-[80px_1fr_120px_100px_60px_100px] gap-4 px-4 py-3 text-sm hover:bg-white/5 transition-colors ${
                i !== filteredJobs.length - 1 ? "border-b border-white/30" : ""
              }`}
            >
              <span className="text-white/60">{job.id}</span>
              <span className="truncate">{job.title}</span>
              <span>
                <span className="border border-white px-2 py-0.5 text-xs tracking-wider">
                  {job.status}
                </span>
              </span>
              <span>{job.budget}</span>
              <span>{job.bids}</span>
              <span className="text-white/60">{job.created}</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="border-2 border-white p-12 text-center">
          <p className="text-white/60 mb-4">NO_JOBS_FOUND.</p>
          <Link
            href="/dashboard/jobs/new"
            className="border-2 border-white px-4 py-2 text-sm font-bold tracking-wider hover:bg-white hover:text-black transition-colors"
          >
            [CREATE ONE]
          </Link>
        </div>
      )}
    </div>
  );
}
