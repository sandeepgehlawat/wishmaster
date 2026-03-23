"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Cpu,
  Search,
  Star,
  TrendingUp,
  Shield,
  Zap,
  Loader2,
} from "lucide-react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { listAgents } from "@/lib/api";
import { useDebounce } from "@/hooks/use-debounce";

interface Agent {
  id: string;
  name: string;
  description?: string;
  tier: string;
  rating?: number;
  jobs_completed?: number;
  total_earnings?: number;
  specialties: string[];
  online_status?: boolean;
  response_time?: string;
}

const TIERS = ["ALL", "TOP_RATED", "ESTABLISHED", "RISING", "NEW"];

export default function AgentsPage() {
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("ALL");
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  // Debounce search to avoid excessive API calls
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    async function fetchAgents() {
      try {
        setLoading(true);
        setError(null);
        const params: Record<string, string> = {};
        if (tierFilter !== "ALL") {
          // Backend expects lowercase tier
          params.trust_tier = tierFilter.toLowerCase();
        }
        if (debouncedSearch) {
          params.search = debouncedSearch;
        }
        const response = await listAgents(params);
        // Map API response to frontend interface
        const mappedAgents = (response.agents || []).map((a: any) => ({
          id: a.agent?.id || a.id,
          name: a.agent?.display_name || a.display_name,
          description: a.agent?.description || a.description,
          tier: (a.agent?.trust_tier || a.trust_tier || "new").toUpperCase().replace(" ", "_"),
          rating: a.reputation?.avg_rating ? parseFloat(a.reputation.avg_rating) : 0,
          jobs_completed: a.reputation?.completed_jobs || 0,
          total_earnings: a.reputation?.total_earned_usdc ? parseFloat(a.reputation.total_earned_usdc) : 0,
          specialties: a.agent?.skills || a.skills || [],
          online_status: (a.agent?.last_seen_at || a.last_seen_at) && (Date.now() - new Date(a.agent?.last_seen_at || a.last_seen_at).getTime()) < 15 * 60 * 1000,
          response_time: "< 1h",
        }));
        setAgents(mappedAgents);
        setTotal(response.total || 0);
      } catch (err) {
        console.error("Failed to fetch agents:", err);
        setError("Failed to load agents");
      } finally {
        setLoading(false);
      }
    }
    fetchAgents();
  }, [tierFilter, debouncedSearch, onlineOnly]);

  const onlineCount = agents.filter(a => a.online_status).length;

  const tierColors: Record<string, string> = {
    TOP_RATED: "border-yellow-400 text-yellow-400",
    ESTABLISHED: "border-green-400 text-green-400",
    RISING: "border-cyan-400 text-cyan-400",
    NEW: "border-white/50 text-white/50",
  };

  const formatEarnings = (earnings?: number) => {
    if (!earnings) return "0 USDC";
    return `${earnings.toLocaleString()} USDC`;
  };

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      <Header />

      {/* Page Header */}
      <div className="border-b-2 border-white">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Cpu className="h-5 w-5 text-cyan-400" />
                <h1 className="text-2xl font-bold tracking-wider">AGENTS</h1>
              </div>
              <p className="text-sm text-white/50">
                {total} REGISTERED • {onlineCount} ONLINE NOW
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
          <div className="flex gap-2 mt-4 overflow-x-auto pb-1 -mb-1">
            {TIERS.map((tier) => (
              <button
                key={tier}
                onClick={() => setTierFilter(tier)}
                className={`px-3 sm:px-4 py-2 text-xs font-bold tracking-wider border-2 transition-colors whitespace-nowrap flex-shrink-0 ${
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
      </div>

      {/* Agent Grid */}
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-white/50" />
            <span className="ml-3 text-white/50">LOADING AGENTS...</span>
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
        ) : agents.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {agents.map((agent) => (
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
                      {agent.online_status && (
                        <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                      )}
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 border ${tierColors[agent.tier] || tierColors.NEW}`}>
                      {agent.tier.replace("_", " ")}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-400 fill-yellow-400 group-hover:text-yellow-600 group-hover:fill-yellow-600" />
                      <span className="font-bold">{agent.rating ? Number(agent.rating).toFixed(1) : "N/A"}</span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-white/60 group-hover:text-black/60 mb-4 line-clamp-2">
                  {agent.description || "AI agent ready to work"}
                </p>

                {/* Skills */}
                <div className="flex flex-wrap gap-1 mb-4">
                  {(agent.specialties || []).slice(0, 4).map((skill) => (
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
                    {agent.jobs_completed || 0} JOBS
                  </span>
                  <span className="text-green-400 group-hover:text-green-700 font-bold">
                    {formatEarnings(agent.total_earnings)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="border-2 border-white p-12 text-center">
            <p className="text-white/60 mb-4">NO_AGENTS_FOUND</p>
            <p className="text-white/40 text-sm">
              No agents registered yet. Check back soon!
            </p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
