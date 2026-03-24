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
  Briefcase,
  ArrowRight,
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
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  // Not authenticated
  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center py-20 font-mono">
        <Wallet className="h-12 w-12 text-neutral-600 mb-4" />
        <h2 className="text-xl font-bold tracking-wider mb-2">WALLET_NOT_CONNECTED</h2>
        <p className="text-neutral-500 text-sm">Connect your wallet to view your jobs</p>
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
      case "DRAFT": return "text-neutral-400 border-neutral-700/40";
      case "OPEN": return "text-neutral-300 border-neutral-700/40";
      case "BIDDING": return "text-secondary-400 border-secondary-500/20 bg-secondary-500/10";
      case "IN_PROGRESS": return "text-yellow-400 border-yellow-500/20 bg-yellow-500/10";
      case "DELIVERED": return "text-cyan-400 border-cyan-500/20 bg-cyan-500/10";
      case "COMPLETED": return "text-neutral-400 border-neutral-700/40";
      default: return "text-neutral-300 border-neutral-700/40";
    }
  };

  const getEscrowColor = (status?: string) => {
    switch (status) {
      case "FUNDED": return "text-secondary-400";
      case "LOCKED": return "text-secondary-400";
      case "PENDING_RELEASE": return "text-yellow-400";
      case "RELEASED": return "text-neutral-500";
      default: return "text-neutral-500";
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
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
        <span className="ml-3 text-neutral-400 text-sm">LOADING_JOBS...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-red-500/30 bg-red-500/5 p-8 sm:p-12 text-center font-mono">
        <p className="text-red-400 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="border border-neutral-700/40 px-6 py-3 text-sm font-bold tracking-wider hover:bg-[#1a1a1f] transition-colors"
        >
          [RETRY]
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-mono">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Briefcase className="h-4 w-4 text-secondary-400" />
            <h1 className="text-xl md:text-2xl font-bold tracking-wider">MY_JOBS</h1>
          </div>
          {pendingActions > 0 && (
            <p className="text-sm text-yellow-400 mt-1 flex items-center gap-2">
              <AlertTriangle className="h-3 w-3" />
              {pendingActions} job(s) need your attention
            </p>
          )}
        </div>
        <Link
          href="/dashboard/jobs/new"
          className="bg-white text-black px-5 py-2.5 text-xs sm:text-sm font-bold tracking-wider hover:bg-neutral-200 transition-colors no-underline"
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
        className="input-glow w-full max-w-md bg-[#131519] border border-neutral-700/40 px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none"
      />

      {/* Filter Bar */}
      <div className="flex gap-3 sm:gap-4 text-sm overflow-x-auto pb-1 -mb-1 scrollbar-none">
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
                  ? "text-white border-b-2 border-secondary-400"
                  : "text-neutral-500 hover:text-white"
              }`}
            >
              {status}
              <span className="text-xs text-neutral-600">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Jobs List */}
      {filteredJobs.length > 0 ? (
        <div className="border border-neutral-700/40 bg-[#1a1a1f]">
          {filteredJobs.map((job, i) => {
            const urgentAction = getUrgentAction(job);
            return (
              <Link
                key={job.id}
                href={`/dashboard/jobs/${job.id}`}
                className={`list-item-hover block p-4 no-underline ${
                  i !== filteredJobs.length - 1 ? "border-b border-neutral-700/40" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <span className="text-xs text-neutral-600">{job.id.slice(0, 8)}</span>
                      <span className={`border px-2 py-0.5 text-xs tracking-wider ${getStatusColor(job.status)}`}>
                        {job.status}
                      </span>
                      {urgentAction && (
                        <span className="text-xs text-yellow-400 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {urgentAction}
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold mb-2 truncate">{job.title}</h3>
                    <div className="flex items-center gap-4 text-xs text-neutral-500 flex-wrap">
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

                  <div className="text-right flex-shrink-0">
                    <div className="flex items-center gap-2 justify-end mb-1">
                      <span className="font-bold text-secondary-400">{formatBudget(job)}</span>
                    </div>
                    <p className={`text-xs ${getEscrowColor(job.escrow_status)}`}>
                      {job.escrow_status || "UNFUNDED"}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="border border-neutral-700/40 bg-[#1a1a1f] p-8 sm:p-12 text-center">
          <p className="text-neutral-400 mb-4">No jobs found.</p>
          <Link
            href="/dashboard/jobs/new"
            className="border border-neutral-700/40 px-4 py-2 text-sm font-bold tracking-wider hover:bg-white/[0.02] transition-colors inline-block no-underline"
          >
            [CREATE YOUR FIRST JOB]
          </Link>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card border border-neutral-700/40 bg-[#1a1a1f] p-4 border-l-2 border-l-secondary-400">
          <p className="text-[10px] sm:text-xs text-neutral-500 mb-1 tracking-wider">TOTAL_JOBS</p>
          <p className="text-2xl font-bold">{jobs.length}</p>
        </div>
        <div className="stat-card border border-neutral-700/40 bg-[#1a1a1f] p-4 border-l-2 border-l-secondary-400">
          <p className="text-[10px] sm:text-xs text-neutral-500 mb-1 tracking-wider">ACTIVE</p>
          <p className="text-2xl font-bold text-secondary-400">{activeJobs}</p>
        </div>
        <div className="stat-card border border-neutral-700/40 bg-[#1a1a1f] p-4 border-l-2 border-l-neutral-500">
          <p className="text-[10px] sm:text-xs text-neutral-500 mb-1 tracking-wider">IN_ESCROW</p>
          <p className="text-2xl font-bold">{totalEscrow} <span className="text-sm text-neutral-500">USDC</span></p>
        </div>
        <div className="stat-card border border-neutral-700/40 bg-[#1a1a1f] p-4 border-l-2 border-l-neutral-500">
          <p className="text-[10px] sm:text-xs text-neutral-500 mb-1 tracking-wider">COMPLETED</p>
          <p className="text-2xl font-bold text-neutral-400">{completedJobs}</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3 pt-4 border-t border-neutral-700/40">
        <Link
          href="/dashboard/jobs/new"
          className="bg-white text-black px-5 py-2.5 text-sm font-bold tracking-wider hover:bg-neutral-200 transition-colors no-underline"
        >
          [POST NEW JOB]
        </Link>
        <Link
          href="/dashboard/agents"
          className="border border-neutral-700/40 px-5 py-2.5 text-sm font-bold tracking-wider hover:border-neutral-500 hover:text-white transition-colors no-underline text-neutral-300"
        >
          [BROWSE AGENTS]
        </Link>
      </div>
    </div>
  );
}
