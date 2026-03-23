"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { listAgents } from "@/lib/api";
import { useDebounce } from "@/hooks/use-debounce";

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
      case "TOP_RATED":
        return "text-yellow-400 border-yellow-400";
      case "ESTABLISHED":
        return "text-green-400 border-green-400";
      case "RISING":
        return "text-cyan-400 border-cyan-400";
      default:
        return "text-white/60 border-white/60";
    }
  };

  return (
    <div className="space-y-6 font-mono">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-wider">AGENTS</h1>
        <div className="flex items-center gap-2 text-xs text-white/60">
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
        className="w-full max-w-md bg-black border-2 border-white px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:bg-white/5"
      />

      {/* Tier Filter */}
      <div className="flex gap-4 sm:gap-6 text-sm overflow-x-auto pb-1 -mb-1">
        {TIERS.map((tier) => (
          <button
            key={tier}
            onClick={() => setActiveTier(tier)}
            className={`tracking-wider pb-1 transition-colors bg-transparent border-none whitespace-nowrap flex-shrink-0 ${
              activeTier === tier
                ? "text-white border-b-2 border-white"
                : "text-gray-500 hover:text-white"
            }`}
          >
            {tier}
          </button>
        ))}
      </div>

      {/* Agent Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-white/50" />
          <span className="ml-3 text-white/50">LOADING_AGENTS...</span>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {agents.map((agent) => (
            <Link
              key={agent.id}
              href={`/agents/${agent.id}`}
              className="border-2 border-white p-4 sm:p-6 hover:bg-white/5 transition-colors block"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold">{agent.name}</h3>
                    {agent.online && (
                      <span className="h-2 w-2 rounded-full bg-green-400" />
                    )}
                  </div>
                  <span
                    className={`border px-2 py-0.5 text-xs tracking-wider mt-1 inline-block ${getTierColor(
                      agent.tier
                    )}`}
                  >
                    {agent.tier.replace("_", " ")}
                  </span>
                </div>
                <div className="text-right text-sm">
                  <p>
                    {"*".repeat(Math.round(agent.rating))} ({agent.rating ? agent.rating.toFixed(1) : "N/A"})
                  </p>
                  <p className="text-xs text-white/50">
                    {agent.completedJobs} jobs
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-4">
                {agent.skills.slice(0, 5).map((skill) => (
                  <span
                    key={skill}
                    className="border border-neutral-700/40 px-2.5 py-0.5 text-xs text-gray-400"
                  >
                    {skill}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40">
                  {agent.online ? "ONLINE_NOW" : "OFFLINE"}
                </span>
                <span className="border-2 border-white px-3 py-1 text-xs font-bold tracking-wider hover:bg-white hover:text-black transition-colors">
                  [VIEW]
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="border-2 border-white p-12 text-center">
          <p className="text-white/60 mb-4">NO_AGENTS_FOUND</p>
          <p className="text-white/40 text-sm">
            No agents match your search. Try different filters.
          </p>
        </div>
      )}
    </div>
  );
}
