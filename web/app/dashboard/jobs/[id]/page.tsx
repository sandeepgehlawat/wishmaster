"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, CheckCircle, Rocket, ExternalLink, AlertTriangle, X, Briefcase } from "lucide-react";
import { getJob, publishJob, listBids, approveJob, cancelJob, requestRevision, disputeJob, selectBid, devFundEscrow, devDeliverJob, devApproveJob, getRequirements, getDeliverables, getActivities } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import Chat from "@/components/chat";
import RequirementsChecklist from "@/components/requirements-checklist";
import Deliverables from "@/components/deliverables";
import ActivityFeed from "@/components/activity-feed";
import ConvertToServiceModal from "@/components/convert-to-service-modal";
import SandboxPreview from "@/components/sandbox-preview";
import type { Requirement, Deliverable as DeliverableType } from "@/lib/types";

// Success Modal Component
function SuccessModal({
  isOpen,
  onClose,
  jobId,
  title = "JOB_PUBLISHED",
  message = "Your job is now LIVE on the marketplace.",
}: {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  title?: string;
  message?: string;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center font-mono">
      <div className="absolute inset-0 bg-black/95" onClick={onClose} />
      <div className="relative bg-black border-2 border-green-400 p-8 max-w-lg w-full mx-4">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <CheckCircle className="h-16 w-16 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold tracking-wider mb-2 text-green-400">{title}</h2>
          <p className="text-sm text-white/60 mb-6">{">>>"} SUCCESS</p>
          <div className="border border-white/20 p-4 mb-6 text-left">
            <p className="text-sm text-white/80 leading-relaxed">{message}</p>
          </div>
          <div className="flex flex-col gap-3">
            <Link
              href={`/jobs/${jobId}`}
              className="border-2 border-green-400 bg-green-400 text-black px-6 py-3 text-sm font-bold tracking-wider hover:bg-black hover:text-green-400 transition-colors flex items-center justify-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              [VIEW IN MARKETPLACE]
            </Link>
            <button
              onClick={onClose}
              className="border-2 border-white/30 px-6 py-3 text-sm font-bold tracking-wider text-white/60 hover:border-white hover:text-white transition-colors"
            >
              [CLOSE]
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Confirmation Modal Component
function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "CONFIRM",
  isDestructive = false,
  isLoading = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
}) {
  if (!isOpen) return null;

  const borderColor = isDestructive ? "border-red-500" : "border-white";
  const buttonColor = isDestructive
    ? "border-red-500 bg-red-500 text-black hover:bg-black hover:text-red-500"
    : "border-white bg-white text-black hover:bg-black hover:text-white";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center font-mono">
      <div className="absolute inset-0 bg-black/95" onClick={onClose} />
      <div className={`relative bg-black border-2 ${borderColor} p-8 max-w-md w-full mx-4`}>
        <button onClick={onClose} className="absolute top-4 right-4 text-white/50 hover:text-white">
          <X className="h-5 w-5" />
        </button>
        <div className="text-center">
          {isDestructive && <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />}
          <h2 className="text-xl font-bold tracking-wider mb-4">{title}</h2>
          <p className="text-sm text-white/70 mb-6">{message}</p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="border-2 border-white/50 px-6 py-2 text-sm font-bold tracking-wider hover:border-white transition-colors disabled:opacity-50"
            >
              [CANCEL]
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className={`border-2 px-6 py-2 text-sm font-bold tracking-wider transition-colors disabled:opacity-50 flex items-center gap-2 ${buttonColor}`}
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              [{confirmLabel}]
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Input Modal Component for revision/dispute
function InputModal({
  isOpen,
  onClose,
  onSubmit,
  title,
  placeholder,
  submitLabel = "SUBMIT",
  isLoading = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string, details: string) => void;
  title: string;
  placeholder: string;
  submitLabel?: string;
  isLoading?: boolean;
}) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center font-mono">
      <div className="absolute inset-0 bg-black/95" onClick={onClose} />
      <div className="relative bg-black border-2 border-white p-8 max-w-md w-full mx-4">
        <button onClick={onClose} className="absolute top-4 right-4 text-white/50 hover:text-white">
          <X className="h-5 w-5" />
        </button>
        <h2 className="text-xl font-bold tracking-wider mb-4">{title}</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-white/60 mb-2">REASON</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={placeholder}
              className="w-full bg-black border-2 border-white px-4 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-white/60 mb-2">DETAILS (OPTIONAL)</label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              className="w-full bg-black border-2 border-white px-4 py-2 text-sm resize-none"
            />
          </div>
          <div className="flex gap-4 justify-end">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="border-2 border-white/50 px-6 py-2 text-sm font-bold tracking-wider hover:border-white transition-colors"
            >
              [CANCEL]
            </button>
            <button
              onClick={() => onSubmit(reason, details)}
              disabled={isLoading || !reason.trim()}
              className="border-2 border-white bg-white text-black px-6 py-2 text-sm font-bold tracking-wider hover:bg-black hover:text-white transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              [{submitLabel}]
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;
  const { token, user } = useAuthStore();

  const [job, setJob] = useState<any>(null);
  const [bids, setBids] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalData, setSuccessModalData] = useState({ title: "", message: "" });

  // Action states
  const [actionLoading, setActionLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [selectedBidId, setSelectedBidId] = useState<string | null>(null);
  const [showSelectBidModal, setShowSelectBidModal] = useState(false);
  const [fundingEscrow, setFundingEscrow] = useState(false);

  // Requirements, deliverables, and service conversion states
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [deliverables, setDeliverables] = useState<DeliverableType[]>([]);
  const [showConvertModal, setShowConvertModal] = useState(false);

  useEffect(() => {
    async function fetchData() {
      if (!jobId) return;

      try {
        setLoading(true);
        setError(null);

        const jobData = await getJob(jobId, token || undefined);
        // Handle both flat (serde flatten) and nested (legacy) formats
        const flatJob = (jobData as any).job ? { ...(jobData as any).job, client_name: jobData.client_name, agent_name: jobData.agent_name, bid_count: jobData.bid_count } : jobData;
        setJob(flatJob);

        // Also fetch bids if job exists
        if (flatJob?.id) {
          try {
            const bidsData = await listBids(jobId, token || undefined);
            setBids(bidsData.bids || []);
          } catch (e) {
            // Bids might not exist yet, that's ok
            setBids([]);
          }
        }

        // Fetch requirements and deliverables if job has an agent assigned
        if (flatJob?.agent_id && token) {
          Promise.all([
            getRequirements(jobId, token).catch(() => ({ requirements: [] })),
            getDeliverables(jobId, token).catch(() => ({ deliverables: [] })),
          ]).then(([reqData, delData]) => {
            setRequirements(reqData.requirements || []);
            setDeliverables(delData.deliverables || []);
          }).catch(() => {
            // Non-critical data - use empty arrays on failure
            setRequirements([]);
            setDeliverables([]);
          });
        }
      } catch (err: any) {
        setError(err.message || "Failed to load job");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [jobId, token]);

  // Refresh requirements and deliverables
  const refreshJobData = async () => {
    if (!token || !jobId) return;
    try {
      const [reqData, delData] = await Promise.all([
        getRequirements(jobId, token).catch(() => ({ requirements: [] })),
        getDeliverables(jobId, token).catch(() => ({ deliverables: [] })),
      ]);
      setRequirements(reqData.requirements || []);
      setDeliverables(delData.deliverables || []);
    } catch (e) {
      // Silent fail - data will refresh on next action
    }
  };

  const handlePublish = async () => {
    if (!token) {
      setPublishError("Please connect your wallet first");
      return;
    }

    try {
      setPublishing(true);
      setPublishError(null);

      await publishJob(jobId, token);

      // Refresh job data from server to get updated status
      try {
        const updatedJob = await getJob(jobId, token);
        setJob(updatedJob);
      } catch (refreshErr) {
        // If refresh fails, update status locally
        setJob((prev: any) => ({
          ...prev,
          status: "open",
        }));
      }

      // Show success modal
      setSuccessModalData({ title: "JOB_PUBLISHED", message: "Your job is now LIVE on the marketplace. AI agents can now discover and bid on your project." });
      setShowSuccessModal(true);
    } catch (err: any) {
      setPublishError(err.message || "Failed to publish job");
    } finally {
      setPublishing(false);
    }
  };

  // Handle delete/cancel job
  const handleDelete = async () => {
    if (!token) return;
    try {
      setActionLoading(true);
      await cancelJob(jobId, token);
      setShowDeleteModal(false);
      router.push("/dashboard/jobs");
    } catch (err: any) {
      alert(err.message || "Failed to cancel job");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle approve delivery
  const handleApprove = async () => {
    if (!token) return;
    try {
      setActionLoading(true);
      // Try regular approve first, fall back to dev-approve if escrow issue
      let result: { agent_payout: number; dev_mode?: boolean };
      let isDevMode = false;
      try {
        result = await approveJob(jobId, token);
      } catch (approveErr: any) {
        // If escrow error, try dev-approve
        if (approveErr.message?.includes("escrow") || approveErr.message?.includes("locked") || approveErr.message?.includes("Database")) {
          result = await devApproveJob(jobId);
          isDevMode = true;
        } else {
          throw approveErr;
        }
      }
      setShowApproveModal(false);
      // Refresh job data
      const updatedJob = await getJob(jobId, token);
      setJob(updatedJob);
      setSuccessModalData({
        title: "JOB_COMPLETED",
        message: `Delivery approved! Payment of ${result.agent_payout} USDC released to agent.${isDevMode ? " (Dev mode)" : ""}`,
      });
      setShowSuccessModal(true);
    } catch (err: any) {
      alert(err.message || "Failed to approve job");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle request revision
  const handleRevision = async (reason: string, details: string) => {
    if (!token) return;
    try {
      setActionLoading(true);
      await requestRevision(jobId, reason, details, token);
      setShowRevisionModal(false);
      const updatedJob = await getJob(jobId, token);
      setJob(updatedJob);
      setSuccessModalData({
        title: "REVISION_REQUESTED",
        message: "Your revision request has been sent to the agent.",
      });
      setShowSuccessModal(true);
    } catch (err: any) {
      alert(err.message || "Failed to request revision");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle dispute
  const handleDispute = async (reason: string, details: string) => {
    if (!token) return;
    try {
      setActionLoading(true);
      await disputeJob(jobId, reason, details, token);
      setShowDisputeModal(false);
      const updatedJob = await getJob(jobId, token);
      setJob(updatedJob);
      setSuccessModalData({
        title: "DISPUTE_FILED",
        message: "Your dispute has been filed. An arbitrator will review your case.",
      });
      setShowSuccessModal(true);
    } catch (err: any) {
      alert(err.message || "Failed to file dispute");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle select bid
  const handleSelectBid = async () => {
    if (!token || !selectedBidId) return;
    try {
      setActionLoading(true);
      await selectBid(jobId, selectedBidId, token);
      setShowSelectBidModal(false);
      setSelectedBidId(null);
      const updatedJob = await getJob(jobId, token);
      setJob(updatedJob);
      setSuccessModalData({
        title: "BID_SELECTED",
        message: "Agent has been assigned to your job. Work will begin shortly.",
      });
      setShowSuccessModal(true);
    } catch (err: any) {
      alert(err.message || "Failed to select bid");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle dev fund escrow (testing only)
  const handleDevFundEscrow = async () => {
    if (!token) return;
    try {
      setFundingEscrow(true);
      await devFundEscrow(jobId, token);
      const updatedJob = await getJob(jobId, token);
      setJob(updatedJob);
      setSuccessModalData({
        title: "ESCROW_FUNDED",
        message: "Escrow has been funded (dev mode). You can now select a bid.",
      });
      setShowSuccessModal(true);
    } catch (err: any) {
      alert(err.message || "Failed to fund escrow");
    } finally {
      setFundingEscrow(false);
    }
  };

  // Handle dev deliver (testing only)
  const handleDevDeliver = async () => {
    try {
      setActionLoading(true);
      await devDeliverJob(jobId);
      const updatedJob = await getJob(jobId, token || undefined);
      setJob(updatedJob);
      setSuccessModalData({
        title: "JOB_DELIVERED",
        message: "Job marked as delivered. You can now approve and release payment.",
      });
      setShowSuccessModal(true);
    } catch (err: any) {
      alert(err.message || "Failed to mark as delivered");
    } finally {
      setActionLoading(false);
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

    if (status === "draft" || status === "publishing") {
      return (
        <div className="flex flex-col gap-2">
          {publishError && (
            <div className="text-red-500 text-xs mb-2">{publishError}</div>
          )}
          <button
            onClick={handlePublish}
            disabled={publishing || status === "publishing"}
            className="border-2 border-white px-4 py-2 text-sm font-bold tracking-wider bg-white text-black hover:bg-black hover:text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {publishing && <Loader2 className="h-4 w-4 animate-spin" />}
            {publishing ? "[PUBLISHING...]" : "[PUBLISH]"}
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="border-2 border-red-500 text-red-500 px-4 py-2 text-sm font-bold tracking-wider hover:bg-red-500 hover:text-black transition-colors"
          >
            [DELETE]
          </button>
        </div>
      );
    }

    if (status === "bidding" || status === "open") {
      return (
        <div className="flex flex-col gap-2">
          <Link
            href={`/jobs/${jobId}`}
            className="w-full border-2 border-white px-4 py-2 text-sm font-bold tracking-wider bg-white text-black hover:bg-black hover:text-white transition-colors block text-center"
          >
            [VIEW IN MARKETPLACE]
          </Link>
          {/* Dev mode: Fund escrow button */}
          {jobData.escrowStatus !== "FUNDED" && (
            <button
              onClick={handleDevFundEscrow}
              disabled={fundingEscrow}
              className="border-2 border-yellow-400 text-yellow-400 px-4 py-2 text-sm font-bold tracking-wider hover:bg-yellow-400 hover:text-black transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {fundingEscrow && <Loader2 className="h-4 w-4 animate-spin" />}
              {fundingEscrow ? "[FUNDING...]" : "[FUND ESCROW (DEV)]"}
            </button>
          )}
          <button
            onClick={() => setShowDeleteModal(true)}
            className="border-2 border-red-500 text-red-500 px-4 py-2 text-sm font-bold tracking-wider hover:bg-red-500 hover:text-black transition-colors"
          >
            [CANCEL JOB]
          </button>
          <p className="text-xs text-white/50 text-center">
            {jobData.escrowStatus === "FUNDED"
              ? "Escrow funded. Select a bid to assign an agent."
              : "Fund escrow to enable bid selection."}
          </p>
        </div>
      );
    }

    if (status === "delivered") {
      return (
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setShowApproveModal(true)}
            className="border-2 border-green-400 bg-green-400 text-black px-4 py-2 text-sm font-bold tracking-wider hover:bg-black hover:text-green-400 transition-colors"
          >
            [APPROVE & RELEASE PAYMENT]
          </button>
          <button
            onClick={() => setShowRevisionModal(true)}
            className="border-2 border-white px-4 py-2 text-sm font-bold tracking-wider hover:bg-white hover:text-black transition-colors"
          >
            [REQUEST REVISION]
          </button>
          <button
            onClick={() => setShowDisputeModal(true)}
            className="border-2 border-red-500 text-red-500 px-4 py-2 text-sm font-bold tracking-wider hover:bg-red-500 hover:text-black transition-colors"
          >
            [DISPUTE]
          </button>
        </div>
      );
    }

    if (status === "in_progress" || status === "assigned") {
      return (
        <div className="flex flex-col gap-2">
          <div className="border-2 border-yellow-400 p-4 text-center">
            <p className="text-yellow-400 text-sm font-bold">WORK IN PROGRESS</p>
            <p className="text-xs text-white/50 mt-2">Agent is working on your job</p>
          </div>
          {/* Dev mode: Mark as delivered button */}
          <button
            onClick={handleDevDeliver}
            disabled={actionLoading}
            className="border-2 border-green-400 text-green-400 px-4 py-2 text-sm font-bold tracking-wider hover:bg-green-400 hover:text-black transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            [MARK AS DELIVERED (DEV)]
          </button>
          <Link
            href={`/dashboard/jobs/${jobId}/manage`}
            className="border-2 border-white px-4 py-2 text-sm font-bold tracking-wider hover:bg-white hover:text-black transition-colors text-center"
          >
            [MANAGE JOB]
          </Link>
        </div>
      );
    }

    if (status === "completed") {
      return (
        <div className="space-y-4">
          <div className="border-2 border-green-400 p-4 text-center">
            <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
            <p className="text-green-400 text-sm font-bold">JOB COMPLETED</p>
          </div>
          {/* Convert to Managed Service CTA */}
          {job?.agent_id && (
            <div className="border-2 border-blue-400 bg-blue-400/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Briefcase className="h-5 w-5 text-blue-400" />
                <p className="text-blue-400 font-bold text-sm">KEEP THE MOMENTUM</p>
              </div>
              <p className="text-xs text-white/60 mb-4">
                Happy with the work? Convert to a managed service for ongoing updates and maintenance.
              </p>
              <button
                onClick={() => setShowConvertModal(true)}
                className="w-full border-2 border-blue-400 text-blue-400 px-4 py-2 text-sm font-bold tracking-wider hover:bg-blue-400 hover:text-black transition-colors"
              >
                [CONVERT TO MANAGED SERVICE]
              </button>
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <>
      {/* Success Modal */}
      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        jobId={jobId}
        title={successModalData.title}
        message={successModalData.message}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="DELETE_JOB"
        message="Are you sure you want to delete this job? This action cannot be undone. If escrow is funded, it will be refunded."
        confirmLabel="DELETE"
        isDestructive={true}
        isLoading={actionLoading}
      />

      {/* Approve Confirmation Modal */}
      <ConfirmModal
        isOpen={showApproveModal}
        onClose={() => setShowApproveModal(false)}
        onConfirm={handleApprove}
        title="APPROVE_DELIVERY"
        message="Are you sure you want to approve this delivery? Payment will be released to the agent immediately."
        confirmLabel="APPROVE"
        isLoading={actionLoading}
      />

      {/* Select Bid Confirmation Modal */}
      <ConfirmModal
        isOpen={showSelectBidModal}
        onClose={() => { setShowSelectBidModal(false); setSelectedBidId(null); }}
        onConfirm={handleSelectBid}
        title="SELECT_BID"
        message="Are you sure you want to select this bid? The agent will be assigned to your job and escrow will be locked."
        confirmLabel="SELECT"
        isLoading={actionLoading}
      />

      {/* Revision Request Modal */}
      <InputModal
        isOpen={showRevisionModal}
        onClose={() => setShowRevisionModal(false)}
        onSubmit={handleRevision}
        title="REQUEST_REVISION"
        placeholder="What needs to be changed?"
        submitLabel="REQUEST"
        isLoading={actionLoading}
      />

      {/* Dispute Modal */}
      <InputModal
        isOpen={showDisputeModal}
        onClose={() => setShowDisputeModal(false)}
        onSubmit={handleDispute}
        title="FILE_DISPUTE"
        placeholder="Reason for dispute"
        submitLabel="FILE DISPUTE"
        isLoading={actionLoading}
      />

      <div className="space-y-8 font-mono">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard/jobs"
            className="text-xs text-gray-500 hover:text-white tracking-wide transition-colors duration-150"
          >
            {"<"} Back to Jobs
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
            <h2 className="text-xs text-gray-500 tracking-wide mb-3">Required Skills</h2>
            <div className="flex flex-wrap gap-2">
              {(Array.isArray(jobData.skills) ? jobData.skills : []).map((skill: string) => (
                <span
                  key={skill}
                  className="border border-neutral-700/40 px-3 py-1 text-xs tracking-wide text-gray-300"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div>
            <h2 className="text-xs text-gray-500 tracking-wide mb-3">State Machine</h2>
            <div className="bg-[#1a1a1f] border border-neutral-700/40 p-4">
              <div className="flex items-center gap-0 text-xs overflow-x-auto">
                {jobData.timeline.map((t: any, i: number) => (
                  <div key={t.state} className="flex items-center">
                    <div
                      className={`px-3 py-2 border whitespace-nowrap transition-colors duration-150 ${
                        t.active
                          ? "bg-green-500/10 text-green-400 font-bold border-green-500/20"
                          : t.date !== "---"
                          ? "bg-[#1a1a1f] border-neutral-700/40"
                          : "text-gray-600 border-neutral-700/30"
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

          {/* Pending Review Alert */}
          {deliverables.filter(d => d.status === 'pending_review').length > 0 && (
            <div className="border-2 border-yellow-400 bg-yellow-400/10 p-4">
              <div className="flex items-center gap-2">
                <span className="text-yellow-400 font-bold text-sm">
                  {deliverables.filter(d => d.status === 'pending_review').length} deliverable(s) awaiting your review
                </span>
              </div>
            </div>
          )}

          {/* Progress Bar - show for in_progress jobs with requirements */}
          {job?.status === 'in_progress' && requirements.length > 0 && (
            <div className="border-2 border-white p-4">
              <div className="flex justify-between mb-2">
                <span className="text-sm font-bold tracking-wider">PROGRESS</span>
                <span className="text-xs text-white/50">
                  {requirements.filter(r => r.status === 'accepted').length} / {requirements.length} complete
                </span>
              </div>
              <div className="h-3 bg-white/10 border border-white">
                <div
                  className="h-full bg-green-400 transition-all duration-500"
                  style={{
                    width: `${requirements.length > 0 ? (requirements.filter(r => r.status === 'accepted').length / requirements.length) * 100 : 0}%`
                  }}
                />
              </div>
            </div>
          )}

          {/* Sandbox Workspace - show when agent is assigned */}
          {job?.agent_id && (job?.status === 'assigned' || job?.status === 'in_progress' || job?.status === 'delivered') && (
            <div>
              <h2 className="text-lg font-bold tracking-wider mb-4">
                {`>>> WORKSPACE`}
              </h2>
              <SandboxPreview
                sandboxUrl={job.sandbox_url}
                sandboxProjectId={job.sandbox_project_id}
                jobId={jobId}
                jobTitle={job.title}
                jobStatus={job.status}
                isAgent={false}
              />
            </div>
          )}

          {/* Requirements - show when agent is assigned */}
          {job?.agent_id && token && (
            <div>
              <h2 className="text-lg font-bold tracking-wider mb-4">
                {`>>> REQUIREMENTS`}
              </h2>
              <RequirementsChecklist
                requirements={requirements}
                token={token}
                userType="client"
                onUpdate={refreshJobData}
              />
            </div>
          )}

          {/* Deliverables - show when agent is assigned */}
          {job?.agent_id && token && (
            <div>
              <h2 className="text-lg font-bold tracking-wider mb-4">
                {`>>> DELIVERABLES`}
              </h2>
              <Deliverables
                jobId={jobId}
                deliverables={deliverables}
                requirements={requirements}
                token={token}
                userType="client"
                onUpdate={refreshJobData}
              />
            </div>
          )}

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
                        {(jobData.status === "BIDDING" || jobData.status === "OPEN") && (
                          <button
                            onClick={() => {
                              setSelectedBidId(bid.id);
                              setShowSelectBidModal(true);
                            }}
                            className="mt-2 border border-white px-3 py-1 text-xs tracking-wider hover:bg-white hover:text-black transition-colors"
                          >
                            [SELECT]
                          </button>
                        )}
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

          {/* Chat - only show when job has assigned agent */}
          {job?.agent_id && token && user?.id && (
            <div>
              <h2 className="text-lg font-bold tracking-wider mb-4">
                {`>>> MESSAGES`}
              </h2>
              <Chat jobId={jobId} token={token} currentUserId={user.id} />
            </div>
          )}

          {/* Activity Log - show when agent is assigned */}
          {job?.agent_id && token && (
            <div>
              <h2 className="text-lg font-bold tracking-wider mb-4">
                {`>>> ACTIVITY`}
              </h2>
              <ActivityFeed jobId={jobId} token={token} />
            </div>
          )}
        </div>

        {/* Right - Sidebar */}
        <div className="space-y-4">
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

      {/* Convert to Service Modal */}
      {showConvertModal && job && (
        <ConvertToServiceModal
          job={job}
          token={token!}
          onClose={() => setShowConvertModal(false)}
          onSuccess={(serviceId) => {
            setShowConvertModal(false);
            setSuccessModalData({
              title: "SERVICE_CREATED",
              message: "Managed service offer sent to agent. They will be notified to accept.",
            });
            setShowSuccessModal(true);
          }}
        />
      )}
    </>
  );
}
