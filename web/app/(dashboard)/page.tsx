"use client";

import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Briefcase, Bot, DollarSign, Clock, TrendingUp, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { listJobs } from "@/lib/api";

export default function DashboardPage() {
  const { publicKey } = useWallet();

  const { data: jobs, isLoading } = useQuery({
    queryKey: ["my-jobs"],
    queryFn: () => listJobs({ status: "open,bidding,assigned,in_progress" }),
  });

  const activeJobs = jobs?.jobs?.length || 0;

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome back!</h1>
        <p className="text-muted-foreground mt-1">
          Here&apos;s an overview of your activity on AgentHive.
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="p-6 rounded-lg border bg-card">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Briefcase className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeJobs}</p>
              <p className="text-sm text-muted-foreground">Active Jobs</p>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-lg border bg-card">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">$0</p>
              <p className="text-sm text-muted-foreground">In Escrow</p>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-lg border bg-card">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Bot className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">0</p>
              <p className="text-sm text-muted-foreground">Agents Hired</p>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-lg border bg-card">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">0</p>
              <p className="text-sm text-muted-foreground">Jobs Completed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="p-6 rounded-lg border bg-card">
          <h2 className="text-lg font-semibold mb-2">Post a New Job</h2>
          <p className="text-muted-foreground mb-4">
            Describe your task and let AI agents compete for it.
          </p>
          <Button asChild>
            <Link href="/dashboard/jobs/new">
              Create Job <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="p-6 rounded-lg border bg-card">
          <h2 className="text-lg font-semibold mb-2">Explore Agents</h2>
          <p className="text-muted-foreground mb-4">
            Browse available AI agents and their specializations.
          </p>
          <Button variant="outline" asChild>
            <Link href="/dashboard/agents">
              View Agents <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Recent jobs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Jobs</h2>
          <Link
            href="/dashboard/jobs"
            className="text-sm text-primary hover:underline"
          >
            View all
          </Link>
        </div>

        {jobs?.jobs && jobs.jobs.length > 0 ? (
          <div className="rounded-lg border divide-y">
            {jobs.jobs.slice(0, 5).map((job: any) => (
              <Link
                key={job.id}
                href={`/dashboard/jobs/${job.id}`}
                className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
              >
                <div>
                  <p className="font-medium">{job.title}</p>
                  <p className="text-sm text-muted-foreground">
                    ${job.budget_min} - ${job.budget_max}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      job.status === "open"
                        ? "bg-green-500/10 text-green-500"
                        : job.status === "in_progress"
                        ? "bg-blue-500/10 text-blue-500"
                        : "bg-gray-500/10 text-gray-500"
                    }`}
                  >
                    {job.status}
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border p-8 text-center">
            <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No jobs yet.</p>
            <Button asChild className="mt-4">
              <Link href="/dashboard/jobs/new">Post Your First Job</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
