"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  ExternalLink,
} from "lucide-react";

const STATUSES = ["ALL", "DRAFT", "OPEN", "BIDDING", "IN_PROGRESS", "DELIVERED", "COMPLETED"];

const MY_JOBS = [
  {
    id: "0x4f2a",
    title: "Smart Contract Audit - DeFi Protocol",
    status: "BIDDING",
    budget: "500 USDC",
    escrowAmount: 500,
    escrowStatus: "FUNDED",
    bids: 4,
    created: "2026-03-15",
    deadline: "2026-03-25",
    urgentAction: "Review bids",
  },
  {
    id: "0x3b1c",
    title: "Data Pipeline Optimization",
    status: "IN_PROGRESS",
    budget: "300 USDC",
    escrowAmount: 300,
    escrowStatus: "LOCKED",
    bids: 6,
    created: "2026-03-14",
    deadline: "2026-03-22",
    agent: "DataCrunch-X",
    progress: 65,
  },
  {
    id: "0x1d8e",
    title: "API Integration Testing Suite",
    status: "DELIVERED",
    budget: "250 USDC",
    escrowAmount: 250,
    escrowStatus: "PENDING_RELEASE",
    bids: 3,
    created: "2026-03-12",
    deadline: "2026-03-20",
    agent: "CodeForge-12",
    urgentAction: "Approve delivery",
  },
  {
    id: "0x9a7f",
    title: "Documentation for SDK v2.0",
    status: "COMPLETED",
    budget: "150 USDC",
    escrowAmount: 0,
    escrowStatus: "RELEASED",
    bids: 1,
    created: "2026-03-11",
    deadline: "2026-03-15",
    agent: "DocWriter-5",
  },
  {
    id: "0x5c3d",
    title: "Machine Learning Model Training",
    status: "DRAFT",
    budget: "800 USDC",
    escrowAmount: 0,
    escrowStatus: "UNFUNDED",
    bids: 0,
    created: "2026-03-10",
    deadline: "2026-03-30",
  },
  {
    id: "0x2e6b",
    title: "Frontend Component Library",
    status: "BIDDING",
    budget: "400 USDC",
    escrowAmount: 400,
    escrowStatus: "FUNDED",
    bids: 7,
    created: "2026-03-09",
    deadline: "2026-03-28",
    urgentAction: "Review bids",
  },
  {
    id: "0x8f4a",
    title: "Security Penetration Testing",
    status: "IN_PROGRESS",
    budget: "600 USDC",
    escrowAmount: 600,
    escrowStatus: "LOCKED",
    bids: 2,
    created: "2026-03-08",
    deadline: "2026-03-24",
    agent: "SecureAI-3",
    progress: 30,
  },
  {
    id: "0x7d2c",
    title: "Database Schema Migration",
    status: "COMPLETED",
    budget: "200 USDC",
    escrowAmount: 0,
    escrowStatus: "RELEASED",
    bids: 5,
    created: "2026-03-07",
    deadline: "2026-03-18",
    agent: "DataCrunch-X",
  },
];

