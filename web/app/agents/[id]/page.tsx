"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { getAgent } from "@/lib/api";
import {
  Star,
  Briefcase,
  Clock,
  TrendingUp,
  Shield,
  Zap,
  MessageSquare,
  Award,
  Loader2,
  AlertTriangle,
} from "lucide-react";

// Badge component
function Badge({ type }: { type: string }) {
  const badges: Record<string, { icon: any; color: string }> = {
    TOP_PERFORMER: { icon: Award, color: "text-yellow-400 border-yellow-400" },
    SECURITY_EXPERT: { icon: Shield, color: "text-red-400 border-red-400" },
    TRADING_EXPERT: { icon: TrendingUp, color: "text-green-400 border-green-400" },
    FAST_RESPONDER: { icon: Zap, color: "text-cyan-400 border-cyan-400" },
    "100_JOBS": { icon: Briefcase, color: "text-purple-400 border-purple-400" },
  };

  const badge = badges[type] || { icon: Star, color: "text-white border-white" };
  const Icon = badge.icon;

  return (
    <div className={`flex items-center gap-2 border px-3 py-1.5 ${badge.color}`}>
      <Icon className="h-3 w-3" />
      <span className="text-xs tracking-wider">{type.replace(/_/g, " ")}</span>
    </div>
  );
}

// Loading skeleton component
function LoadingSkeleton() {
  return (
    <div className="min-h-screen flex flex-col bg-[#131519] text-white font-mono">
      <Header />
      <main className="flex-1 max-w-[1400px] mx-auto px-4 sm:px-6 py-8 w-full">
        <div className="flex items-center gap-2 text-xs text-white/50 mb-6">
          <Link href="/" className="hover:text-white">HOME</Link>
          <span>/</span>
          <Link href="/agents" className="hover:text-white">AGENTS</Link>
          <span>/</span>
          <span className="text-white/30">LOADING...</span>
        </div>

        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-12 w-12 animate-spin text-white/50 mb-4" />
          <p className="text-white/50 tracking-wider">LOADING_AGENT_DATA...</p>
        </div>
      </main>
    </div>
  );
}

// Error component
function ErrorDisplay({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#131519] text-white font-mono">
      <Header />
      <main className="flex-1 max-w-[1400px] mx-auto px-4 sm:px-6 py-8 w-full">
        <div className="flex items-center gap-2 text-xs text-white/50 mb-6">
          <Link href="/" className="hover:text-white">HOME</Link>
          <span>/</span>
          <Link href="/agents" className="hover:text-white">AGENTS</Link>
          <span>/</span>
          <span className="text-red-400">ERROR</span>
        </div>

        <div className="border-2 border-red-400 p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold tracking-wider text-red-400 mb-2">ERROR_LOADING_AGENT</h2>
          <p className="text-white/60 mb-6">{message}</p>
          <Link
            href="/agents"
            className="inline-block border-2 border-white px-6 py-3 text-sm font-bold tracking-wider hover:bg-white hover:text-black transition-colors"
          >
            [BACK TO AGENTS]
          </Link>
        </div>
      </main>
    </div>
  );
}

// Not found component
function AgentNotFound({ agentId }: { agentId: string }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#131519] text-white font-mono">
      <Header />
      <main className="flex-1 max-w-[1400px] mx-auto px-4 sm:px-6 py-8 w-full">
        <div className="flex items-center gap-2 text-xs text-white/50 mb-6">
          <Link href="/" className="hover:text-white">HOME</Link>
          <span>/</span>
          <Link href="/agents" className="hover:text-white">AGENTS</Link>
          <span>/</span>
          <span className="text-white/30">{agentId}</span>
        </div>

        <div className="border-2 border-white/50 p-8 text-center">
          <div className="text-6xl mb-4">404</div>
          <h2 className="text-xl font-bold tracking-wider mb-2">AGENT_NOT_FOUND</h2>
          <p className="text-white/60 mb-6">
            The agent with ID &quot;{agentId}&quot; does not exist or has been removed.
          </p>
          <Link
            href="/agents"
            className="inline-block border-2 border-white px-6 py-3 text-sm font-bold tracking-wider hover:bg-white hover:text-black transition-colors"
          >
            [BROWSE AGENTS]
          </Link>
        </div>
      </main>
    </div>
  );
}

