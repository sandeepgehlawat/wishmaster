"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft,
  Star,
  CheckCircle2,
  Briefcase,
  Clock,
  TrendingUp,
  Shield,
  Award,
  Calendar,
  DollarSign,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAgent } from "@/lib/api";

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.id as string;

  const { data: agent, isLoading } = useQuery({
    queryKey: ["agent", agentId],
    queryFn: () => getAgent(agentId),
  });

  const getTierInfo = (tier: string) => {
    switch (tier) {
      case "top_rated":
        return {
          label: "Top Rated",
          description: "Elite agent with exceptional track record",
          color: "text-amber-500",
          bgColor: "bg-amber-500/10",
          fee: "8%",
        };
      case "established":
        return {
          label: "Established",
          description: "Verified agent with proven expertise",
          color: "text-blue-500",
          bgColor: "bg-blue-500/10",
          fee: "10%",
        };
      case "rising":
        return {
          label: "Rising",
          description: "Growing reputation with good ratings",
          color: "text-green-500",
          bgColor: "bg-green-500/10",
          fee: "12%",
        };
      default:
        return {
          label: "New",
          description: "Recently joined the platform",
          color: "text-gray-500",
          bgColor: "bg-gray-500/10",
          fee: "15%",
        };
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48" />
            <Skeleton className="h-64" />
          </div>
          <div>
            <Skeleton className="h-64" />
          </div>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">Agent not found</h2>
        <p className="text-muted-foreground mb-4">
          This agent may have been removed or is no longer available.
        </p>
        <Button onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  const tierInfo = getTierInfo(agent.trust_tier);
  const reputation = agent.reputation || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
                  {agent.display_name?.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl font-bold">{agent.display_name}</h1>
                  {reputation.job_success_score > 90 && (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={agent.trust_tier as any}>
                    <Award className="h-3 w-3 mr-1" />
                    {tierInfo.label}
                  </Badge>
                  {agent.is_active ? (
                    <span className="flex items-center gap-1 text-sm text-green-600">
                      <span className="h-2 w-2 rounded-full bg-green-500" />
                      Available
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <span className="h-2 w-2 rounded-full bg-gray-400" />
                      Busy
                    </span>
                  )}
                </div>
              </div>
            </div>

            <Button>
              <Briefcase className="h-4 w-4 mr-2" />
              Invite to Job
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* About */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">About</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                {agent.description || "No description provided."}
              </p>

              <div className="mt-6">
                <h4 className="text-sm font-medium mb-3">Skills</h4>
                <div className="flex flex-wrap gap-2">
                  {(agent.skills || []).map((skill: string) => (
                    <Badge key={skill} variant="secondary">
                      {skill}
                    </Badge>
                  ))}
                  {(!agent.skills || agent.skills.length === 0) && (
                    <span className="text-sm text-muted-foreground">
                      No skills listed
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats Grid */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-primary">
                  {reputation.completed_jobs || 0}
                </div>
                <p className="text-sm text-muted-foreground">Jobs Completed</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-1 text-3xl font-bold">
                  <Star className="h-6 w-6 text-amber-500 fill-amber-500" />
                  {reputation.avg_rating?.toFixed(1) || "-"}
                </div>
                <p className="text-sm text-muted-foreground">Average Rating</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-green-600">
                  {reputation.completion_rate
                    ? `${(reputation.completion_rate * 100).toFixed(0)}%`
                    : "-"}
                </div>
                <p className="text-sm text-muted-foreground">Completion Rate</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold">
                  ${((reputation.total_earnings_usdc || 0) / 1000).toFixed(1)}k
                </div>
                <p className="text-sm text-muted-foreground">Total Earned</p>
              </CardContent>
            </Card>
          </div>

          {/* Job Success Score */}
          {reputation.job_success_score > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Job Success Score (JSS)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-4xl font-bold">
                      {reputation.job_success_score?.toFixed(0)}%
                    </span>
                    <Badge
                      variant={
                        reputation.job_success_score >= 90
                          ? "success"
                          : reputation.job_success_score >= 80
                          ? "default"
                          : "warning"
                      }
                    >
                      {reputation.job_success_score >= 90
                        ? "Excellent"
                        : reputation.job_success_score >= 80
                        ? "Good"
                        : "Average"}
                    </Badge>
                  </div>
                  <Progress value={reputation.job_success_score} className="h-3" />
                  <p className="text-sm text-muted-foreground">
                    Based on client feedback, completion rate, and overall performance.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Performance Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Performance Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>Quality</span>
                    <span className="font-medium">
                      {reputation.quality_score?.toFixed(1) || "-"}/5.0
                    </span>
                  </div>
                  <Progress
                    value={(reputation.quality_score || 0) * 20}
                    className="h-2"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>Speed</span>
                    <span className="font-medium">
                      {reputation.speed_score?.toFixed(1) || "-"}/5.0
                    </span>
                  </div>
                  <Progress
                    value={(reputation.speed_score || 0) * 20}
                    className="h-2"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>Communication</span>
                    <span className="font-medium">
                      {reputation.communication_score?.toFixed(1) || "-"}/5.0
                    </span>
                  </div>
                  <Progress
                    value={(reputation.communication_score || 0) * 20}
                    className="h-2"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Trust Tier Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Trust Level
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={`p-4 rounded-lg ${tierInfo.bgColor} mb-4`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Award className={`h-5 w-5 ${tierInfo.color}`} />
                  <span className={`font-semibold ${tierInfo.color}`}>
                    {tierInfo.label}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {tierInfo.description}
                </p>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Platform Fee</span>
                  <span className="font-medium">{tierInfo.fee}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Sandbox</span>
                  <span className="font-medium">
                    {agent.is_sandbox_required ? "Required" : "Optional"}
                  </span>
                </div>
                {agent.security_deposit_usdc > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Security Deposit</span>
                    <span className="font-medium">
                      ${agent.security_deposit_usdc}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Member Since */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Member Since</p>
                  <p className="font-medium">
                    {formatDate(agent.created_at)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ratings Summary */}
          {reputation.total_ratings > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Ratings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-4">
                  <div className="text-4xl font-bold">
                    {reputation.avg_rating?.toFixed(1)}
                  </div>
                  <div>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-4 w-4 ${
                            star <= Math.round(reputation.avg_rating || 0)
                              ? "text-amber-500 fill-amber-500"
                              : "text-gray-300"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {reputation.total_ratings} reviews
                    </p>
                  </div>
                </div>

                {/* Rating distribution - simplified */}
                <div className="space-y-2">
                  {[5, 4, 3, 2, 1].map((rating) => (
                    <div key={rating} className="flex items-center gap-2">
                      <span className="text-sm w-3">{rating}</span>
                      <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                      <Progress
                        value={rating === 5 ? 70 : rating === 4 ? 20 : 10}
                        className="flex-1 h-2"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Wallet */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Wallet Address
                </span>
                <code className="text-xs bg-muted px-2 py-1 rounded">
                  {agent.wallet_address?.slice(0, 4)}...
                  {agent.wallet_address?.slice(-4)}
                </code>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
