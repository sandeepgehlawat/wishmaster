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
} from "lucide-react";
import { Header } from "@/components/header";

const MOCK_JOBS = [
  {
    id: "1",
    title: "BUILD TELEGRAM TRADING BOT",
    description: "Create a high-frequency trading bot with Telegram integration for real-time alerts.",
    budget: "500-1500 USDC",
    skills: ["RUST", "API", "TRADING"],
    status: "BIDDING",
    timeLeft: "02:34:15",
    bids: 8,
    views: 234,
  },
  {
    id: "2",
    title: "AI RESEARCH PAPER ANALYSIS",
    description: "Analyze and summarize 50 ML research papers with key insights extraction.",
    budget: "200-400 USDC",
    skills: ["NLP", "RESEARCH", "PYTHON"],
    status: "OPEN",
    timeLeft: "18:12:44",
    bids: 4,
    views: 156,
  },
  {
    id: "3",
    title: "SMART CONTRACT AUDIT",
    description: "Comprehensive security audit of DeFi lending protocol on Solana.",
    budget: "1000-3000 USDC",
    skills: ["SOLIDITY", "SECURITY", "DEFI"],
    status: "BIDDING",
    timeLeft: "04:55:02",
    bids: 12,
    views: 489,
  },
  {
    id: "4",
    title: "TECHNICAL API DOCUMENTATION",
    description: "Write comprehensive API docs with examples for REST and GraphQL endpoints.",
    budget: "150-300 USDC",
    skills: ["DOCS", "REST", "OPENAPI"],
    status: "OPEN",
    timeLeft: "23:08:33",
    bids: 6,
    views: 98,
  },
  {
    id: "5",
    title: "DATA PIPELINE ETL SYSTEM",
    description: "Build scalable ETL pipeline processing 1M+ records daily.",
    budget: "400-800 USDC",
    skills: ["ETL", "SQL", "PYTHON"],
    status: "BIDDING",
    timeLeft: "11:22:07",
    bids: 3,
    views: 187,
  },
  {
    id: "6",
    title: "NFT MARKETPLACE FRONTEND",
    description: "React-based NFT marketplace with Solana wallet integration.",
    budget: "600-1200 USDC",
    skills: ["REACT", "WEB3", "SOLANA"],
    status: "OPEN",
    timeLeft: "06:45:19",
    bids: 9,
    views: 312,
  },
  {
    id: "7",
    title: "DISCORD MODERATION BOT",
    description: "AI-powered Discord bot for community moderation and engagement.",
    budget: "200-500 USDC",
    skills: ["DISCORD", "AI", "NODE"],
    status: "BIDDING",
    timeLeft: "15:30:00",
    bids: 5,
    views: 145,
  },
  {
    id: "8",
    title: "TOKENOMICS SIMULATOR",
    description: "Build a Monte Carlo simulation for token economics modeling.",
    budget: "800-1500 USDC",
    skills: ["PYTHON", "FINANCE", "SIMULATION"],
    status: "OPEN",
    timeLeft: "48:00:00",
    bids: 2,
    views: 267,
  },
];

const CATEGORIES = ["ALL", "DEVELOPMENT", "SECURITY", "DATA", "DOCS", "TRADING"];

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

export default function MarketplacePage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OPEN" | "BIDDING">("ALL");

  const filteredJobs = MOCK_JOBS.filter((job) => {
    const matchesSearch = !search || job.title.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || job.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalBids = MOCK_JOBS.reduce((sum, j) => sum + j.bids, 0);
  const liveJobs = MOCK_JOBS.length;

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
                {liveJobs} LIVE JOBS • {totalBids} TOTAL BIDS
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
              {(["ALL", "OPEN", "BIDDING"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-4 py-3 text-xs font-bold tracking-wider border-2 transition-colors ${
                    statusFilter === status
                      ? "border-white bg-white text-black"
                      : "border-white/50 text-white/50 hover:border-white hover:text-white"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Job Grid */}
      <main className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="grid md:grid-cols-2 gap-4">
          {filteredJobs.map((job) => (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              className="block border-2 border-white p-5 hover:bg-white hover:text-black transition-colors group"
            >
              <div className="flex items-center justify-between mb-3">
                <span
                  className={`text-xs px-2 py-0.5 border ${
                    job.status === "BIDDING"
                      ? "border-green-400 text-green-400 group-hover:border-green-700 group-hover:text-green-700"
                      : "border-white text-white group-hover:border-black group-hover:text-black"
                  }`}
                >
                  {job.status}
                </span>
                <div className="flex items-center gap-4 text-xs text-white/50 group-hover:text-black/50">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {job.bids} BIDS
                  </span>
                  <span>{job.views} VIEWS</span>
                </div>
              </div>

              <h2 className="text-lg font-bold tracking-wider mb-2">{job.title}</h2>
              <p className="text-sm text-white/60 group-hover:text-black/60 mb-4 line-clamp-2">
                {job.description}
              </p>

              <div className="flex flex-wrap gap-2 mb-4">
                {job.skills.map((skill) => (
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
                  {job.budget}
                </span>
                <div className="flex items-center gap-2 text-xs">
                  <Clock className="h-3 w-3" />
                  <LiveTimer initial={job.timeLeft} />
                </div>
              </div>
            </Link>
          ))}
        </div>

        {filteredJobs.length === 0 && (
          <div className="border-2 border-white p-12 text-center">
            <p className="text-white/60 mb-4">NO_JOBS_FOUND</p>
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
