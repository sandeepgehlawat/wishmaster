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
        // Transform JobWithDetails to DashboardJob
        // Handle both flat (serde flatten) and nested (legacy) formats
        const transformedJobs: DashboardJob[] = (jobsResponse.jobs || [])
          .filter((jwd: any) => jwd != null)
          .map((jwd: any) => {
            // Handle both flat and nested job structures
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
      case "BIDDING": return "text-green-400 border-green-400";
      case "IN_PROGRESS": return "text-yellow-400 border-yellow-400";
      case "DELIVERED": return "text-cyan-400 border-cyan-400";
      case "COMPLETED": return "text-white/50 border-white/50";
      default: return "text-white border-white";
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
        <div className="border-2 border-white p-8 text-center max-w-md">
          <Wallet className="h-12 w-12 mx-auto mb-4 text-white/60" />
          <h1 className="text-xl font-bold tracking-wider mb-4">WALLET_NOT_CONNECTED</h1>
          <p className="text-sm text-white/60 mb-6">
            Connect your wallet to view your dashboard, manage jobs, and track escrow.
          </p>
          <p className="text-xs text-white/40">
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
        <Loader2 className="h-8 w-8 animate-spin mb-4" />
        <p className="text-sm text-white/60 tracking-wider">LOADING_DASHBOARD...</p>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] font-mono">
        <div className="border-2 border-red-400 p-8 text-center max-w-md">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-400" />
          <h1 className="text-xl font-bold tracking-wider mb-4 text-red-400">ERROR</h1>
          <p className="text-sm text-white/60 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="border-2 border-white px-6 py-2 text-sm font-bold tracking-wider hover:bg-white hover:text-black transition-colors"
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
          <h1 className="text-2xl font-bold tracking-wider">MY_DASHBOARD</h1>
          <p className="text-sm text-white/60 mt-1">WALLET: {shortAddress}</p>
        </div>
        <Link
          href="/dashboard/jobs/new"
          className="border-2 border-white px-6 py-3 text-sm font-bold tracking-wider bg-white text-black hover:bg-black hover:text-white transition-colors"
        >
          [+ POST NEW JOB]
        </Link>
      </div>

      {/* Urgent Actions */}
      {pendingActions.length > 0 && (
        <div className="border-2 border-yellow-400 bg-yellow-400/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
            <h2 className="text-sm font-bold tracking-wider text-yellow-400">
              PENDING_ACTIONS ({pendingActions.length})
            </h2>
          </div>
          <div className="space-y-2">
            {pendingActions.map((action, i) => (
              <Link
                key={i}
                href={`/dashboard/jobs/${action.jobId}/manage`}
                className="flex items-center justify-between p-3 border border-yellow-400/30 hover:bg-yellow-400/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 border ${
                    action.priority === "HIGH" ? "border-red-400 text-red-400" : "border-white/50 text-white/50"
                  }`}>
                    {action.priority}
                  </span>
                  <span className="text-sm">{action.title}</span>
                </div>
                <ArrowRight className="h-4 w-4" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0">
        <div className="border-2 border-white p-6 md:-ml-[2px] md:first:ml-0">
          <div className="flex items-center gap-2 mb-2">
            <Briefcase className="h-4 w-4 text-white/60" />
            <p className="text-xs text-white/60 tracking-wider">ACTIVE_JOBS</p>
          </div>
          <p className="text-3xl font-bold">{activeJobs.length}</p>
        </div>
        <div className="border-2 border-white p-6 -mt-[2px] md:mt-0 md:-ml-[2px]">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-green-400" />
            <p className="text-xs text-white/60 tracking-wider">TOTAL_IN_ESCROW</p>
          </div>
          <p className="text-3xl font-bold text-green-400">{escrowSummary.total} USDC</p>
        </div>
        <div className="border-2 border-white p-6 -mt-[2px] md:mt-0 md:-ml-[2px]">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-yellow-400" />
            <p className="text-xs text-white/60 tracking-wider">PENDING_RELEASE</p>
          </div>
          <p className="text-3xl font-bold text-yellow-400">{escrowSummary.pendingRelease} USDC</p>
        </div>
        <div className="border-2 border-white p-6 -mt-[2px] md:mt-0 md:-ml-[2px]">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-4 w-4 text-white/60" />
            <p className="text-xs text-white/60 tracking-wider">COMPLETED_JOBS</p>
          </div>
          <p className="text-3xl font-bold">{completedJobs.length}</p>
        </div>
      </div>

      {/* My Jobs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold tracking-wider">{`>>> MY_JOBS`}</h2>
          <Link
            href="/dashboard/jobs"
            className="text-xs text-white/50 hover:text-white tracking-wider"
          >
            VIEW ALL &gt;
          </Link>
        </div>
        <div className="border-2 border-white">
          {jobs.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-white/60 mb-4">No jobs yet</p>
              <Link
                href="/dashboard/jobs/new"
                className="text-sm text-white/80 hover:text-white underline"
              >
                Post your first job
              </Link>
            </div>
          ) : (
            jobs.map((job, i) => (
              <Link
                key={job.id}
                href={`/dashboard/jobs/${job.id}/manage`}
                className={`block p-4 hover:bg-white/5 transition-colors ${
                  i !== jobs.length - 1 ? "border-b border-white/30" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs text-white/40">{job.id.slice(0, 8)}</span>
                      <span className={`border px-2 py-0.5 text-xs tracking-wider ${getStatusColor(job.status)}`}>
                        {job.status}
                      </span>
                      {getUrgentAction(job) && (
                        <span className="text-xs text-yellow-400 animate-pulse">
                          ! {getUrgentAction(job)}
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold mb-2">{job.title}</h3>
                    <div className="flex items-center gap-4 text-xs text-white/60">
                      {job.agent_name && <span>AGENT: {job.agent_name}</span>}
                      {job.bid_count > 0 && <span>BIDS: {job.bid_count}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{job.final_price || job.budget_max} USDC</p>
                    <p className={`text-xs mt-1 ${
                      job.status.toUpperCase() === "DELIVERED" ? "text-yellow-400" :
                      job.status.toUpperCase() === "IN_PROGRESS" || job.status.toUpperCase() === "ASSIGNED" ? "text-green-400" :
                      job.status.toUpperCase() === "COMPLETED" ? "text-white/50" :
                      "text-white"
                    }`}>
                      {job.status}
                    </p>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Escrow Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border-2 border-white p-6">
          <h2 className="text-lg font-bold tracking-wider mb-4">{`>>> ESCROW_BREAKDOWN`}</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-white/20">
              <span className="text-sm text-white/60">Funded (Awaiting Bids)</span>
              <span className="font-bold">{escrowSummary.funded} USDC</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-white/20">
              <span className="text-sm text-white/60">Locked (Work in Progress)</span>
              <span className="font-bold text-green-400">{escrowSummary.locked} USDC</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-white/20">
              <span className="text-sm text-white/60">Pending Release (Review)</span>
              <span className="font-bold text-yellow-400">{escrowSummary.pendingRelease} USDC</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm font-bold">TOTAL</span>
              <span className="text-xl font-bold">{escrowSummary.total} USDC</span>
            </div>
          </div>
        </div>

        {/* Empty transactions section - can be filled with real data later */}
        <div className="border-2 border-white p-6">
          <h2 className="text-lg font-bold tracking-wider mb-4">{`>>> RECENT_ACTIVITY`}</h2>
          <div className="space-y-3">
            {jobs.length === 0 ? (
              <p className="text-white/60 text-sm">No recent activity</p>
            ) : (
              jobs.slice(0, 5).map((job) => (
                <div key={job.id} className="flex items-center justify-between py-2 border-b border-white/20 last:border-0">
                  <div>
                    <p className="text-sm font-bold truncate max-w-[200px]">{job.title}</p>
                    <p className="text-xs text-white/50">{job.status}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{job.final_price || job.budget_max} USDC</p>
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
          className="border-2 border-white px-6 py-3 text-sm font-bold tracking-wider bg-white text-black hover:bg-black hover:text-white transition-colors"
        >
          Post New Job
        </Link>
        <Link
          href="/dashboard/jobs"
          className="border-2 border-white px-6 py-3 text-sm font-bold tracking-wider hover:bg-white hover:text-black transition-colors"
        >
          [MANAGE JOBS]
        </Link>
        <Link
          href="/dashboard/agents"
          className="border-2 border-white px-6 py-3 text-sm font-bold tracking-wider hover:bg-white hover:text-black transition-colors"
        >
          Browse Agents
        </Link>
      </div>
    </div>
  );
}
