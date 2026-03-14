"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  DollarSign,
  Users,
  Calendar,
  Star,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  MessageSquare,
  Send,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getJob, listBids, selectBid, approveJob } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { useState } from "react";

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { token } = useAuthStore();
  const jobId = params.id as string;

  const [selectedBid, setSelectedBid] = useState<string | null>(null);

  const { data: job, isLoading: jobLoading } = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => getJob(jobId, token || undefined),
  });

  const { data: bidsData, isLoading: bidsLoading } = useQuery({
    queryKey: ["bids", jobId],
    queryFn: () => listBids(jobId, token || undefined),
  });

  const selectBidMutation = useMutation({
    mutationFn: (bidId: string) => selectBid(jobId, bidId, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      queryClient.invalidateQueries({ queryKey: ["bids", jobId] });
    },
  });

  const approveMutation = useMutation({
    mutationFn: () => approveJob(jobId, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
    },
  });

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "draft":
        return { label: "Draft", variant: "secondary" as const, icon: Clock };
      case "open":
      case "bidding":
        return { label: "Open for Bids", variant: "success" as const, icon: Users };
      case "assigned":
        return { label: "Assigned", variant: "default" as const, icon: CheckCircle2 };
      case "in_progress":
        return { label: "In Progress", variant: "default" as const, icon: Loader2 };
      case "delivered":
        return { label: "Delivered", variant: "warning" as const, icon: Send };
      case "completed":
        return { label: "Completed", variant: "success" as const, icon: CheckCircle2 };
      case "disputed":
        return { label: "Disputed", variant: "destructive" as const, icon: AlertCircle };
      default:
        return { label: status, variant: "secondary" as const, icon: Clock };
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (jobLoading) {
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

  if (!job) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">Job not found</h2>
        <p className="text-muted-foreground mb-4">
          This job may have been deleted or you don&apos;t have access to it.
        </p>
        <Button onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  const statusInfo = getStatusInfo(job.status);
  const StatusIcon = statusInfo.icon;
  const bids = bidsData?.bids || [];
  const canSelectBid = job.status === "bidding" || job.status === "open";
  const canApprove = job.status === "delivered";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold">{job.title}</h1>
              <Badge variant={statusInfo.variant}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {statusInfo.label}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Posted {formatDate(job.created_at)} at {formatTime(job.created_at)}
            </p>
          </div>
        </div>

        {canApprove && (
          <Button
            onClick={() => approveMutation.mutate()}
            disabled={approveMutation.isPending}
          >
            {approveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}
            Approve & Release Payment
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Job Description */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Job Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-wrap">
                {job.description}
              </p>

              <div className="flex flex-wrap gap-2 mt-6">
                {(job.required_skills || []).map((skill: string) => (
                  <Badge key={skill} variant="secondary">
                    {skill}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Bids */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  Bids ({bids.length})
                </CardTitle>
                {canSelectBid && bids.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Select a bid to hire the agent
                  </p>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {bidsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-32" />
                  ))}
                </div>
              ) : bids.length > 0 ? (
                <div className="space-y-4">
                  {bids.map((bid: any) => (
                    <div
                      key={bid.id}
                      className={`p-4 rounded-lg border transition-all ${
                        selectedBid === bid.id
                          ? "border-primary bg-primary/5"
                          : bid.status === "accepted"
                          ? "border-green-500 bg-green-50 dark:bg-green-950"
                          : "hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {bid.agent?.display_name?.slice(0, 2).toUpperCase() || "AG"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/dashboard/agents/${bid.agent_id}`}
                                className="font-medium hover:underline"
                              >
                                {bid.agent?.display_name || "Agent"}
                              </Link>
                              {bid.agent?.trust_tier && (
                                <Badge variant={bid.agent.trust_tier as any} className="text-xs">
                                  {bid.agent.trust_tier.replace("_", " ")}
                                </Badge>
                              )}
                              {bid.status === "accepted" && (
                                <Badge variant="success" className="text-xs">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Selected
                                </Badge>
                              )}
                            </div>
                            {bid.agent?.reputation && (
                              <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                                <span className="flex items-center gap-1">
                                  <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                                  {bid.agent.reputation.avg_rating?.toFixed(1) || "New"}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Briefcase className="h-3.5 w-3.5" />
                                  {bid.agent.reputation.completed_jobs || 0} jobs
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-xl font-bold text-primary">
                            ${bid.bid_amount}
                          </p>
                          {bid.estimated_hours && (
                            <p className="text-sm text-muted-foreground">
                              Est. {bid.estimated_hours}h
                            </p>
                          )}
                        </div>
                      </div>

                      <p className="text-sm text-muted-foreground mt-3">
                        {bid.proposal}
                      </p>

                      {canSelectBid && bid.status === "pending" && (
                        <div className="flex gap-2 mt-4">
                          <Button
                            size="sm"
                            onClick={() => setSelectedBid(bid.id)}
                            variant={selectedBid === bid.id ? "default" : "outline"}
                          >
                            {selectedBid === bid.id ? "Selected" : "Select"}
                          </Button>
                          {selectedBid === bid.id && (
                            <Button
                              size="sm"
                              onClick={() => selectBidMutation.mutate(bid.id)}
                              disabled={selectBidMutation.isPending}
                            >
                              {selectBidMutation.isPending ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : null}
                              Confirm & Hire
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="font-medium">No bids yet</p>
                  <p className="text-sm text-muted-foreground">
                    Agents will submit bids once your job is published.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Job Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Job Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Budget</span>
                <span className="font-semibold">
                  ${job.budget_min} - ${job.budget_max}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Task Type</span>
                <Badge variant="outline" className="capitalize">
                  {job.task_type}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Complexity</span>
                <Badge variant="secondary" className="capitalize">
                  {job.complexity}
                </Badge>
              </div>
              {job.deadline && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Deadline</span>
                  <span className="font-medium">{formatDate(job.deadline)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total Bids</span>
                <span className="font-medium">{bids.length}</span>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <div className="flex-1 w-px bg-border" />
                  </div>
                  <div className="pb-4">
                    <p className="text-sm font-medium">Job Created</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(job.created_at)}
                    </p>
                  </div>
                </div>

                {job.published_at && (
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                      <div className="flex-1 w-px bg-border" />
                    </div>
                    <div className="pb-4">
                      <p className="text-sm font-medium">Published</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(job.published_at)}
                      </p>
                    </div>
                  </div>
                )}

                {job.started_at && (
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                      <div className="flex-1 w-px bg-border" />
                    </div>
                    <div className="pb-4">
                      <p className="text-sm font-medium">Work Started</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(job.started_at)}
                      </p>
                    </div>
                  </div>
                )}

                {job.delivered_at && (
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                      <div className="flex-1 w-px bg-border" />
                    </div>
                    <div className="pb-4">
                      <p className="text-sm font-medium">Delivered</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(job.delivered_at)}
                      </p>
                    </div>
                  </div>
                )}

                {job.completed_at && (
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-green-600">
                        Completed
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(job.completed_at)}
                      </p>
                    </div>
                  </div>
                )}

                {!job.completed_at && (
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="h-2 w-2 rounded-full bg-muted" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Pending...
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Assigned Agent */}
          {job.agent && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Assigned Agent</CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  href={`/dashboard/agents/${job.agent.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:border-primary/50 transition-colors"
                >
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary/10 text-primary text-lg">
                      {job.agent.display_name?.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{job.agent.display_name}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                      <span>
                        {job.agent.reputation?.avg_rating?.toFixed(1) || "New"}
                      </span>
                    </div>
                  </div>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
