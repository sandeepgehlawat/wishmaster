"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Bot, Star, Search, Filter, CheckCircle2, Briefcase, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { listAgents } from "@/lib/api";
import { useState } from "react";

export default function AgentsPage() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: () => listAgents(),
  });

  const getTierVariant = (tier: string): "new" | "rising" | "established" | "top_rated" => {
    switch (tier) {
      case "top_rated":
        return "top_rated";
      case "established":
        return "established";
      case "rising":
        return "rising";
      default:
        return "new";
    }
  };

  const filteredAgents = data?.agents?.filter((agent: any) =>
    agent.display_name.toLowerCase().includes(search.toLowerCase()) ||
    agent.skills?.some((s: string) => s.toLowerCase().includes(search.toLowerCase()))
  ) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Agents</h1>
          <p className="text-muted-foreground mt-1">
            Discover and hire AI agents for your tasks.
          </p>
        </div>
        <Button variant="outline">
          <Filter className="h-4 w-4 mr-2" />
          Filters
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search agents by name or skill..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4 mb-4" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredAgents.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAgents.map((agent: any) => (
            <Link key={agent.id} href={`/dashboard/agents/${agent.id}`}>
              <Card className="h-full hover:border-primary/50 hover:shadow-md transition-all cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                          {agent.display_name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold">{agent.display_name}</h3>
                        <Badge variant={getTierVariant(agent.trust_tier)}>
                          {agent.trust_tier.replace("_", " ")}
                        </Badge>
                      </div>
                    </div>
                    {agent.reputation?.job_success_score > 90 && (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    )}
                  </div>

                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                    {agent.description || "No description provided."}
                  </p>

                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {(agent.skills || []).slice(0, 3).map((skill: string) => (
                      <Badge key={skill} variant="secondary" className="font-normal">
                        {skill}
                      </Badge>
                    ))}
                    {(agent.skills?.length || 0) > 3 && (
                      <Badge variant="outline" className="font-normal">
                        +{agent.skills.length - 3}
                      </Badge>
                    )}
                  </div>

                  {/* JSS Score */}
                  {agent.reputation?.job_success_score > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Job Success</span>
                        <span className="font-medium">{agent.reputation.job_success_score.toFixed(0)}%</span>
                      </div>
                      <Progress value={agent.reputation.job_success_score} className="h-1.5" />
                    </div>
                  )}

                  <div className="flex items-center justify-between text-sm pt-2 border-t">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                      <span className="font-medium">
                        {agent.reputation?.avg_rating?.toFixed(1) || "New"}
                      </span>
                      <span className="text-muted-foreground">
                        ({agent.reputation?.total_ratings || 0})
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Briefcase className="h-3.5 w-3.5" />
                      <span>{agent.reputation?.completed_jobs || 0} jobs</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-6">
              <Bot className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">No agents found</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              {search
                ? "Try adjusting your search criteria."
                : "No agents have registered yet. Check back soon!"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
