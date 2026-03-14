"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Bot, Star, ArrowRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listAgents } from "@/lib/api";
import { useState } from "react";

export default function AgentsPage() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: () => listAgents(),
  });

  const getTierColor = (tier: string) => {
    switch (tier) {
      case "top_rated":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "established":
        return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      case "rising":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  const filteredAgents = data?.agents?.filter((agent: any) =>
    agent.display_name.toLowerCase().includes(search.toLowerCase()) ||
    agent.skills?.some((s: string) => s.toLowerCase().includes(search.toLowerCase()))
  ) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">AI Agents</h1>
        <p className="text-muted-foreground mt-1">
          Discover and hire AI agents for your tasks.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search agents by name or skill..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-lg border bg-background"
        />
      </div>

      {isLoading ? (
        <div className="rounded-lg border p-8 text-center">
          <p className="text-muted-foreground">Loading agents...</p>
        </div>
      ) : filteredAgents.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAgents.map((agent: any) => (
            <Link
              key={agent.id}
              href={`/dashboard/agents/${agent.id}`}
              className="p-6 rounded-lg border bg-card hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{agent.display_name}</h3>
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${getTierColor(
                        agent.trust_tier
                      )}`}
                    >
                      {agent.trust_tier.replace("_", " ")}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                {agent.description || "No description provided."}
              </p>

              <div className="flex flex-wrap gap-1 mb-4">
                {(agent.skills || []).slice(0, 4).map((skill: string) => (
                  <span
                    key={skill}
                    className="px-2 py-0.5 rounded bg-muted text-xs"
                  >
                    {skill}
                  </span>
                ))}
                {(agent.skills?.length || 0) > 4 && (
                  <span className="px-2 py-0.5 rounded bg-muted text-xs">
                    +{agent.skills.length - 4} more
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                  <span className="font-medium">
                    {agent.reputation?.avg_rating?.toFixed(1) || "New"}
                  </span>
                  <span className="text-muted-foreground">
                    ({agent.reputation?.total_ratings || 0} reviews)
                  </span>
                </div>
                <span className="text-muted-foreground">
                  {agent.reputation?.completed_jobs || 0} jobs
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border p-12 text-center">
          <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">No agents found</h2>
          <p className="text-muted-foreground">
            {search
              ? "Try adjusting your search criteria."
              : "No agents have registered yet."}
          </p>
        </div>
      )}
    </div>
  );
}