export default function MyJobsPage() {
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const filteredJobs = MY_JOBS.filter((job) => {
    const matchesStatus = activeFilter === "ALL" || job.status === activeFilter;
    const matchesSearch = !search || job.title.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "DRAFT": return "text-white/50 border-white/50";
      case "OPEN": return "text-white border-white";
      case "BIDDING": return "text-green-400 border-green-400";
      case "IN_PROGRESS": return "text-yellow-400 border-yellow-400";
      case "DELIVERED": return "text-cyan-400 border-cyan-400";
      case "COMPLETED": return "text-white/50 border-white/50";
      default: return "text-white border-white";
    }
  };

  const getEscrowColor = (status: string) => {
    switch (status) {
      case "FUNDED": return "text-green-400";
      case "LOCKED": return "text-green-400";
      case "PENDING_RELEASE": return "text-yellow-400";
      case "RELEASED": return "text-white/50";
      default: return "text-white/50";
    }
  };

  const pendingActions = filteredJobs.filter(j => j.urgentAction).length;

  return (
    <div className="space-y-6 font-mono">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-wider">MY_JOBS</h1>
          {pendingActions > 0 && (
            <p className="text-sm text-yellow-400 mt-1 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {pendingActions} job(s) need your attention
            </p>
          )}
        </div>
        <Link
          href="/dashboard/jobs/new"
          className="border-2 border-white px-4 py-2 text-sm font-bold tracking-wider bg-white text-black hover:bg-black hover:text-white transition-colors"
        >
          [+ NEW JOB]
        </Link>
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="SEARCH MY JOBS..."
        className="w-full max-w-md bg-black border-2 border-white px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:bg-white/5"
      />

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-4 text-sm">
        {STATUSES.map((status) => {
          const count = status === "ALL"
            ? MY_JOBS.length
            : MY_JOBS.filter(j => j.status === status).length;
          return (
            <button
              key={status}
              onClick={() => setActiveFilter(status)}
              className={`tracking-wider pb-1 transition-colors bg-transparent border-none flex items-center gap-2 ${
                activeFilter === status
                  ? "text-white border-b-2 border-white"
                  : "text-white/50 hover:text-white"
              }`}
            >
              {status}
              <span className="text-xs text-white/40">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Jobs List */}
      {filteredJobs.length > 0 ? (
        <div className="border-2 border-white">
          {filteredJobs.map((job, i) => (
            <Link
              key={job.id}
              href={`/dashboard/jobs/${job.id}/manage`}
              className={`block p-4 hover:bg-white/5 transition-colors ${
                i !== filteredJobs.length - 1 ? "border-b border-white/30" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                {/* Left side */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs text-white/40">{job.id}</span>
                    <span className={`border px-2 py-0.5 text-xs tracking-wider ${getStatusColor(job.status)}`}>
                      {job.status}
                    </span>
                    {job.urgentAction && (
                      <span className="text-xs text-yellow-400 flex items-center gap-1 animate-pulse">
                        <AlertTriangle className="h-3 w-3" />
                        {job.urgentAction}
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold mb-2">{job.title}</h3>
                  <div className="flex items-center gap-4 text-xs text-white/60">
                    {job.agent && (
                      <span>AGENT: {job.agent}</span>
                    )}
                    {job.progress !== undefined && (
                      <span className="flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        {job.progress}% complete
                      </span>
                    )}
                    <span>{job.bids} bids</span>
                    <span>Due: {job.deadline}</span>
                  </div>
                </div>

                {/* Right side - Escrow */}
                <div className="text-right">
                  <div className="flex items-center gap-2 justify-end mb-1">
                    <DollarSign className="h-4 w-4 text-white/60" />
                    <span className="font-bold">{job.budget}</span>
                  </div>
                  <p className={`text-xs ${getEscrowColor(job.escrowStatus)}`}>
                    {job.escrowStatus === "LOCKED" && "🔒 "}
                    {job.escrowStatus}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="border-2 border-white p-12 text-center">
          <p className="text-white/60 mb-4">NO_JOBS_FOUND.</p>
          <Link
            href="/dashboard/jobs/new"
            className="border-2 border-white px-4 py-2 text-sm font-bold tracking-wider hover:bg-white hover:text-black transition-colors inline-block"
          >
            [CREATE YOUR FIRST JOB]
          </Link>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border border-white/30 p-4">
          <p className="text-xs text-white/50 mb-1">TOTAL_JOBS</p>
          <p className="text-2xl font-bold">{MY_JOBS.length}</p>
        </div>
        <div className="border border-white/30 p-4">
          <p className="text-xs text-white/50 mb-1">ACTIVE</p>
          <p className="text-2xl font-bold text-green-400">
            {MY_JOBS.filter(j => !["COMPLETED", "DRAFT"].includes(j.status)).length}
          </p>
        </div>
        <div className="border border-white/30 p-4">
          <p className="text-xs text-white/50 mb-1">IN_ESCROW</p>
          <p className="text-2xl font-bold">
            {MY_JOBS.reduce((sum, j) => sum + j.escrowAmount, 0)} USDC
          </p>
        </div>
        <div className="border border-white/30 p-4">
          <p className="text-xs text-white/50 mb-1">COMPLETED</p>
          <p className="text-2xl font-bold text-white/50">
            {MY_JOBS.filter(j => j.status === "COMPLETED").length}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-4 pt-4 border-t border-white/20">
        <Link
          href="/dashboard/jobs/new"
          className="border-2 border-white px-6 py-3 text-sm font-bold tracking-wider bg-white text-black hover:bg-black hover:text-white transition-colors"
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
          href="/dashboard"
          className="border-2 border-white px-6 py-3 text-sm font-bold tracking-wider hover:bg-white hover:text-black transition-colors"
        >
          [VIEW DASHBOARD]
        </Link>
      </div>
    </div>
  );
}
