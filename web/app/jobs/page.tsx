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
    <div className="min-h-screen bg-black text-white font-mono">
      <Header />

      {/* Page Header */}
      <div className="border-b-2 border-white">
        <div className="max-w-[1400px] mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Activity className="h-5 w-5 text-green-400" />
                <h1 className="text-2xl font-bold tracking-wider">MARKETPLACE</h1>
                <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
              </div>
              <p className="text-sm text-white/50">
                {total} LIVE JOBS • {totalBids} TOTAL BIDS
              </p>
            </div>
            <Link
              href="/dashboard/jobs/new"
              className="border-2 border-white px-6 py-3 text-sm font-bold tracking-wider bg-white text-black hover:bg-black hover:text-white transition-colors"
            >
              [+ POST JOB]
            </Link>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="SEARCH JOBS..."
                className="w-full bg-black border-2 border-white pl-12 pr-4 py-3 text-sm placeholder:text-white/30 focus:outline-none focus:bg-white/5"
              />
            </div>
            <div className="flex gap-2">
              {(["ALL", "OPEN", "BIDDING", "IN_PROGRESS"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-4 py-3 text-xs font-bold tracking-wider border-2 transition-colors ${
                    statusFilter === status
                      ? "border-white bg-white text-black"
                      : "border-white/50 text-white/50 hover:border-white hover:text-white"
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
      <main className="max-w-[1400px] mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-white/50" />
            <span className="ml-3 text-white/50">LOADING JOBS...</span>
          </div>
        ) : error ? (
          <div className="border-2 border-red-500 p-12 text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="border-2 border-white px-6 py-3 text-sm font-bold tracking-wider hover:bg-white hover:text-black transition-colors"
            >
              [RETRY]
            </button>
          </div>
        ) : jobs.length > 0 ? (
          <>
            <div className="grid md:grid-cols-2 gap-4">
              {jobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="block border-2 border-white p-5 hover:bg-white hover:text-black transition-colors group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`text-xs px-2 py-0.5 border ${
                        job.status === "BIDDING" || job.status === "OPEN"
                          ? "border-green-400 text-green-400 group-hover:border-green-700 group-hover:text-green-700"
                          : "border-white text-white group-hover:border-black group-hover:text-black"
                      }`}
                    >
                      {job.status}
                    </span>
                    <div className="flex items-center gap-4 text-xs text-white/50 group-hover:text-black/50">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {job.bids_count || 0} BIDS
                      </span>
                      <span>{job.views || 0} VIEWS</span>
                    </div>
                  </div>

                  <h2 className="text-lg font-bold tracking-wider mb-2">{job.title}</h2>
                  <p className="text-sm text-white/60 group-hover:text-black/60 mb-4 line-clamp-2">
                    {job.description}
                  </p>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {(job.skills || []).map((skill) => (
                      <span
                        key={skill}
                        className="text-[10px] px-2 py-0.5 border border-white/50 group-hover:border-black/50"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-white/20 group-hover:border-black/20">
                    <span className="text-lg font-bold text-green-400 group-hover:text-green-700">
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
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className={`px-4 py-2 text-xs font-bold tracking-wider border-2 ${
                    page === 1
                      ? "border-white/30 text-white/30 cursor-not-allowed"
                      : "border-white text-white hover:bg-white hover:text-black"
                  }`}
                >
                  [PREV]
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    // Show pages around current page
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
                        className={`w-10 h-10 text-xs font-bold tracking-wider border-2 ${
                          page === pageNum
                            ? "border-white bg-white text-black"
                            : "border-white/50 text-white/50 hover:border-white hover:text-white"
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
                  className={`px-4 py-2 text-xs font-bold tracking-wider border-2 ${
                    page === totalPages
                      ? "border-white/30 text-white/30 cursor-not-allowed"
                      : "border-white text-white hover:bg-white hover:text-black"
                  }`}
                >
                  [NEXT]
                </button>
              </div>
            )}
            <p className="text-center text-xs text-white/40 mt-4">
              Showing {(page - 1) * JOBS_PER_PAGE + 1}-{Math.min(page * JOBS_PER_PAGE, total)} of {total} jobs
            </p>
          </>
        ) : (
          <div className="border-2 border-white p-12 text-center">
            <p className="text-white/60 mb-4">NO_JOBS_FOUND</p>
            <p className="text-white/40 text-sm mb-6">Be the first to post a job on WishMaster</p>
            <Link
              href="/dashboard/jobs/new"
              className="border-2 border-white px-6 py-3 text-sm font-bold tracking-wider hover:bg-white hover:text-black transition-colors inline-block"
            >
              [POST FIRST JOB]
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
