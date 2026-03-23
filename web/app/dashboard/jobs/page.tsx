"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  ExternalLink,
  Loader2,
  Wallet,
} from "lucide-react";
import { listMyJobs } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

interface Job {
  id: string;
  title: string;
  status: string;
  budget_min?: number;
  budget_max?: number;
  budget_amount?: number;
  escrow_amount?: number;
  escrow_status?: string;
  bids_count?: number;
  created_at?: string;
  deadline?: string;
  selected_agent?: { name: string };
  progress?: number;
}

const STATUSES = ["ALL", "DRAFT", "OPEN", "BIDDING", "IN_PROGRESS", "DELIVERED", "COMPLETED"];

export default function MyJobsPage() {
  const { token, _hasHydrated } = useAuthStore();
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchJobs() {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await listMyJobs(token);
        // Normalize status to uppercase for frontend consistency
        const normalizedJobs = (response.jobs || []).map((job: any) => ({
          ...job,
          status: (job.status || "draft").toUpperCase(),
        }));
        setJobs(normalizedJobs);
      } catch (err: any) {
        console.error("Failed to fetch jobs:", err);
        setError(err.message || "Failed to load jobs");
      } finally {
        setLoading(false);
      }
    }

    if (_hasHydrated) {
      fetchJobs();
    }
  }, [token, _hasHydrated]);

  // Wait for hydration
  if (!_hasHydrated) {
    return (
      <div className="flex items-center justify-center py-20 font-mono">
        <Loader2 className="h-8 w-8 animate-spin text-white/50" />
      </div>
    );
  }

  // Not authenticated
  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center py-20 font-mono">
        <Wallet className="h-12 w-12 text-white/30 mb-4" />
        <h2 className="text-xl font-bold tracking-wider mb-2">WALLET_NOT_CONNECTED</h2>
        <p className="text-white/50 text-sm">Connect your wallet to view your jobs</p>
      </div>
    );
  }

  const filteredJobs = jobs.filter((job) => {
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

  const getEscrowColor = (status?: string) => {
    switch (status) {
      case "FUNDED": return "text-green-400";
      case "LOCKED": return "text-green-400";
      case "PENDING_RELEASE": return "text-yellow-400";
      case "RELEASED": return "text-white/50";
      default: return "text-white/50";
    }
  };

  const getUrgentAction = (job: Job): string | null => {
    if (job.status === "BIDDING" && (job.bids_count || 0) > 0) return "Review bids";
    if (job.status === "DELIVERED") return "Approve delivery";
    return null;
  };

  const formatBudget = (job: Job): string => {
    if (job.budget_amount) return `${job.budget_amount} USDC`;
    if (job.budget_min && job.budget_max) return `${job.budget_min}-${job.budget_max} USDC`;
    return "TBD";
  };

  const pendingActions = filteredJobs.filter(j => getUrgentAction(j)).length;
  const totalEscrow = jobs.reduce((sum, j) => sum + (j.escrow_amount || 0), 0);
  const activeJobs = jobs.filter(j => !["COMPLETED", "DRAFT"].includes(j.status)).length;
  const completedJobs = jobs.filter(j => j.status === "COMPLETED").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 font-mono">
        <Loader2 className="h-8 w-8 animate-spin text-white/50" />
        <span className="ml-3 text-white/50">LOADING_JOBS...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border-2 border-red-500 p-12 text-center font-mono">
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="border-2 border-white px-6 py-3 text-sm font-bold tracking-wider hover:bg-white hover:text-black transition-colors"
        >
          [RETRY]
        </button>
      </div>
    );
  }

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
          + New Job
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
      <div className="flex gap-3 sm:gap-4 text-sm overflow-x-auto pb-1 -mb-1">
        {STATUSES.map((status) => {
          const count = status === "ALL"
            ? jobs.length
            : jobs.filter(j => j.status === status).length;
          return (
            <button
              key={status}
              onClick={() => setActiveFilter(status)}
              className={`tracking-wider pb-1 transition-colors bg-transparent border-none flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 ${
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
          {filteredJobs.map((job, i) => {
            const urgentAction = getUrgentAction(job);
            return (
              <Link
                key={job.id}
                href={`/dashboard/jobs/${job.id}`}
                className={`block p-4 hover:bg-white/5 transition-colors ${
                  i !== filteredJobs.length - 1 ? "border-b border-white/30" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left side */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs text-white/40">{job.id.slice(0, 8)}</span>
                      <span className={`border px-2 py-0.5 text-xs tracking-wider ${getStatusColor(job.status)}`}>
                        {job.status}
                      </span>
                      {urgentAction && (
                        <span className="text-xs text-yellow-400 flex items-center gap-1 animate-pulse">
                          <AlertTriangle className="h-3 w-3" />
                          {urgentAction}
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold mb-2">{job.title}</h3>
                    <div className="flex items-center gap-4 text-xs text-white/60">
                      {job.selected_agent && (
                        <span>AGENT: {job.selected_agent.name}</span>
                      )}
                      {job.progress !== undefined && (
                        <span className="flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          {job.progress}% complete
                        </span>
                      )}
                      <span>{job.bids_count || 0} bids</span>
                      {job.deadline && <span>Due: {new Date(job.deadline).toLocaleDateString()}</span>}
                    </div>
                  </div>

                  {/* Right side - Escrow */}
                  <div className="text-right">
                    <div className="flex items-center gap-2 justify-end mb-1">
                      <DollarSign className="h-4 w-4 text-white/60" />
                      <span className="font-bold">{formatBudget(job)}</span>
                    </div>
                    <p className={`text-xs ${getEscrowColor(job.escrow_status)}`}>
                      {job.escrow_status === "LOCKED" && "\u{1F512} "}
                      {job.escrow_status || "UNFUNDED"}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="border border-neutral-700/40 p-12 text-center">
          <p className="text-gray-500 mb-4">No jobs found.</p>
          <Link
            href="/dashboard/jobs/new"
            className="border-2 border-white px-4 py-2 text-sm font-bold tracking-wider hover:bg-white hover:text-black transition-colors inline-block"
          >
            [CREATE YOUR FIRST JOB]
          </Link>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border-2 border-white">
        <div className="p-4 border-r border-b lg:border-b-0 border-white">
          <p className="text-xs text-white/50 mb-1">TOTAL_JOBS</p>
          <p className="text-2xl font-bold">{jobs.length}</p>
        </div>
        <div className="p-4 border-b lg:border-b-0 lg:border-r border-white">
          <p className="text-xs text-white/50 mb-1">ACTIVE</p>
          <p className="text-2xl font-bold text-green-400">{activeJobs}</p>
        </div>
        <div className="p-4 border-r border-white">
          <p className="text-xs text-white/50 mb-1">IN_ESCROW</p>
          <p className="text-2xl font-bold">{totalEscrow} <span className="text-sm">USDC</span></p>
        </div>
        <div className="p-4">
          <p className="text-xs text-white/50 mb-1">COMPLETED</p>
          <p className="text-2xl font-bold text-white/50">{completedJobs}</p>
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
