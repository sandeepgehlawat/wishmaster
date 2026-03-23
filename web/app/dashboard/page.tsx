"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import {
  Briefcase,
  DollarSign,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  Star,
  Loader2,
  Wallet,
} from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { listMyJobs, getCurrentUser } from "@/lib/api";
import type { JobWithDetails } from "@/lib/types";

// Dashboard job view derived from JobWithDetails
interface DashboardJob {
  id: string;
  title: string;
  status: string;
  budget_min: number;
  budget_max: number;
  final_price?: number;
  deadline?: string;
  bid_count: number;
  agent_name?: string;
}

interface User {
  id: string;
  wallet_address: string;
  display_name?: string;
}

interface EscrowSummary {
  total: number;
  locked: number;
  pendingRelease: number;
  funded: number;
}

export default function DashboardPage() {
  const { address } = useAccount();
  const { token, _hasHydrated } = useAuthStore();

  const [jobs, setJobs] = useState<DashboardJob[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "NOT_CONNECTED";

  // Fetch data when authenticated
  useEffect(() => {
    if (!_hasHydrated) return;

    if (!token) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [jobsResponse, userResponse] = await Promise.all([
          listMyJobs(token),
          getCurrentUser(token),
        ]);
        const transformedJobs: DashboardJob[] = (jobsResponse.jobs || [])
          .filter((jwd: any) => jwd != null)
          .map((jwd: any) => {
            const job = jwd.job || jwd;
            return {
              id: job.id,
              title: job.title,
              status: (job.status || "unknown").toUpperCase(),
              budget_min: job.budget_min,
              budget_max: job.budget_max,
              final_price: job.final_price,
              deadline: job.deadline,
              bid_count: jwd.bid_count || 0,
              agent_name: jwd.agent_name,
            };
          });
        setJobs(transformedJobs);
        setUser(userResponse);
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token, _hasHydrated]);

  // Calculate escrow summary from jobs
  const escrowSummary: EscrowSummary = jobs.reduce(
    (acc, job) => {
      const amount = job.final_price || job.budget_max || 0;
      const status = job.status.toUpperCase();
      if (status === "OPEN" || status === "BIDDING") {
        acc.funded += amount;
        acc.total += amount;
      } else if (status === "ASSIGNED" || status === "IN_PROGRESS") {
        acc.locked += amount;
        acc.total += amount;
      } else if (status === "DELIVERED") {
        acc.pendingRelease += amount;
        acc.total += amount;
      }
      return acc;
    },
    { total: 0, locked: 0, pendingRelease: 0, funded: 0 }
  );

  // Generate pending actions from jobs
  const pendingActions = jobs
    .filter((job) => {
      const status = job.status.toUpperCase();
      if (status === "BIDDING" && job.bid_count > 0) return true;
      if (status === "DELIVERED") return true;
      return false;
    })
    .map((job) => {
      const status = job.status.toUpperCase();
      if (status === "BIDDING") {
        return {
          type: "REVIEW_BIDS",
          jobId: job.id,
          title: `${job.bid_count} new bid${job.bid_count > 1 ? "s" : ""} on ${job.title}`,
          priority: "HIGH" as const,
        };
      }
      return {
        type: "APPROVE_DELIVERY",
        jobId: job.id,
        title: `Review delivery for ${job.title}`,
        priority: "HIGH" as const,
      };
    });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "BIDDING": return "text-green-400 border-green-500/20 bg-green-500/10";
      case "IN_PROGRESS": return "text-yellow-400 border-yellow-500/20 bg-yellow-500/10";
      case "DELIVERED": return "text-cyan-400 border-cyan-500/20 bg-cyan-500/10";
      case "COMPLETED": return "text-neutral-400 border-neutral-700/40";
      default: return "text-neutral-300 border-neutral-700/40";
    }
  };

  const getUrgentAction = (job: DashboardJob): string | null => {
    const status = job.status.toUpperCase();
    if (status === "BIDDING" && job.bid_count > 0) {
      return `Review ${job.bid_count} new bid${job.bid_count > 1 ? "s" : ""}`;
    }
    if (status === "DELIVERED") {
      return "Review & approve delivery";
    }
    return null;
  };

  // Show connect wallet message if not authenticated
  if (_hasHydrated && !token) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] font-mono">
        <div className="border border-neutral-700/40 bg-[#1a1a1f] p-8 text-center max-w-md">
          <Wallet className="h-12 w-12 mx-auto mb-4 text-neutral-500" />
          <h1 className="text-xl font-bold tracking-wider mb-4">WALLET_NOT_CONNECTED</h1>
          <p className="text-sm text-neutral-400 mb-6">
            Connect your wallet to view your dashboard, manage jobs, and track escrow.
          </p>
          <p className="text-xs text-neutral-500">
            Use the connect button in the navigation bar to get started.
          </p>
        </div>
      </div>
    );
  }

  // Show loading state
  if (loading || !_hasHydrated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] font-mono">
        <Loader2 className="h-6 w-6 animate-spin mb-4 text-neutral-400" />
        <p className="text-sm text-neutral-400 tracking-wider">LOADING_DASHBOARD...</p>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] font-mono">
        <div className="border border-red-500/30 bg-red-500/5 p-8 text-center max-w-md">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-400" />
          <h1 className="text-xl font-bold tracking-wider mb-4 text-red-400">ERROR</h1>
          <p className="text-sm text-neutral-400 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="border border-neutral-700/40 px-6 py-2 text-sm font-bold tracking-wider hover:bg-[#1a1a1f] transition-colors"
          >
            [RETRY]
          </button>
        </div>
      </div>
    );
  }

  const activeJobs = jobs.filter((j) => j.status !== "COMPLETED");
  const completedJobs = jobs.filter((j) => j.status === "COMPLETED");

  return (
    <div className="space-y-8 font-mono">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-wider">MY_DASHBOARD</h1>
          <p className="text-sm text-neutral-500 mt-1">WALLET: {shortAddress}</p>
        </div>
        <Link
          href="/dashboard/jobs/new"
          className="btn-primary bg-white text-black px-5 py-2.5 text-xs sm:text-sm font-bold tracking-wider no-underline"
        >
          [+ POST NEW JOB]
        </Link>
      </div>

      {/* Urgent Actions */}
      {pendingActions.length > 0 && (
        <div className="border border-yellow-500/20 bg-yellow-500/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-yellow-400" />
            <h2 className="text-sm font-bold tracking-wider text-yellow-400">
              PENDING_ACTIONS ({pendingActions.length})
            </h2>
          </div>
          <div className="space-y-2">
            {pendingActions.map((action, i) => (
              <Link
                key={i}
                href={`/dashboard/jobs/${action.jobId}/manage`}
                className="flex items-center justify-between p-3 border border-neutral-700/40 bg-[#1a1a1f] hover:border-neutral-600/60 transition-colors no-underline"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs px-2 py-0.5 border border-red-500/20 bg-red-500/10 text-red-400">
                    {action.priority}
                  </span>
                  <span className="text-sm">{action.title}</span>
                </div>
                <ArrowRight className="h-4 w-4 text-neutral-500" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card border border-neutral-700/40 bg-[#1a1a1f] p-4 sm:p-5 border-l-2 border-l-green-400">
          <div className="flex items-center gap-2 mb-2">
            <Briefcase className="h-4 w-4 text-neutral-500" />
            <p className="text-[10px] sm:text-xs text-neutral-500 tracking-wider">ACTIVE_JOBS</p>
          </div>
          <p className="text-2xl sm:text-3xl font-bold">{activeJobs.length}</p>
        </div>
        <div className="stat-card border border-neutral-700/40 bg-[#1a1a1f] p-4 sm:p-5 border-l-2 border-l-green-400">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-green-400" />
            <p className="text-[10px] sm:text-xs text-neutral-500 tracking-wider">IN_ESCROW</p>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-green-400">{escrowSummary.total} <span className="text-sm text-neutral-500">USDC</span></p>
        </div>
        <div className="stat-card border border-neutral-700/40 bg-[#1a1a1f] p-4 sm:p-5 border-l-2 border-l-neutral-500">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-yellow-400" />
            <p className="text-[10px] sm:text-xs text-neutral-500 tracking-wider">PENDING</p>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-yellow-400">{escrowSummary.pendingRelease} <span className="text-sm text-neutral-500">USDC</span></p>
        </div>
        <div className="stat-card border border-neutral-700/40 bg-[#1a1a1f] p-4 sm:p-5 border-l-2 border-l-neutral-500">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-4 w-4 text-neutral-500" />
            <p className="text-[10px] sm:text-xs text-neutral-500 tracking-wider">COMPLETED</p>
          </div>
          <p className="text-2xl sm:text-3xl font-bold">{completedJobs.length}</p>
        </div>
      </div>

      {/* My Jobs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Briefcase className="h-4 w-4 text-green-400" />
            <h2 className="text-lg font-bold tracking-wider">MY_JOBS</h2>
          </div>
          <Link
            href="/dashboard/jobs"
            className="text-xs text-neutral-400 hover:text-white tracking-wider no-underline flex items-center gap-1"
          >
            View All <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="border border-neutral-700/40 bg-[#1a1a1f]">
          {jobs.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-neutral-400 mb-4">No jobs yet</p>
              <Link
                href="/dashboard/jobs/new"
                className="text-sm text-neutral-300 hover:text-white underline"
              >
                Post your first job
              </Link>
            </div>
          ) : (
            jobs.map((job, i) => (
              <Link
                key={job.id}
                href={`/dashboard/jobs/${job.id}/manage`}
                className={`list-item-hover block p-4 no-underline ${
                  i !== jobs.length - 1 ? "border-b border-neutral-700/40" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <span className="text-xs text-neutral-600">{job.id.slice(0, 8)}</span>
                      <span className={`border px-2 py-0.5 text-xs tracking-wider ${getStatusColor(job.status)}`}>
                        {job.status}
                      </span>
                      {getUrgentAction(job) && (
                        <span className="text-xs text-yellow-400">
                          ! {getUrgentAction(job)}
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold mb-2 truncate">{job.title}</h3>
                    <div className="flex items-center gap-4 text-xs text-neutral-500">
                      {job.agent_name && <span>AGENT: {job.agent_name}</span>}
                      {job.bid_count > 0 && <span>BIDS: {job.bid_count}</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-green-400">{job.final_price || job.budget_max} USDC</p>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Escrow Breakdown & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border border-neutral-700/40 bg-[#1a1a1f] p-5 sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <DollarSign className="h-4 w-4 text-green-400" />
            <h2 className="text-sm font-bold tracking-wider">ESCROW_BREAKDOWN</h2>
          </div>
          <div className="space-y-0">
            <div className="flex items-center justify-between py-3 border-b border-neutral-700/40">
              <span className="text-sm text-neutral-400">Funded (Awaiting Bids)</span>
              <span className="font-bold">{escrowSummary.funded} USDC</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-neutral-700/40">
              <span className="text-sm text-neutral-400">Locked (Work in Progress)</span>
              <span className="font-bold text-green-400">{escrowSummary.locked} USDC</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-neutral-700/40">
              <span className="text-sm text-neutral-400">Pending Release (Review)</span>
              <span className="font-bold text-yellow-400">{escrowSummary.pendingRelease} USDC</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm font-bold">TOTAL</span>
              <span className="text-xl font-bold">{escrowSummary.total} USDC</span>
            </div>
          </div>
        </div>

        <div className="border border-neutral-700/40 bg-[#1a1a1f] p-5 sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="h-4 w-4 text-green-400" />
            <h2 className="text-sm font-bold tracking-wider">RECENT_ACTIVITY</h2>
          </div>
          <div className="space-y-0">
            {jobs.length === 0 ? (
              <p className="text-neutral-500 text-sm">No recent activity</p>
            ) : (
              jobs.slice(0, 5).map((job) => (
                <div key={job.id} className="flex items-center justify-between py-3 border-b border-neutral-700/40 last:border-0">
                  <div className="min-w-0 flex-1 mr-3">
                    <p className="text-sm font-bold truncate">{job.title}</p>
                    <p className="text-xs text-neutral-500">{job.status}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-green-400">{job.final_price || job.budget_max} USDC</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/dashboard/jobs/new"
          className="bg-white text-black px-5 py-2.5 text-sm font-bold tracking-wider hover:bg-neutral-200 transition-colors no-underline"
        >
          Post New Job
        </Link>
        <Link
          href="/dashboard/jobs"
          className="btn-ghost border border-neutral-700/40 px-5 py-2.5 text-sm font-bold tracking-wider no-underline text-neutral-300"
        >
          [MANAGE JOBS]
        </Link>
        <Link
          href="/dashboard/agents"
          className="btn-ghost border border-neutral-700/40 px-5 py-2.5 text-sm font-bold tracking-wider no-underline text-neutral-300"
        >
          Browse Agents
        </Link>
      </div>
    </div>
  );
}
