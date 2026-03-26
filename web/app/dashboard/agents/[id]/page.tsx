"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft, Star, Briefcase, TrendingUp, DollarSign } from "lucide-react";
import { getAgent } from "@/lib/api";
import type { AgentWithReputation } from "@/lib/types";

const tierBadgeClass = (tier: string) => {
  switch (tier?.toLowerCase()) {
    case "top_rated": return "border-yellow-500/50 text-yellow-400 bg-yellow-500/10";
    case "established": return "border-green-500/50 text-green-400 bg-green-500/10";
    case "rising": return "border-blue-500/50 text-blue-400 bg-blue-500/10";
    default: return "border-neutral-500/50 text-neutral-400 bg-neutral-500/10";
  }
};

const formatTier = (tier: string) => {
  return tier?.toUpperCase().replace("_", " ") || "NEW";
};

export default function AgentDetailPage() {
  const params = useParams();
  const agentId = params.id as string;

  const [agent, setAgent] = useState<AgentWithReputation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAgent() {
      try {
        setLoading(true);
        setError(null);
        const data = await getAgent(agentId);
        setAgent(data);
      } catch (err: any) {
        setError(err.message || "Failed to load agent");
      } finally {
        setLoading(false);
      }
    }

    if (agentId) {
      fetchAgent();
    }
  }, [agentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-white/50" />
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="space-y-6 font-mono">
        <Link
          href="/dashboard/agents"
          className="inline-flex items-center gap-2 text-xs text-gray-500 hover:text-white tracking-wide transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Agents
        </Link>
        <div className="border-2 border-red-500/30 bg-red-500/5 p-8 text-center">
          <p className="text-red-400 font-bold tracking-wider mb-2">AGENT_NOT_FOUND</p>
          <p className="text-sm text-white/60">{error || "This agent does not exist or has been removed."}</p>
        </div>
      </div>
    );
  }

  const reputation = agent.reputation;
  const avgRating = reputation ? parseFloat(reputation.avg_rating) : 0;
  const completedJobs = reputation?.completed_jobs || 0;
  const jss = reputation ? parseFloat(reputation.job_success_score) : 0;
  const earnings = reputation?.total_earnings_usdc || "0";

  return (
    <div className="space-y-8 font-mono">
      {/* Back */}
      <Link
        href="/dashboard/agents"
        className="inline-flex items-center gap-2 text-xs text-gray-500 hover:text-white tracking-wide transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Agents
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <h1 className="text-2xl font-bold tracking-wide">{agent.display_name}</h1>
        <span className={`border px-3 py-1 text-xs tracking-wider font-bold w-fit ${tierBadgeClass(agent.trust_tier)}`}>
          {formatTier(agent.trust_tier)}
        </span>
        {agent.is_active && (
          <span className="flex items-center gap-1.5 text-xs text-green-400">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            ONLINE
          </span>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border-2 border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Star className="h-4 w-4 text-yellow-400" />
            <p className="text-xs text-gray-500 tracking-wide">RATING</p>
          </div>
          <p className="text-xl font-bold">{avgRating.toFixed(1)} / 5.0</p>
          <p className="text-xs text-gray-500 mt-1">{reputation?.total_ratings || 0} reviews</p>
        </div>

        <div className="border-2 border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Briefcase className="h-4 w-4 text-blue-400" />
            <p className="text-xs text-gray-500 tracking-wide">COMPLETED</p>
          </div>
          <p className="text-xl font-bold">{completedJobs}</p>
          <p className="text-xs text-gray-500 mt-1">jobs done</p>
        </div>

        <div className="border-2 border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-green-400" />
            <p className="text-xs text-gray-500 tracking-wide">JSS</p>
          </div>
          <p className="text-xl font-bold">{(jss * 100).toFixed(0)}%</p>
          <p className="text-xs text-gray-500 mt-1">success score</p>
        </div>

        <div className="border-2 border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-emerald-400" />
            <p className="text-xs text-gray-500 tracking-wide">EARNINGS</p>
          </div>
          <p className="text-xl font-bold">${parseFloat(earnings).toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">USDC total</p>
        </div>
      </div>

      {/* About */}
      <div className="border-2 border-white/10 p-6">
        <h2 className="text-xs text-gray-500 tracking-wider mb-3 font-bold">ABOUT</h2>
        <p className="text-sm leading-relaxed text-white/80">
          {agent.description || "No description provided."}
        </p>
      </div>

      {/* Skills */}
      <div>
        <h2 className="text-xs text-gray-500 tracking-wider mb-3 font-bold">SKILLS</h2>
        <div className="flex flex-wrap gap-2">
          {agent.skills && agent.skills.length > 0 ? (
            agent.skills.map((skill: string) => (
              <span
                key={skill}
                className="border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs tracking-wide text-cyan-400"
              >
                {skill}
              </span>
            ))
          ) : (
            <span className="text-gray-500 text-sm">No skills listed</span>
          )}
        </div>
      </div>

      {/* Performance Metrics */}
      {reputation && (
        <div>
          <h2 className="text-xs text-gray-500 tracking-wider mb-3 font-bold">PERFORMANCE_METRICS</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="border border-white/10 p-4">
              <p className="text-xs text-gray-500 mb-1">Quality</p>
              <p className="text-lg font-bold">{(parseFloat(reputation.quality_score) * 100).toFixed(0)}%</p>
            </div>
            <div className="border border-white/10 p-4">
              <p className="text-xs text-gray-500 mb-1">Speed</p>
              <p className="text-lg font-bold">{(parseFloat(reputation.speed_score) * 100).toFixed(0)}%</p>
            </div>
            <div className="border border-white/10 p-4">
              <p className="text-xs text-gray-500 mb-1">Communication</p>
              <p className="text-lg font-bold">{(parseFloat(reputation.communication_score) * 100).toFixed(0)}%</p>
            </div>
            <div className="border border-white/10 p-4">
              <p className="text-xs text-gray-500 mb-1">Completion Rate</p>
              <p className="text-lg font-bold">{(parseFloat(reputation.completion_rate) * 100).toFixed(0)}%</p>
            </div>
          </div>
        </div>
      )}

      {/* Wallet Address */}
      <div className="border border-white/10 p-4">
        <p className="text-xs text-gray-500 tracking-wider mb-2">WALLET_ADDRESS</p>
        <code className="text-sm text-white/70 font-mono break-all">{agent.wallet_address}</code>
      </div>

      {/* Member Since */}
      <div className="text-xs text-gray-500">
        Member since {new Date(agent.created_at).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric"
        })}
      </div>
    </div>
  );
}
