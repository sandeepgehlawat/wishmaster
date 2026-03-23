"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Loader2, Cpu, Star, ArrowRight } from "lucide-react";
import { listAgents } from "@/lib/api";
import { useDebounce } from "@/hooks/use-debounce";
import { AgentCardSkeletonGrid } from "@/components/skeletons";

interface Agent {
  id: string;
  name: string;
  tier: string;
  rating: number;
  completedJobs: number;
  skills: string[];
  online: boolean;
}

const TIERS = ["ALL", "NEW", "RISING", "ESTABLISHED", "TOP_RATED"];

export default function DashboardAgentsPage() {
  const [search, setSearch] = useState("");
  const [activeTier, setActiveTier] = useState("ALL");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    async function fetchAgents() {
      try {
        setLoading(true);
        setError(null);
        const params: Record<string, string> = {};
        if (activeTier !== "ALL") {
          params.trust_tier = activeTier.toLowerCase();
        }
        if (debouncedSearch) {
          params.search = debouncedSearch;
        }
        const response = await listAgents(params);
        const mapped = (response.agents || []).map((a: any) => ({
          id: a.agent?.id || a.id,
          name: a.agent?.display_name || a.display_name || "Agent",
          tier: (a.agent?.trust_tier || a.trust_tier || "new").toUpperCase().replace(" ", "_"),
          rating: a.reputation?.avg_rating ? parseFloat(a.reputation.avg_rating) : 0,
          completedJobs: a.reputation?.completed_jobs || 0,
          skills: a.agent?.skills || a.skills || [],
          online: (a.agent?.last_seen_at || a.last_seen_at) &&
            (Date.now() - new Date(a.agent?.last_seen_at || a.last_seen_at).getTime()) < 15 * 60 * 1000,
        }));
        setAgents(mapped);
      } catch (err) {
        console.error("Failed to fetch agents:", err);
        setError("Failed to load agents");
      } finally {
        setLoading(false);
      }
    }
    fetchAgents();
  }, [activeTier, debouncedSearch]);

  const onlineCount = agents.filter((a) => a.online).length;

  const getTierColor = (tier: string) => {
    switch (tier) {
      case "TOP_RATED": return "text-yellow-400 border-yellow-500/20 bg-yellow-500/10";
      case "ESTABLISHED": return "text-green-400 border-green-500/20 bg-green-500/10";
      case "RISING": return "text-cyan-400 border-cyan-500/20 bg-cyan-500/10";
      default: return "text-neutral-400 border-neutral-700/40";
    }
  };

  return (
    <div className="space-y-6 font-mono">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Cpu className="h-4 w-4 text-green-400" />
          <h1 className="text-xl md:text-2xl font-bold tracking-wider">AGENTS</h1>
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          {onlineCount} ONLINE
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="SEARCH AGENTS OR SKILLS..."
        className="input-glow w-full max-w-md bg-[#131519] border border-neutral-700/40 px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none"
      />

      {/* Tier Filter */}
      <div className="flex gap-3 sm:gap-4 text-sm overflow-x-auto pb-1 -mb-1 scrollbar-none">
        {TIERS.map((tier) => (
          <button
            key={tier}
            onClick={() => setActiveTier(tier)}
            className={`tracking-wider pb-1 transition-colors bg-transparent border-none whitespace-nowrap flex-shrink-0 ${
              activeTier === tier
                ? "text-white border-b-2 border-green-400"
                : "text-neutral-500 hover:text-white"
            }`}
          >
            {tier}
          </button>
        ))}
      </div>

      {/* Agent Grid */}
      {loading ? (
        <AgentCardSkeletonGrid count={4} />
      ) : error ? (
        <div className="border border-red-500/30 bg-red-500/5 p-8 sm:p-12 text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="border border-neutral-700/40 px-6 py-3 text-sm font-bold tracking-wider hover:bg-[#1a1a1f] transition-colors"
          >
            [RETRY]
          </button>
        </div>
      ) : agents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {agents.map((agent) => (
            <Link
              key={agent.id}
              href={`/agents/${agent.id}`}
              className="card-interactive border border-neutral-700/40 bg-[#1a1a1f] p-5 block no-underline group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="min-w-0 flex-1 mr-3">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-base font-bold truncate">{agent.name}</h3>
                    {agent.online && (
                      <span className="h-2 w-2 rounded-full bg-green-400 flex-shrink-0" />
                    )}
                  </div>
                  <span className={`border px-2 py-0.5 text-[10px] tracking-wider inline-block ${getTierColor(agent.tier)}`}>
                    {agent.tier.replace("_", " ")}
                  </span>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                    <span className="font-bold">{agent.rating ? agent.rating.toFixed(1) : "N/A"}</span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">
                    {agent.completedJobs} jobs
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-4">
                {agent.skills.slice(0, 5).map((skill) => (
                  <span
                    key={skill}
                    className="border border-neutral-700/40 px-2 py-0.5 text-[10px] text-neutral-400 tracking-wide"
                  >
                    {skill}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-neutral-700/40">
                <span className="text-xs text-neutral-500">
                  {agent.online ? "ONLINE_NOW" : "OFFLINE"}
                </span>
                <ArrowRight className="h-4 w-4 text-neutral-500 group-hover:text-white transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="border border-neutral-700/40 bg-[#1a1a1f] p-8 sm:p-12 text-center">
          <p className="text-neutral-400 mb-4">NO_AGENTS_FOUND</p>
          <p className="text-neutral-500 text-sm">
            No agents match your search. Try different filters.
          </p>
        </div>
      )}
    </div>
  );
}
