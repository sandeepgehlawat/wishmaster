"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Clock,
  Users,
  ArrowRight,
  Activity,
  Search,
  Filter,
  Loader2,
} from "lucide-react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { JobCardSkeletonGrid } from "@/components/skeletons";
import { listJobs } from "@/lib/api";
import { useDebounce } from "@/hooks/use-debounce";

interface Job {
  id: string;
  title: string;
  description: string;
  budget_min?: number;
  budget_max?: number;
  budget?: string;
  skills: string[];
  status: string;
  deadline?: string;
  bids_count?: number;
  views?: number;
}

function formatBudget(job: Job): string {
  if (job.budget) return job.budget;
  if (job.budget_min && job.budget_max) {
    return `${job.budget_min}-${job.budget_max} USDC`;
  }
  return "TBD";
}

function getTimeLeft(deadline?: string): string {
  if (!deadline) return "48:00:00";
  const now = new Date();
  const end = new Date(deadline);
  const diff = end.getTime() - now.getTime();
  if (diff <= 0) return "00:00:00";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function LiveTimer({ initial }: { initial: string }) {
  const [parts, setParts] = useState(() => initial.split(":").map(Number));

  useEffect(() => {
    const timer = setInterval(() => {
      setParts((prev) => {
        let [h, m, s] = prev;
        s -= 1;
        if (s < 0) { s = 59; m -= 1; }
        if (m < 0) { m = 59; h -= 1; }
        if (h < 0) return [0, 0, 0];
        return [h, m, s];
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const pad = (n: number) => String(n).padStart(2, "0");
  const isUrgent = parts[0] < 6;

  return (
    <span className={`font-mono ${isUrgent ? "text-red-500 animate-pulse" : "text-white/60"}`}>
      {pad(parts[0])}:{pad(parts[1])}:{pad(parts[2])}
    </span>
  );
}

const JOBS_PER_PAGE = 10;

export default function MarketplacePage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OPEN" | "BIDDING" | "IN_PROGRESS">("ALL");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  // Debounce search to avoid excessive API calls
  const debouncedSearch = useDebounce(search, 300);

  const totalPages = Math.ceil(total / JOBS_PER_PAGE);

  useEffect(() => {
    async function fetchJobs() {
      try {
        setLoading(true);
        setError(null);
        const params: Record<string, string> = {
          page: String(page),
          limit: String(JOBS_PER_PAGE),
        };
        if (statusFilter !== "ALL") {
          // Backend expects lowercase status
          params.status = statusFilter.toLowerCase();
        }
        if (debouncedSearch) {
          params.search = debouncedSearch;
        }
        const response = await listJobs(params);
        // Map API response to frontend interface
        const mappedJobs = (response.jobs || []).map((j: any) => ({
          id: j.job?.id || j.id,
          title: j.job?.title || j.title,
          description: j.job?.description || j.description,
          budget_min: parseFloat(j.job?.budget_min || j.budget_min) || 0,
          budget_max: parseFloat(j.job?.budget_max || j.budget_max) || 0,
          skills: j.job?.required_skills || j.required_skills || [],
          status: (j.job?.status || j.status || "open").toUpperCase(),
          deadline: j.job?.bid_deadline || j.job?.deadline || j.bid_deadline || j.deadline,
          bids_count: j.bid_count || 0,
          views: 0,
        }));
        setJobs(mappedJobs);
        setTotal(response.total || 0);
      } catch (err) {
        console.error("Failed to fetch jobs:", err);
        setError("Failed to load jobs");
      } finally {
        setLoading(false);
      }
    }
    fetchJobs();
  }, [statusFilter, debouncedSearch, page]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, debouncedSearch]);

  const totalBids = jobs.reduce((sum, j) => sum + (j.bids_count || 0), 0);
  const liveJobs = jobs.length;

  return (
    <div className="min-h-screen flex flex-col bg-[#131519] text-white font-mono">
      <Header />

      {/* Page Header */}
      <div className="border-b border-neutral-700/40">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Activity className="h-4 w-4 text-secondary-400" />
                <h1 className="text-xl md:text-2xl font-bold tracking-wider">MARKETPLACE</h1>
                <span className="h-2 w-2 rounded-full bg-secondary-400 animate-pulse" />
              </div>
              <p className="text-xs sm:text-sm text-neutral-400">
                {total} LIVE JOBS • {totalBids} TOTAL BIDS
              </p>
            </div>
            <Link
              href="/dashboard/jobs/new"
              className="btn-primary border-2 border-white px-5 py-2.5 text-xs sm:text-sm font-bold tracking-wider bg-white text-black hover:bg-neutral-200 no-underline"
            >
              [+ POST JOB]
            </Link>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="SEARCH JOBS..."
                className="input-glow w-full bg-[#131519] border border-neutral-700/40 pl-12 pr-4 py-3 text-sm placeholder:text-neutral-500 focus:outline-none"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 -mb-1 scrollbar-none">
              {(["ALL", "OPEN", "BIDDING", "IN_PROGRESS"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`tag-hover px-3 sm:px-4 py-2 sm:py-3 text-xs font-bold tracking-wider border whitespace-nowrap flex-shrink-0 ${
                    statusFilter === status
                      ? "border-white bg-white text-black"
                      : "border-neutral-700/40 text-neutral-400 hover:border-neutral-500 hover:text-white"
                  }`}
                >
                  {status.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Job Grid */}
      <main className="flex-1 max-w-[1400px] mx-auto px-4 sm:px-6 py-8 w-full">
        {loading ? (
          <JobCardSkeletonGrid count={6} />
        ) : error ? (
          <div className="border border-red-500/60 bg-red-500/5 p-8 sm:p-12 text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="border-2 border-white px-6 py-3 text-sm font-bold tracking-wider hover:bg-white hover:text-black transition-colors"
            >
              [RETRY]
            </button>
          </div>
        ) : jobs.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {jobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="card-interactive block border border-neutral-700/40 bg-[#1a1a1f] p-5 group no-underline"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`text-xs font-mono px-2 py-0.5 border ${
                        job.status === "BIDDING" || job.status === "OPEN"
                          ? "border-secondary-400 text-secondary-400"
                          : "border-neutral-500 text-neutral-400"
                      }`}
                    >
                      {job.status}
                    </span>
                    <div className="flex items-center gap-4 text-xs text-neutral-400">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {job.bids_count || 0} BIDS
                      </span>
                      <span className="hidden sm:inline">{job.views || 0} VIEWS</span>
                    </div>
                  </div>

                  <h2 className="text-base sm:text-lg font-bold tracking-wider mb-2">{job.title}</h2>
                  <p className="text-xs sm:text-sm text-neutral-400 mb-4 line-clamp-2">
                    {job.description}
                  </p>

                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {(job.skills || []).map((skill) => (
                      <span
                        key={skill}
                        className="text-[10px] px-2 py-0.5 border border-neutral-700/40 text-neutral-400 tracking-wide"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-neutral-700/40">
                    <span className="text-sm sm:text-lg font-bold text-secondary-400">
                      {formatBudget(job)}
                    </span>
                    <div className="flex items-center gap-2 text-xs">
                      <Clock className="h-3 w-3" />
                      <LiveTimer initial={getTimeLeft(job.deadline)} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1 sm:gap-2 mt-8">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className={`px-3 sm:px-4 py-2 text-xs font-bold tracking-wider border ${
                    page === 1
                      ? "border-neutral-700/40 text-neutral-600 cursor-not-allowed"
                      : "border-neutral-700/40 text-neutral-400 hover:border-white hover:text-white"
                  }`}
                >
                  [PREV]
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`w-8 h-8 sm:w-10 sm:h-10 text-xs font-bold tracking-wider border ${
                          page === pageNum
                            ? "border-white bg-white text-black"
                            : "border-neutral-700/40 text-neutral-400 hover:border-white hover:text-white"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className={`px-3 sm:px-4 py-2 text-xs font-bold tracking-wider border ${
                    page === totalPages
                      ? "border-neutral-700/40 text-neutral-600 cursor-not-allowed"
                      : "border-neutral-700/40 text-neutral-400 hover:border-white hover:text-white"
                  }`}
                >
                  [NEXT]
                </button>
              </div>
            )}
            <p className="text-center text-xs text-neutral-500 mt-4">
              Showing {(page - 1) * JOBS_PER_PAGE + 1}-{Math.min(page * JOBS_PER_PAGE, total)} of {total} jobs
            </p>
          </>
        ) : (
          <div className="border border-neutral-700/40 p-8 sm:p-12 text-center">
            <p className="text-neutral-400 mb-4">NO_JOBS_FOUND</p>
            <p className="text-neutral-500 text-sm mb-6">Be the first to post a job on WishMaster</p>
            <Link
              href="/dashboard/jobs/new"
              className="border-2 border-white px-6 py-3 text-sm font-bold tracking-wider hover:bg-white hover:text-black transition-colors inline-block"
            >
              [POST FIRST JOB]
            </Link>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
