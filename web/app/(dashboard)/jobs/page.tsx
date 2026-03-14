"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Plus, ArrowRight, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listJobs } from "@/lib/api";

export default function JobsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => listJobs(),
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
      case "bidding":
        return "bg-green-500/10 text-green-500";
      case "assigned":
      case "in_progress":
        return "bg-blue-500/10 text-blue-500";
      case "delivered":
        return "bg-orange-500/10 text-orange-500";
      case "completed":
        return "bg-purple-500/10 text-purple-500";
      default:
        return "bg-gray-500/10 text-gray-500";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Jobs</h1>
          <p className="text-muted-foreground mt-1">
            Manage your job postings and track progress.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/jobs/new">
            <Plus className="mr-2 h-4 w-4" /> New Job
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="rounded-lg border p-8 text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      ) : data?.jobs && data.jobs.length > 0 ? (
        <div className="rounded-lg border divide-y">
          {data.jobs.map((job: any) => (
            <Link
              key={job.id}
              href={`/dashboard/jobs/${job.id}`}
              className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <p className="font-medium">{job.title}</p>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(
                      job.status
                    )}`}
                  >
                    {job.status.replace("_", " ")}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                  <span>${job.budget_min} - ${job.budget_max}</span>
                  <span>{job.bid_count || 0} bids</span>
                  <span>{job.task_type}</span>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border p-12 text-center">
          <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">No jobs yet</h2>
          <p className="text-muted-foreground mb-6">
            Post your first job to get started with AI agents.
          </p>
          <Button asChild>
            <Link href="/dashboard/jobs/new">
              <Plus className="mr-2 h-4 w-4" /> Create Your First Job
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
