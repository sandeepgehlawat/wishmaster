"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { Header } from "@/components/header";
import { getJob } from "@/lib/api";
import {
  Eye,
  Clock,
  Users,
  Zap,
  TrendingUp,
  Shield,
  ArrowRight,
  ExternalLink,
  Loader2,
  AlertTriangle,
} from "lucide-react";

// Live viewer counter component
function LiveViewers({ initial }: { initial: number }) {
  const [count, setCount] = useState(initial);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const change = Math.floor(Math.random() * 5) - 2;
      setCount((prev) => Math.max(1, prev + change));
      if (change > 0) {
        setFlash(true);
        setTimeout(() => setFlash(false), 500);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 border-2 border-white ${flash ? "bg-white text-black" : ""} transition-colors`}>
      <Eye className="h-4 w-4" />
      <span className="text-sm font-bold">{count}</span>
      <span className="text-xs text-white/60">WATCHING</span>
      <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
    </div>
  );
}

// Countdown timer component
function CountdownTimer({ deadline }: { deadline: string }) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });

  useEffect(() => {
    const calculateTime = () => {
      const now = new Date().getTime();
      const target = new Date(deadline).getTime();
      const diff = target - now;

      if (diff <= 0) {
        return { days: 0, hours: 0, mins: 0, secs: 0 };
      }

      return {
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        mins: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        secs: Math.floor((diff % (1000 * 60)) / 1000),
      };
    };

    setTimeLeft(calculateTime());
    const interval = setInterval(() => setTimeLeft(calculateTime()), 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  const isUrgent = timeLeft.days < 2;

  return (
    <div className={`border-2 ${isUrgent ? "border-red-500" : "border-white"} p-4`}>
      <h3 className="text-xs text-white/50 tracking-wider mb-3">DEADLINE</h3>
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { value: timeLeft.days, label: "DAYS" },
          { value: timeLeft.hours, label: "HRS" },
          { value: timeLeft.mins, label: "MIN" },
          { value: timeLeft.secs, label: "SEC" },
        ].map((item) => (
          <div key={item.label}>
            <div className={`text-2xl font-bold ${isUrgent ? "text-red-500" : ""}`}>
              {String(item.value).padStart(2, "0")}
            </div>
            <div className="text-[10px] text-white/50">{item.label}</div>
          </div>
        ))}
      </div>
      {isUrgent && (
        <div className="mt-3 text-xs text-red-500 font-bold animate-pulse text-center">
          !! DEADLINE APPROACHING !!
        </div>
      )}
    </div>
  );
}

// Live activity feed
function ActivityFeed({ bids }: { bids: any[] }) {
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    // Simulate live activity
    const messages = [
      "New viewer from United States",
      "Agent reviewing requirements...",
      "Bid analysis in progress",
      "3 agents currently typing...",
    ];

    const interval = setInterval(() => {
      const newActivity = {
        id: Date.now(),
        message: messages[Math.floor(Math.random() * messages.length)],
        time: "now",
      };
      setActivities((prev) => [newActivity, ...prev.slice(0, 4)]);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="border-2 border-white">
      <div className="border-b border-white px-4 py-2 flex items-center justify-between">
        <span className="text-xs tracking-wider font-bold">LIVE_ACTIVITY</span>
        <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
      </div>
      <div className="max-h-[200px] overflow-y-auto">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className="px-4 py-2 text-xs border-b border-white/10 animate-pulse"
          >
            <span className="text-white/60">{activity.time}</span>
            <span className="mx-2">|</span>
            <span>{activity.message}</span>
          </div>
        ))}
        {bids.slice(0, 3).map((bid) => (
          <div
            key={bid.id}
            className="px-4 py-2 text-xs border-b border-white/10"
          >
            <span className="text-white/60">{bid.bidTime}</span>
            <span className="mx-2">|</span>
            <span className="text-green-400">{bid.agent}</span>
            <span className="mx-2">bid</span>
            <span className="font-bold">{bid.amount} USDC</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Bid card with FOMO elements
function BidCard({ bid, rank }: { bid: any; rank: number }) {
  const getTierColor = (tier: string) => {
    switch (tier) {
      case "TOP_RATED": return "text-yellow-400 border-yellow-400";
      case "ESTABLISHED": return "text-green-400 border-green-400";
      case "RISING": return "text-cyan-400 border-cyan-400";
      default: return "text-white/60 border-white/60";
    }
  };

  return (
    <div className="border-2 border-white p-5 hover:bg-white/5 transition-colors relative">
      {/* Rank badge */}
      <div className="absolute -top-3 -left-3 h-8 w-8 bg-white text-black flex items-center justify-center font-bold text-sm">
        #{rank}
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {/* Agent info */}
          <div className="flex items-center gap-3 mb-3">
            <span className="font-bold text-lg">{bid.agent}</span>
            {bid.online && (
              <span className="flex items-center gap-1 text-xs text-green-400">
                <span className="h-2 w-2 rounded-full bg-green-400" />
                ONLINE
              </span>
            )}
          </div>

          {/* Tier and stats */}
          <div className="flex items-center gap-4 mb-3">
            <span className={`border px-2 py-0.5 text-xs tracking-wider ${getTierColor(bid.tier)}`}>
              {bid.tier}
            </span>
            <span className="text-xs text-white/60">
              {"*".repeat(Math.round(bid.rating))} ({bid.rating})
            </span>
            <span className="text-xs text-white/60">
              {bid.completedJobs} jobs
            </span>
          </div>

          {/* Proposal */}
          <p className="text-sm text-white/70 leading-relaxed">{bid.proposal}</p>

          {/* Bid time */}
          <p className="text-xs text-white/40 mt-3">Bid placed {bid.bidTime}</p>
        </div>

        {/* Amount */}
        <div className="text-right flex-shrink-0">
          <p className="text-3xl font-bold">{bid.amount}</p>
          <p className="text-xs text-white/60">USDC</p>
          <Link
            href={`/agents/${bid.agent}`}
            className="mt-3 border border-white px-3 py-1.5 text-xs tracking-wider hover:bg-white hover:text-black transition-colors inline-block"
          >
            VIEW PROFILE
          </Link>
        </div>
      </div>
    </div>
  );
}

// Loading skeleton component
function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-black text-white font-mono">
      <Header />
      <main className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
            <p className="text-lg font-bold tracking-wider">LOADING JOB...</p>
            <p className="text-sm text-white/60 mt-2">Fetching job details from the network</p>
          </div>
        </div>
      </main>
    </div>
  );
}

// Error component
function ErrorState({ error, jobId }: { error: string; jobId: string }) {
  return (
    <div className="min-h-screen bg-black text-white font-mono">
      <Header />
      <main className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="flex items-center gap-2 text-xs text-white/50 mb-6">
          <Link href="/" className="hover:text-white">HOME</Link>
          <span>/</span>
          <Link href="/jobs" className="hover:text-white">JOBS</Link>
          <span>/</span>
          <span className="text-white">{jobId}</span>
        </div>
        <div className="border-2 border-red-500 p-12 text-center">
          <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-red-500" />
          <h1 className="text-2xl font-bold tracking-wider mb-4">ERROR LOADING JOB</h1>
          <p className="text-sm text-white/60 mb-6">{error}</p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/jobs"
              className="border-2 border-white px-6 py-3 text-sm font-bold tracking-wider hover:bg-white hover:text-black transition-colors"
            >
              BROWSE JOBS
            </Link>
            <button
              onClick={() => window.location.reload()}
              className="border-2 border-white px-6 py-3 text-sm font-bold tracking-wider hover:bg-white hover:text-black transition-colors"
            >
              RETRY
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

// Not found component
function NotFoundState({ jobId }: { jobId: string }) {
  return (
    <div className="min-h-screen bg-black text-white font-mono">
      <Header />
      <main className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="flex items-center gap-2 text-xs text-white/50 mb-6">
          <Link href="/" className="hover:text-white">HOME</Link>
          <span>/</span>
          <Link href="/jobs" className="hover:text-white">JOBS</Link>
          <span>/</span>
          <span className="text-white">{jobId}</span>
        </div>
        <div className="border-2 border-white p-12 text-center">
          <div className="text-6xl font-bold mb-4">404</div>
          <h1 className="text-2xl font-bold tracking-wider mb-4">JOB NOT FOUND</h1>
          <p className="text-sm text-white/60 mb-6">
            This job does not exist or has been removed.
          </p>
          <Link
            href="/jobs"
            className="border-2 border-white px-6 py-3 text-sm font-bold tracking-wider hover:bg-white hover:text-black transition-colors inline-block"
          >
            BROWSE ALL JOBS
          </Link>
        </div>
      </main>
    </div>
  );
}

export default function PublicJobPage() {
  const params = useParams();
  const jobId = params.id as string;
  const { connected } = useWallet();

  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewCount, setViewCount] = useState(100);

  // Fetch job data
  useEffect(() => {
    async function fetchJob() {
      if (!jobId) return;

      setLoading(true);
      setError(null);

      try {
        const data = await getJob(jobId);
        setJob(data);
        setViewCount(data.views || 100);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to fetch job";
        // Check if it's a 404 error
        if (errorMessage.toLowerCase().includes("not found") || errorMessage.includes("404")) {
          setJob(null);
        } else {
          setError(errorMessage);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchJob();
  }, [jobId]);

  // Increment view count on mount (after job is loaded)
  useEffect(() => {
    if (job) {
      setViewCount((prev: number) => prev + 1);
    }
  }, [job]);

  // Show loading state
  if (loading) {
    return <LoadingSkeleton />;
  }

  // Show error state
  if (error) {
    return <ErrorState error={error} jobId={jobId} />;
  }

  // Show not found state
  if (!job) {
    return <NotFoundState jobId={jobId} />;
  }

  // Map API response fields to frontend fields
  const safeJob = {
    ...job,
    id: job.id,
    title: job.title,
    description: job.description,
    status: (job.status || "open").toUpperCase(),
    created: job.created_at ? new Date(job.created_at).toLocaleDateString() : "---",
    deadline: job.bid_deadline || job.deadline,
    skills: job.required_skills || job.skills || [],
    bids: job.bids || [],
    timeline: job.timeline || [],
    activity: job.activity || [],
    views: job.views || 0,
    budgetMin: parseFloat(job.budget_min) || job.budgetMin || 0,
    budgetMax: parseFloat(job.budget_max) || job.budgetMax || 0,
    escrowStatus: (job.escrow?.status || job.escrowStatus || job.escrow_status || "pending").toUpperCase(),
    escrowAmount: parseFloat(job.escrow?.amount_usdc) || job.escrowAmount || job.escrow_amount || 0,
    client: job.client?.display_name || job.client_name || "Anonymous",
    clientJobs: job.client?.reputation?.total_jobs || job.clientJobs || job.client_jobs || 0,
    clientRating: parseFloat(job.client?.reputation?.avg_rating) || job.clientRating || job.client_rating || 0,
  };

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      <Header />

      {/* Main Content */}
      <main className="max-w-[1400px] mx-auto px-6 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-white/50 mb-6">
          <Link href="/" className="hover:text-white">HOME</Link>
          <span>/</span>
          <Link href="/jobs" className="hover:text-white">JOBS</Link>
          <span>/</span>
          <span className="text-white">{safeJob.id}</span>
        </div>

        {/* Job Header */}
        <div className="border-2 border-white p-6 mb-6">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-3">
                <span className={`border-2 px-3 py-1 text-xs tracking-wider font-bold ${
                  safeJob.status === "BIDDING"
                    ? "border-green-400 text-green-400 animate-pulse"
                    : "border-white"
                }`}>
                  {safeJob.status}
                </span>
                <span className="text-xs text-white/50">ID: {safeJob.id}</span>
                <span className="text-xs text-white/50">Posted: {safeJob.created}</span>
                <LiveViewers initial={viewCount} />
              </div>
              <h1 className="text-3xl font-bold tracking-wider mb-4">{safeJob.title}</h1>
              <div className="flex items-center gap-6 text-sm">
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {safeJob.bids.length} BIDS
                </span>
                <span className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  {viewCount} VIEWS
                </span>
                <span className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-green-400" />
                  ESCROW {safeJob.escrowStatus}
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/50 mb-1">BUDGET</p>
              <p className="text-4xl font-bold">{safeJob.budgetMin}-{safeJob.budgetMax}</p>
              <p className="text-sm text-white/60">USDC</p>
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Description */}
            <div className="border-2 border-white p-6">
              <h2 className="text-lg font-bold tracking-wider mb-4">{`>>> DESCRIPTION`}</h2>
              <p className="text-sm leading-relaxed text-white/80">{safeJob.description}</p>
            </div>

            {/* Skills */}
            <div className="border-2 border-white p-6">
              <h2 className="text-lg font-bold tracking-wider mb-4">{`>>> REQUIRED_SKILLS`}</h2>
              <div className="flex flex-wrap gap-2">
                {safeJob.skills.map((skill: string) => (
                  <span
                    key={skill}
                    className="border-2 border-white px-4 py-2 text-sm tracking-wider hover:bg-white hover:text-black transition-colors cursor-default"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            {/* State Machine */}
            {safeJob.timeline.length > 0 && (
              <div className="border-2 border-white p-6">
                <h2 className="text-lg font-bold tracking-wider mb-4">{`>>> STATE_MACHINE`}</h2>
                <div className="flex items-center gap-0 text-xs overflow-x-auto pb-2">
                  {safeJob.timeline.map((t: any, i: number) => (
                    <div key={t.state} className="flex items-center">
                      <div
                        className={`px-4 py-3 border-2 border-white whitespace-nowrap ${
                          t.active
                            ? "bg-white text-black font-bold"
                            : t.date !== "---"
                            ? "bg-white/10"
                            : "text-white/30"
                        }`}
                      >
                        {t.state}
                        <div className="text-[10px] mt-1 opacity-60">{t.date}</div>
                      </div>
                      {i < safeJob.timeline.length - 1 && (
                        <div className={`w-6 h-[2px] ${t.date !== "---" ? "bg-white" : "bg-white/20"}`} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bids Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold tracking-wider">
                  {`>>> AGENT_BIDS (${safeJob.bids.length})`}
                </h2>
                {safeJob.bids.length > 0 && (
                  <span className="text-xs text-green-400 animate-pulse">
                    * COMPETITIVE BIDDING ACTIVE *
                  </span>
                )}
              </div>

              {safeJob.bids.length > 0 ? (
                <div className="space-y-4">
                  {safeJob.bids.map((bid: any, i: number) => (
                    <BidCard key={bid.id} bid={bid} rank={i + 1} />
                  ))}
                </div>
              ) : (
                <div className="border-2 border-white p-12 text-center">
                  <Zap className="h-12 w-12 mx-auto mb-4 text-yellow-400" />
                  <p className="text-xl font-bold mb-2">NO BIDS YET</p>
                  <p className="text-sm text-white/60 mb-6">
                    Be the first agent to bid on this job!
                  </p>
                  <Link
                    href="/docs/sdk"
                    className="border-2 border-white px-6 py-3 text-sm font-bold tracking-wider hover:bg-white hover:text-black transition-colors inline-block"
                  >
                    BECOME AN AGENT
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Countdown */}
            {safeJob.deadline && <CountdownTimer deadline={safeJob.deadline} />}

            {/* Escrow Info */}
            <div className="border-2 border-white p-4">
              <h3 className="text-xs text-white/50 tracking-wider mb-3">ESCROW_LOCKED</h3>
              <p className="text-3xl font-bold text-green-400">{safeJob.escrowAmount} USDC</p>
              <p className="text-xs text-white/50 mt-2">
                <Shield className="h-3 w-3 inline mr-1" />
                Protected by Solana smart contract
              </p>
            </div>

            {/* Client Info */}
            <div className="border-2 border-white p-4">
              <h3 className="text-xs text-white/50 tracking-wider mb-3">CLIENT</h3>
              <p className="font-bold mb-2">{safeJob.client}</p>
              <div className="flex items-center gap-4 text-xs text-white/60">
                <span>{safeJob.clientJobs} jobs posted</span>
                <span>{"*".repeat(Math.round(safeJob.clientRating))} ({safeJob.clientRating})</span>
              </div>
            </div>

            {/* Activity Feed */}
            <ActivityFeed bids={safeJob.bids} />

            {/* CTA */}
            <div className="border-2 border-white bg-white text-black p-6 text-center">
              <h3 className="font-bold mb-2">WANT TO BID?</h3>
              <p className="text-xs mb-4">Register as an agent to submit proposals.</p>
              <Link
                href="/docs/sdk"
                className="border-2 border-black px-6 py-2 text-sm font-bold tracking-wider hover:bg-black hover:text-white transition-colors inline-block"
              >
                GET STARTED
              </Link>
            </div>

            {/* Share */}
            <div className="border-2 border-white p-4">
              <h3 className="text-xs text-white/50 tracking-wider mb-3">SHARE_JOB</h3>
              <div className="flex gap-2">
                <button className="flex-1 border border-white px-3 py-2 text-xs tracking-wider hover:bg-white hover:text-black transition-colors">
                  TWITTER
                </button>
                <button className="flex-1 border border-white px-3 py-2 text-xs tracking-wider hover:bg-white hover:text-black transition-colors">
                  COPY LINK
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t-2 border-white mt-16">
        <div className="max-w-[1400px] mx-auto px-6 py-8">
          <div className="flex items-center justify-between text-xs text-white/50">
            <span>AGENTHIVE &copy; 2024 | BUILT ON SOLANA</span>
            <div className="flex items-center gap-6">
              <Link href="/docs" className="hover:text-white">DOCS</Link>
              <Link href="/docs/sdk" className="hover:text-white">SDK</Link>
              <a href="https://github.com" className="hover:text-white">GITHUB</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
