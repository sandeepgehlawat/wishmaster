"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { getJob, publishJob, listBids } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;
  const { token } = useAuthStore();

  const [job, setJob] = useState<any>(null);
  const [bids, setBids] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (!jobId) return;

      try {
        setLoading(true);
        setError(null);

        const jobData = await getJob(jobId, token || undefined);
        setJob(jobData);

        // Also fetch bids if job exists
        if (jobData?.id) {
          try {
            const bidsData = await listBids(jobId, token || undefined);
            setBids(bidsData.bids || []);
          } catch (e) {
            // Bids might not exist yet, that's ok
            setBids([]);
          }
        }
      } catch (err: any) {
        console.error("Failed to fetch job:", err);
        setError(err.message || "Failed to load job");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [jobId, token]);

  const handlePublish = async () => {
    if (!token) {
      setPublishError("Please connect your wallet first");
      return;
    }

    try {
      setPublishing(true);
      setPublishError(null);

      console.log("Publishing job:", jobId);
      const result = await publishJob(jobId, token);
      console.log("Publish result:", result);

      // For now, just update the status locally and show success
      // In production, this would trigger a Solana transaction
      setJob((prev: any) => ({
        ...prev,
        status: "open",
      }));

      alert("Job published successfully! It's now visible in the marketplace.");

      // Refresh the page to get updated data
      router.refresh();
    } catch (err: any) {
      console.error("Failed to publish job:", err);
      setPublishError(err.message || "Failed to publish job");
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-white/50" />
        <span className="ml-3 text-white/50">LOADING JOB...</span>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="border-2 border-red-500 p-8 text-center">
        <p className="text-red-500 mb-4">{error || "Job not found"}</p>
        <Link
          href="/dashboard/jobs"
          className="border-2 border-white px-6 py-3 text-sm font-bold tracking-wider hover:bg-white hover:text-black transition-colors inline-block"
        >
          [BACK TO JOBS]
        </Link>
      </div>
    );
  }

  // Map API response fields
  const jobData = {
    id: job.id,
    title: job.title,
    status: (job.status || "draft").toUpperCase(),
    description: job.description,
    skills: job.required_skills || job.skills || [],
    budgetMin: parseFloat(job.budget_min) || 0,
    budgetMax: parseFloat(job.budget_max) || 0,
    escrowStatus: job.escrow?.status?.toUpperCase() || "UNFUNDED",
    escrowAmount: parseFloat(job.escrow?.amount_usdc) || 0,
    deadline: job.deadline || job.bid_deadline || "---",
    created: job.created_at ? new Date(job.created_at).toLocaleDateString() : "---",
    timeline: [
      { state: "DRAFT", date: job.created_at ? new Date(job.created_at).toLocaleDateString() : "---", active: job.status === "draft" },
      { state: "OPEN", date: job.published_at ? new Date(job.published_at).toLocaleDateString() : "---", active: job.status === "open" },
      { state: "BIDDING", date: "---", active: job.status === "bidding" },
      { state: "IN_PROGRESS", date: job.started_at ? new Date(job.started_at).toLocaleDateString() : "---", active: job.status === "in_progress" },
      { state: "DELIVERED", date: job.delivered_at ? new Date(job.delivered_at).toLocaleDateString() : "---", active: job.status === "delivered" },
      { state: "COMPLETED", date: job.completed_at ? new Date(job.completed_at).toLocaleDateString() : "---", active: job.status === "completed" },
    ],
  };

  const renderActions = () => {
    const status = jobData.status.toLowerCase();

    if (status === "draft") {
      return (
        <div className="flex flex-col gap-2">
          {publishError && (
            <div className="text-red-500 text-xs mb-2">{publishError}</div>
          )}
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="border-2 border-white px-4 py-2 text-sm font-bold tracking-wider bg-white text-black hover:bg-black hover:text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {publishing && <Loader2 className="h-4 w-4 animate-spin" />}
            {publishing ? "[PUBLISHING...]" : "[PUBLISH]"}
          </button>
          <Link
            href={`/dashboard/jobs/${jobId}/edit`}
            className="border-2 border-white px-4 py-2 text-sm font-bold tracking-wider hover:bg-white hover:text-black transition-colors text-center"
          >
            [EDIT]
          </Link>
          <button className="border-2 border-white px-4 py-2 text-sm font-bold tracking-wider hover:bg-white/10 transition-colors">
            [DELETE]
          </button>
        </div>
      );
    }

    if (status === "bidding" || status === "open") {
      return (
        <Link
          href={`/dashboard/jobs/${jobId}/manage`}
          className="w-full border-2 border-white px-4 py-2 text-sm font-bold tracking-wider bg-white text-black hover:bg-black hover:text-white transition-colors block text-center"
        >
          [MANAGE BIDS]
        </Link>
      );
    }

    if (status === "delivered") {
      return (
        <div className="flex flex-col gap-2">
          <button className="border-2 border-white px-4 py-2 text-sm font-bold tracking-wider bg-white text-black hover:bg-black hover:text-white transition-colors">
            [APPROVE]
          </button>
          <button className="border-2 border-white px-4 py-2 text-sm font-bold tracking-wider hover:bg-white hover:text-black transition-colors">
            [REQUEST REVISION]
          </button>
          <button className="border-2 border-white px-4 py-2 text-sm font-bold tracking-wider hover:bg-white/10 transition-colors">
            [DISPUTE]
          </button>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-8 font-mono">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard/jobs"
            className="text-xs text-white/50 hover:text-white tracking-wider"
          >
            {"<"} BACK TO JOBS
          </Link>
          <div className="flex items-center gap-4 mt-2">
            <h1 className="text-2xl font-bold tracking-wider">{jobData.title}</h1>
            <span className="border-2 border-white px-3 py-1 text-xs tracking-wider">
              {jobData.status}
            </span>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
        {/* Left - Main */}
        <div className="space-y-8">
          {/* Description */}
          <div>
            <h2 className="text-xs text-white/50 tracking-wider mb-3">DESCRIPTION</h2>
            <p className="text-sm leading-relaxed">{jobData.description}</p>
          </div>

          {/* Skills */}
          <div>
            <h2 className="text-xs text-white/50 tracking-wider mb-3">REQUIRED SKILLS</h2>
            <div className="flex flex-wrap gap-2">
              {(Array.isArray(jobData.skills) ? jobData.skills : []).map((skill: string) => (
                <span
                  key={skill}
                  className="border border-white px-3 py-1 text-xs tracking-wider"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div>
            <h2 className="text-xs text-white/50 tracking-wider mb-3">STATE MACHINE</h2>
            <div className="border-2 border-white p-4">
              <div className="flex items-center gap-0 text-xs overflow-x-auto">
                {jobData.timeline.map((t: any, i: number) => (
                  <div key={t.state} className="flex items-center">
                    <div
                      className={`px-3 py-2 border-2 border-white whitespace-nowrap ${
                        t.active
                          ? "bg-white text-black font-bold"
                          : t.date !== "---"
                          ? "bg-white/10"
                          : "text-white/30"
                      }`}
                    >
                      {t.state}
                      <div className="text-[10px] mt-0.5 opacity-60">{t.date}</div>
                    </div>
                    {i < jobData.timeline.length - 1 && (
                      <div className={`w-4 h-[2px] ${t.date !== "---" ? "bg-white" : "bg-white/20"}`} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bids */}
          <div>
            <h2 className="text-lg font-bold tracking-wider mb-4">
              {`>>> BIDS (${bids.length})`}
            </h2>
            {bids.length > 0 ? (
              <div className="border-2 border-white">
                {bids.map((bid: any, i: number) => (
                  <div
                    key={bid.id}
                    className={`p-4 ${
                      i !== bids.length - 1 ? "border-b border-white/30" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-2">
                          <span className="font-bold">{bid.agent?.display_name || "Agent"}</span>
                          <span className="text-xs text-white/50">
                            {bid.agent?.reputation?.avg_rating || "N/A"} rating
                          </span>
                        </div>
                        <p className="text-sm text-white/70">{bid.proposal || "No proposal provided"}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xl font-bold">{parseFloat(bid.bid_amount) || 0} USDC</p>
                        <button className="mt-2 border border-white px-3 py-1 text-xs tracking-wider hover:bg-white hover:text-black transition-colors">
                          [SELECT]
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border-2 border-white p-8 text-center text-white/50">
                {jobData.status === "DRAFT"
                  ? "PUBLISH_JOB_TO_RECEIVE_BIDS"
                  : "WAITING_FOR_BIDS..."}
              </div>
            )}
          </div>
        </div>

        {/* Right - Sidebar */}
        <div className="space-y-6">
          {/* Budget Info */}
          <div className="border-2 border-white p-4 space-y-3">
            <h3 className="text-xs text-white/50 tracking-wider">BUDGET</h3>
            <p className="text-2xl font-bold">{jobData.budgetMin} - {jobData.budgetMax} USDC</p>
          </div>

          {/* Escrow */}
          <div className="border-2 border-white p-4 space-y-3">
            <h3 className="text-xs text-white/50 tracking-wider">ESCROW</h3>
            <p className="text-lg font-bold">{jobData.escrowAmount} USDC</p>
            <p className="text-xs">
              STATUS:{" "}
              <span className={jobData.escrowStatus === "FUNDED" ? "text-green-400" : "text-white/50"}>
                {jobData.escrowStatus}
              </span>
            </p>
          </div>

          {/* Deadline */}
          <div className="border-2 border-white p-4 space-y-3">
            <h3 className="text-xs text-white/50 tracking-wider">DEADLINE</h3>
            <p className="text-lg font-bold">
              {typeof jobData.deadline === 'string' && jobData.deadline !== '---'
                ? new Date(jobData.deadline).toLocaleDateString()
                : jobData.deadline}
            </p>
          </div>

          {/* Actions */}
          <div>{renderActions()}</div>
        </div>
      </div>
    </div>
  );
}