export default function PublicAgentPage() {
  const params = useParams();
  const agentId = params.id as string;

  const [agent, setAgent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function fetchAgent() {
      if (!agentId) return;

      setLoading(true);
      setError(null);
      setNotFound(false);

      try {
        const data = await getAgent(agentId);
        if (!data) {
          setNotFound(true);
        } else {
          setAgent(data);
        }
      } catch (err: any) {
        if (err.message?.includes("not found") || err.message?.includes("404")) {
          setNotFound(true);
        } else {
          setError(err.message || "Failed to load agent data");
        }
      } finally {
        setLoading(false);
      }
    }

    fetchAgent();
  }, [agentId]);

  const getTierColor = (tier: string) => {
    switch (tier) {
      case "TOP_RATED": return "text-yellow-400 border-yellow-400 bg-yellow-400/10";
      case "ESTABLISHED": return "text-green-400 border-green-400 bg-green-400/10";
      case "RISING": return "text-cyan-400 border-cyan-400 bg-cyan-400/10";
      default: return "text-white/60 border-white/60";
    }
  };

  // Loading state
  if (loading) {
    return <LoadingSkeleton />;
  }

  // Error state
  if (error) {
    return <ErrorDisplay message={error} />;
  }

  // Not found state
  if (notFound || !agent) {
    return <AgentNotFound agentId={agentId} />;
  }

  // Map API response fields to frontend fields
  const reputation = agent.reputation || {};
  const agentData = {
    id: agent.id || agentId,
    name: agent.display_name || agent.name || agentId,
    tier: (agent.trust_tier || agent.tier || "new").toUpperCase().replace(" ", "_"),
    tagline: agent.tagline || agent.description || "",
    rating: parseFloat(reputation.avg_rating) || agent.rating || 0,
    completedJobs: reputation.completed_jobs || agent.completedJobs || agent.completed_jobs || 0,
    jss: parseFloat(reputation.job_success_score) || agent.jss || agent.job_success_score || 0,
    earnings: reputation.total_earnings_usdc ? `${parseFloat(reputation.total_earnings_usdc).toLocaleString()} USDC` : (agent.earnings || "0 USDC"),
    responseTime: agent.responseTime || agent.response_time || "< 1h",
    online: agent.last_seen_at ? (Date.now() - new Date(agent.last_seen_at).getTime()) < 15 * 60 * 1000 : (agent.online ?? false),
    lastActive: agent.last_seen_at ? new Date(agent.last_seen_at).toLocaleDateString() : (agent.lastActive || agent.last_active || "---"),
    about: agent.description || agent.about || "No description available.",
    skills: agent.skills || [],
    stats: agent.stats || {
      avgDelivery: "24h",
      revisionRate: `${(parseFloat(reputation.completion_rate) * 100 || 0).toFixed(0)}%`,
      repeatClients: "---"
    },
    recentJobs: agent.recentJobs || agent.recent_jobs || [],
    reviews: agent.reviews || [],
    badges: agent.badges || [],
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#131519] text-white font-mono">
      <Header />

      {/* Main Content */}
      <main className="flex-1 max-w-[1400px] mx-auto px-4 sm:px-6 py-8 w-full">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-white/50 mb-6">
          <Link href="/" className="hover:text-white">HOME</Link>
          <span>/</span>
          <Link href="/agents" className="hover:text-white">AGENTS</Link>
          <span>/</span>
          <span className="text-white">{agentData.name}</span>
        </div>

        {/* Agent Header */}
        <div className="border-2 border-white p-4 sm:p-6 mb-6">
          <div className="flex flex-col md:flex-row items-start justify-between gap-4 md:gap-6">
            <div className="flex-1">
              {/* Name and status */}
              <div className="flex flex-wrap items-center gap-3 md:gap-4 mb-3">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-wider">{agentData.name}</h1>
                {agentData.online ? (
                  <span className="flex items-center gap-2 text-green-400 text-sm">
                    <span className="h-3 w-3 rounded-full bg-green-400 animate-pulse" />
                    ONLINE NOW
                  </span>
                ) : (
                  <span className="text-white/50 text-sm">
                    Last active: {agentData.lastActive}
                  </span>
                )}
              </div>

              {/* Tier badge */}
              <div className={`inline-block border-2 px-4 py-1.5 text-sm tracking-wider font-bold mb-4 ${getTierColor(agentData.tier)}`}>
                {agentData.tier}
              </div>

              {/* Tagline */}
              <p className="text-white/70 mb-4">{agentData.tagline}</p>

              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                {agentData.badges.map((badge: string) => (
                  <Badge key={badge} type={badge} />
                ))}
              </div>
            </div>

            {/* Quick stats */}
            <div className="text-left md:text-right">
              <div className="flex items-center gap-1 md:justify-end mb-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-5 w-5 ${star <= Math.round(agentData.rating) ? "text-yellow-400 fill-yellow-400" : "text-white/20"}`}
                  />
                ))}
                <span className="ml-2 text-xl font-bold">{agentData.rating}</span>
              </div>
              <p className="text-sm text-white/60">{agentData.completedJobs} jobs completed</p>
              <p className="text-sm text-white/60">{agentData.jss}% Job Success Score</p>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 border-2 border-white mb-6">
          <div className="p-4 text-center border-r border-b md:border-b-0 border-white">
            <p className="text-xl sm:text-2xl font-bold truncate">{agentData.earnings}</p>
            <p className="text-xs text-white/50 tracking-wider mt-1">TOTAL_EARNED</p>
          </div>
          <div className="p-4 text-center border-b md:border-b-0 md:border-r border-white">
            <p className="text-2xl font-bold">{agentData.stats.avgDelivery}</p>
            <p className="text-xs text-white/50 tracking-wider mt-1">AVG_DELIVERY</p>
          </div>
          <div className="p-4 text-center border-r border-white">
            <p className="text-2xl font-bold">{agentData.stats.revisionRate}</p>
            <p className="text-xs text-white/50 tracking-wider mt-1">REVISION_RATE</p>
          </div>
          <div className="p-4 text-center">
            <p className="text-2xl font-bold">{agentData.stats.repeatClients}</p>
            <p className="text-xs text-white/50 tracking-wider mt-1">REPEAT_CLIENTS</p>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* About */}
            <div className="border-2 border-white p-6">
              <h2 className="text-lg font-bold tracking-wider mb-4">{`>>> ABOUT`}</h2>
              <p className="text-sm leading-relaxed text-white/80">{agentData.about}</p>
            </div>

            {/* Skills */}
            <div className="border-2 border-white p-6">
              <h2 className="text-lg font-bold tracking-wider mb-4">{`>>> SKILLS`}</h2>
              <div className="flex flex-wrap gap-2">
                {agentData.skills.length > 0 ? (
                  agentData.skills.map((skill: string) => (
                    <span
                      key={skill}
                      className="border-2 border-white px-4 py-2 text-sm tracking-wider hover:bg-white hover:text-black transition-colors cursor-default"
                    >
                      {skill}
                    </span>
                  ))
                ) : (
                  <span className="text-white/50">NO_SKILLS_LISTED</span>
                )}
              </div>
            </div>

            {/* Recent Jobs */}
            <div className="border-2 border-white">
              <div className="border-b-2 border-white p-4">
                <h2 className="text-lg font-bold tracking-wider">{`>>> RECENT_JOBS (${agentData.recentJobs.length})`}</h2>
              </div>
              {agentData.recentJobs.length > 0 ? (
                <div>
                  {agentData.recentJobs.map((job: any, i: number) => (
                    <div
                      key={job.id || i}
                      className={`p-4 flex items-center justify-between ${
                        i !== agentData.recentJobs.length - 1 ? "border-b border-white/20" : ""
                      } hover:bg-white/5 transition-colors`}
                    >
                      <div>
                        <p className="font-bold">{job.title}</p>
                        <p className="text-xs text-white/50 mt-1">{job.date}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{job.budget}</p>
                        <div className="flex items-center gap-1 justify-end mt-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`h-3 w-3 ${star <= job.rating ? "text-yellow-400 fill-yellow-400" : "text-white/20"}`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-white/50">
                  NO_JOBS_YET
                </div>
              )}
            </div>

            {/* Reviews */}
            <div className="border-2 border-white">
              <div className="border-b-2 border-white p-4">
                <h2 className="text-lg font-bold tracking-wider">{`>>> REVIEWS (${agentData.reviews.length})`}</h2>
              </div>
              {agentData.reviews.length > 0 ? (
                <div>
                  {agentData.reviews.map((review: any, i: number) => (
                    <div
                      key={i}
                      className={`p-4 ${
                        i !== agentData.reviews.length - 1 ? "border-b border-white/20" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-white/50">{review.client}</span>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`h-3 w-3 ${star <= review.rating ? "text-yellow-400 fill-yellow-400" : "text-white/20"}`}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-sm text-white/80">{review.comment}</p>
                      <p className="text-xs text-white/30 mt-2">{review.date}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-white/50">
                  NO_REVIEWS_YET
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Hire CTA */}
            <div className="border-2 border-white p-6">
              <h3 className="text-lg font-bold tracking-wider mb-4">HIRE THIS AGENT</h3>
              <p className="text-sm text-white/60 mb-4">
                Post a job and invite {agentData.name} to bid on your project.
              </p>
              <Link
                href="/dashboard/jobs/new"
                className="block w-full text-center border-2 border-white px-6 py-3 text-sm font-bold tracking-wider bg-white text-black hover:bg-black hover:text-white transition-colors"
              >
                [POST A JOB]
              </Link>
            </div>

            {/* Response Time */}
            <div className="border-2 border-white p-4">
              <h3 className="text-xs text-white/50 tracking-wider mb-2">RESPONSE_TIME</h3>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-green-400" />
                <span className="text-xl font-bold">{agentData.responseTime}</span>
              </div>
            </div>

            {/* Trust Score */}
            <div className="border-2 border-white p-4">
              <h3 className="text-xs text-white/50 tracking-wider mb-3">TRUST_SCORE</h3>
              <div className="h-4 bg-white/10 border border-white">
                <div
                  className="h-full bg-green-400"
                  style={{ width: `${agentData.jss}%` }}
                />
              </div>
              <p className="text-right text-sm font-bold mt-2">{agentData.jss}%</p>
            </div>

            {/* Contact */}
            <div className="border-2 border-white p-4">
              <h3 className="text-xs text-white/50 tracking-wider mb-3">CONTACT</h3>
              <button className="w-full flex items-center justify-center gap-2 border-2 border-white px-4 py-2 text-sm tracking-wider hover:bg-white hover:text-black transition-colors">
                <MessageSquare className="h-4 w-4" />
                SEND MESSAGE
              </button>
            </div>

            {/* Browse More Agents */}
            <div className="border-2 border-white p-4">
              <h3 className="text-xs text-white/50 tracking-wider mb-3">EXPLORE</h3>
              <Link
                href="/agents"
                className="block w-full text-center border border-white px-4 py-2.5 text-sm tracking-wider hover:bg-white hover:text-black transition-colors"
              >
                BROWSE ALL AGENTS
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
