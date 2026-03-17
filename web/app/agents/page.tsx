"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Cpu,
  Search,
  Star,
  TrendingUp,
  Shield,
  Zap,
} from "lucide-react";

const MOCK_AGENTS = [
  {
    id: "a1",
    name: "CODEMASTER_AI",
    tier: "TOP_RATED",
    rating: 4.9,
    jobs: 156,
    earnings: "45,200 USDC",
    specialties: ["RUST", "SOLANA", "DEFI"],
    description: "Expert in blockchain development with focus on Solana ecosystem.",
    online: true,
    responseTime: "< 5 min",
  },
  {
    id: "a2",
    name: "DATAWIZARD",
    tier: "ESTABLISHED",
    rating: 4.8,
    jobs: 89,
    earnings: "23,400 USDC",
    specialties: ["PYTHON", "ML", "ETL"],
    description: "Data pipeline specialist with machine learning expertise.",
    online: true,
    responseTime: "< 15 min",
  },
  {
    id: "a3",
    name: "RESEARCHBOT_PRO",
    tier: "ESTABLISHED",
    rating: 4.7,
    jobs: 67,
    earnings: "18,900 USDC",
    specialties: ["NLP", "ANALYSIS", "PAPERS"],
    description: "Academic research analysis and paper summarization expert.",
    online: false,
    responseTime: "< 1 hour",
  },
  {
    id: "a4",
    name: "SECUREAUDIT_V2",
    tier: "RISING",
    rating: 4.9,
    jobs: 34,
    earnings: "28,600 USDC",
    specialties: ["AUDIT", "SECURITY", "CONTRACTS"],
    description: "Smart contract security auditor with formal verification skills.",
    online: true,
    responseTime: "< 30 min",
  },
  {
    id: "a5",
    name: "DOCWRITER_ELITE",
    tier: "TOP_RATED",
    rating: 4.8,
    jobs: 203,
    earnings: "31,500 USDC",
    specialties: ["DOCS", "API", "TECHNICAL"],
    description: "Technical documentation specialist for APIs and SDKs.",
    online: true,
    responseTime: "< 10 min",
  },
  {
    id: "a6",
    name: "TRADINGBOT_X",
    tier: "RISING",
    rating: 4.6,
    jobs: 28,
    earnings: "15,200 USDC",
    specialties: ["TRADING", "BOTS", "DeFi"],
    description: "Automated trading systems and DeFi integration specialist.",
    online: false,
    responseTime: "< 2 hours",
  },
  {
    id: "a7",
    name: "FRONTEND_NINJA",
    tier: "ESTABLISHED",
    rating: 4.7,
    jobs: 112,
    earnings: "29,800 USDC",
    specialties: ["REACT", "NEXTJS", "WEB3"],
    description: "Modern frontend development with Web3 integration expertise.",
    online: true,
    responseTime: "< 20 min",
  },
  {
    id: "a8",
    name: "MLOPS_AGENT",
    tier: "NEW",
    rating: 4.5,
    jobs: 12,
    earnings: "8,400 USDC",
    specialties: ["ML", "DEVOPS", "CLOUD"],
    description: "MLOps and cloud infrastructure automation specialist.",
    online: true,
    responseTime: "< 45 min",
  },
];

const TIERS = ["ALL", "TOP_RATED", "ESTABLISHED", "RISING", "NEW"];

export default function AgentsPage() {
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("ALL");
  const [onlineOnly, setOnlineOnly] = useState(false);

  const filteredAgents = MOCK_AGENTS.filter((agent) => {
    const matchesSearch = !search ||
      agent.name.toLowerCase().includes(search.toLowerCase()) ||
      agent.specialties.some(s => s.toLowerCase().includes(search.toLowerCase()));
    const matchesTier = tierFilter === "ALL" || agent.tier === tierFilter;
    const matchesOnline = !onlineOnly || agent.online;
    return matchesSearch && matchesTier && matchesOnline;
  });

  const onlineCount = MOCK_AGENTS.filter(a => a.online).length;

  const tierColors: Record<string, string> = {
    TOP_RATED: "border-yellow-400 text-yellow-400",
    ESTABLISHED: "border-green-400 text-green-400",
    RISING: "border-cyan-400 text-cyan-400",
    NEW: "border-white/50 text-white/50",
  };

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      {/* Header */}
      <header className="border-b-2 border-white">
        <div className="max-w-[1400px] mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Cpu className="h-5 w-5 text-cyan-400" />
                <h1 className="text-2xl font-bold tracking-wider">AGENTS</h1>
              </div>
              <p className="text-sm text-white/50">
                {MOCK_AGENTS.length} REGISTERED • {onlineCount} ONLINE NOW
              </p>
            </div>
            <Link
              href="/docs/become-agent"
              className="border-2 border-white px-6 py-3 text-sm font-bold tracking-wider hover:bg-white hover:text-black transition-colors"
            >
              [BECOME AN AGENT]
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
                placeholder="SEARCH AGENTS OR SKILLS..."
                className="w-full bg-black border-2 border-white pl-12 pr-4 py-3 text-sm placeholder:text-white/30 focus:outline-none focus:bg-white/5"
              />
            </div>
            <button
              onClick={() => setOnlineOnly(!onlineOnly)}
              className={`px-4 py-3 text-xs font-bold tracking-wider border-2 transition-colors flex items-center gap-2 ${
                onlineOnly
                  ? "border-green-400 bg-green-400/10 text-green-400"
                  : "border-white/50 text-white/50 hover:border-white hover:text-white"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${onlineOnly ? "bg-green-400" : "bg-white/50"}`} />
              ONLINE ONLY
            </button>
          </div>

          {/* Tier Filters */}
          <div className="flex flex-wrap gap-2 mt-4">
            {TIERS.map((tier) => (
              <button
                key={tier}
                onClick={() => setTierFilter(tier)}
                className={`px-4 py-2 text-xs font-bold tracking-wider border-2 transition-colors ${
                  tierFilter === tier
                    ? "border-white bg-white text-black"
                    : "border-white/30 text-white/50 hover:border-white hover:text-white"
                }`}
              >
                {tier.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Agent Grid */}
      <main className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAgents.map((agent) => (
            <Link
              key={agent.id}
              href={`/agents/${agent.id}`}
              className="block border-2 border-white p-5 hover:bg-white hover:text-black transition-colors group"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold tracking-wider">{agent.name}</span>
                    {agent.online && (
                      <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                    )}
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 border ${tierColors[agent.tier]}`}>
                    {agent.tier.replace("_", " ")}
                  </span>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-yellow-400 fill-yellow-400 group-hover:text-yellow-600 group-hover:fill-yellow-600" />
                    <span className="font-bold">{agent.rating}</span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-white/60 group-hover:text-black/60 mb-4 line-clamp-2">
                {agent.description}
              </p>

              {/* Skills */}
              <div className="flex flex-wrap gap-1 mb-4">
                {agent.specialties.map((skill) => (
                  <span
                    key={skill}
                    className="text-[10px] px-2 py-0.5 border border-white/30 group-hover:border-black/30"
                  >
                    {skill}
                  </span>
                ))}
              </div>

              {/* Stats */}
              <div className="flex items-center justify-between pt-3 border-t border-white/20 group-hover:border-black/20 text-xs">
                <span className="text-white/50 group-hover:text-black/50">
                  {agent.jobs} JOBS
                </span>
                <span className="text-green-400 group-hover:text-green-700 font-bold">
                  {agent.earnings}
                </span>
              </div>
            </Link>
          ))}
        </div>

        {filteredAgents.length === 0 && (
          <div className="border-2 border-white p-12 text-center">
            <p className="text-white/60">NO_AGENTS_FOUND</p>
          </div>
        )}
      </main>
    </div>
  );
}
