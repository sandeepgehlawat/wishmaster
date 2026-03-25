"use client";

import { useState } from "react";
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  Download,
  Loader2,
  Plus,
  MessageSquare,
} from "lucide-react";
import {
  submitDeliverable,
  approveDeliverable,
  requestChanges,
} from "@/lib/api";
import type {
  Deliverable,
  CreateDeliverableInput,
  DeliverableStatus,
  Requirement,
} from "@/lib/types";

interface DeliverablesProps {
  jobId: string;
  deliverables: Deliverable[];
  requirements?: Requirement[];
  token: string;
  userType: "client" | "agent";
  jobStatus?: string;
  onUpdate: () => void;
}

const STATUS_CONFIG: Record<
  DeliverableStatus,
  { icon: React.ElementType; color: string; bgColor: string; label: string }
> = {
  pending_review: {
    icon: Clock,
    color: "text-yellow-400",
    bgColor: "bg-yellow-400/10",
    label: "Pending Review",
  },
  approved: {
    icon: CheckCircle2,
    color: "text-secondary-400",
    bgColor: "bg-secondary-400/10",
    label: "Approved",
  },
  changes_requested: {
    icon: AlertCircle,
    color: "text-red-400",
    bgColor: "bg-red-400/10",
    label: "Changes Requested",
  },
};

export default function Deliverables({
  jobId,
  deliverables,
  requirements = [],
  token,
  userType,
  jobStatus,
  onUpdate,
}: DeliverablesProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [downloading, setDownloading] = useState(false);

  const canExport = jobStatus === "completed" || jobStatus === "delivered";

  const handleExport = async () => {
    try {
      setDownloading(true);
      const { getApiBaseUrl } = await import("@/lib/api");
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/jobs/${jobId}/deliverables/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `job-${jobId.slice(0, 8)}-deliverables.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || "Failed to export deliverables");
    } finally {
      setDownloading(false);
    }
  };

  const pendingCount = deliverables.filter(
    (d) => d.status === "pending_review"
  ).length;

  const handleApprove = async (id: string) => {
    try {
      setActionLoading(id);
      await approveDeliverable(id, token);
      onUpdate();
    } catch (error) {
      console.error("Failed to approve:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRequestChanges = async (id: string) => {
    if (!feedback.trim()) return;

    try {
      setActionLoading(id);
      await requestChanges(id, feedback, token);
      setFeedbackId(null);
      setFeedback("");
      onUpdate();
    } catch (error) {
      console.error("Failed to request changes:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="border-2 border-white">
      {/* Header */}
      <div className="border-b border-white/30 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-bold tracking-wider">DELIVERABLES</h3>
          {pendingCount > 0 && (
            <span className="bg-yellow-400 text-black text-[10px] px-1.5 py-0.5 font-bold">
              {pendingCount} PENDING
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/50">{deliverables.length} items</span>
          {canExport && (
            <button
              onClick={handleExport}
              disabled={downloading}
              className="flex items-center gap-1 border border-cyan-400 text-cyan-400 px-2 py-0.5 text-xs font-bold tracking-wider hover:bg-cyan-400 hover:text-black transition-colors disabled:opacity-50"
            >
              {downloading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
              {downloading ? "EXPORTING..." : "[DOWNLOAD ZIP]"}
            </button>
          )}
        </div>
      </div>

      {/* Deliverables List */}
      <div className="divide-y divide-white/10">
        {deliverables.map((del) => {
          const StatusIcon = STATUS_CONFIG[del.status].icon;
          const statusConfig = STATUS_CONFIG[del.status];

          return (
            <div
              key={del.id}
              className={`p-4 ${statusConfig.bgColor}`}
            >
              <div className="flex items-start gap-3 flex-wrap sm:flex-nowrap">
                {/* File Icon */}
                <div className={`mt-0.5 ${statusConfig.color}`}>
                  <FileText className="h-5 w-5" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span
                      className={`text-[10px] uppercase font-bold ${statusConfig.color}`}
                    >
                      {statusConfig.label}
                    </span>
                    {del.version > 1 && (
                      <span className="text-[10px] text-white/50">
                        v{del.version}
                      </span>
                    )}
                    {del.requirement_title && (
                      <span className="text-[10px] text-blue-400">
                        → {del.requirement_title}
                      </span>
                    )}
                  </div>

                  <h4 className="font-medium mb-1">{del.title}</h4>

                  {del.description && (
                    <p className="text-sm text-white/70 mb-2">{del.description}</p>
                  )}

                  {/* File Info */}
                  {del.file_url && (
                    <a
                      href={del.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 mb-2"
                    >
                      <Download className="h-3 w-3" />
                      {del.file_name || "Download"}
                      {del.file_size && (
                        <span className="text-white/50">
                          ({formatFileSize(del.file_size)})
                        </span>
                      )}
                    </a>
                  )}

                  {/* Client Feedback */}
                  {del.client_feedback && del.status === "changes_requested" && (
                    <div className="text-xs text-red-400 bg-red-400/10 p-2 mt-2 flex items-start gap-2">
                      <MessageSquare className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>{del.client_feedback}</span>
                    </div>
                  )}

                  {/* Feedback Input Form */}
                  {feedbackId === del.id && (
                    <div className="mt-3 space-y-2">
                      <textarea
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        placeholder="What changes are needed?"
                        className="w-full bg-black border-2 border-red-400 px-3 py-2 text-sm focus:outline-none h-20 resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRequestChanges(del.id)}
                          disabled={!feedback.trim() || actionLoading === del.id}
                          className="border-2 border-red-400 text-red-400 px-3 py-1 text-xs hover:bg-red-400 hover:text-black transition-colors disabled:opacity-50 flex items-center gap-1"
                        >
                          {actionLoading === del.id && (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          )}
                          Request Changes
                        </button>
                        <button
                          onClick={() => {
                            setFeedbackId(null);
                            setFeedback("");
                          }}
                          className="border-2 border-white/50 text-white/50 px-3 py-1 text-xs hover:border-white hover:text-white transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Timestamp */}
                  <div className="text-[10px] text-white/30 mt-2">
                    by {del.agent_name} •{" "}
                    {new Date(del.created_at).toLocaleDateString()}
                  </div>
                </div>

                {/* Actions */}
                {actionLoading !== del.id && feedbackId !== del.id && (
                  <div className="flex gap-2 flex-shrink-0 flex-wrap">
                    {userType === "client" && del.status === "pending_review" && (
                      <>
                        <button
                          onClick={() => handleApprove(del.id)}
                          className="border-2 border-secondary-400 text-secondary-400 px-3 py-1 text-xs hover:bg-secondary-400 hover:text-black transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => setFeedbackId(del.id)}
                          className="border-2 border-red-400 text-red-400 px-3 py-1 text-xs hover:bg-red-400 hover:text-black transition-colors"
                        >
                          Changes
                        </button>
                      </>
                    )}
                  </div>
                )}

                {actionLoading === del.id && (
                  <Loader2 className="h-5 w-5 animate-spin text-white/50" />
                )}
              </div>
            </div>
          );
        })}

        {deliverables.length === 0 && !isAdding && (
          <div className="p-8 text-center text-white/50 text-sm">
            No deliverables submitted yet.
          </div>
        )}
      </div>

      {/* Add Deliverable Form (Agent only) */}
      {userType === "agent" && (
        <>
          {isAdding ? (
            <AddDeliverableForm
              jobId={jobId}
              requirements={requirements}
              token={token}
              onSubmit={() => {
                setIsAdding(false);
                onUpdate();
              }}
              onCancel={() => setIsAdding(false)}
            />
          ) : (
            <button
              onClick={() => setIsAdding(true)}
              className="w-full p-4 border-t border-white/30 text-white/50 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <Plus className="h-4 w-4" />
              Submit Deliverable
            </button>
          )}
        </>
      )}
    </div>
  );
}

function AddDeliverableForm({
  jobId,
  requirements,
  token,
  onSubmit,
  onCancel,
}: {
  jobId: string;
  requirements: Requirement[];
  token: string;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<CreateDeliverableInput>({
    title: "",
    description: "",
    requirement_id: undefined,
    file_url: "",
    file_name: "",
  });

  const handleSubmit = async () => {
    if (!data.title.trim()) return;

    try {
      setSaving(true);
      await submitDeliverable(jobId, data, token);
      onSubmit();
    } catch (error) {
      console.error("Failed to submit deliverable:", error);
    } finally {
      setSaving(false);
    }
  };

  // Filter to show only requirements that can receive deliverables
  const linkableRequirements = requirements.filter(
    (r) => r.status !== "accepted"
  );

  return (
    <div className="p-4 border-t border-white/30 bg-white/5 space-y-3">
      <input
        type="text"
        placeholder="Deliverable title..."
        value={data.title}
        onChange={(e) => setData({ ...data, title: e.target.value })}
        className="w-full bg-black border-2 border-white px-3 py-2 text-sm focus:outline-none focus:border-secondary-400"
      />

      <textarea
        placeholder="Description..."
        value={data.description || ""}
        onChange={(e) => setData({ ...data, description: e.target.value })}
        className="w-full bg-black border-2 border-white px-3 py-2 text-sm focus:outline-none focus:border-secondary-400 h-20 resize-none"
      />

      {linkableRequirements.length > 0 && (
        <select
          value={data.requirement_id || ""}
          onChange={(e) =>
            setData({
              ...data,
              requirement_id: e.target.value || undefined,
            })
          }
          className="w-full bg-black border-2 border-white px-3 py-2 text-sm focus:outline-none focus:border-secondary-400"
        >
          <option value="">Link to requirement (optional)</option>
          {linkableRequirements.map((req) => (
            <option key={req.id} value={req.id}>
              {req.title}
            </option>
          ))}
        </select>
      )}

      <input
        type="text"
        placeholder="File URL (optional)..."
        value={data.file_url || ""}
        onChange={(e) => setData({ ...data, file_url: e.target.value })}
        className="w-full bg-black border-2 border-white px-3 py-2 text-sm focus:outline-none focus:border-secondary-400"
      />

      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={!data.title.trim() || saving}
          className="border-2 border-secondary-400 text-secondary-400 px-4 py-2 text-sm hover:bg-secondary-400 hover:text-black transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Submit
        </button>
        <button
          onClick={onCancel}
          className="border-2 border-white/50 text-white/50 px-4 py-2 text-sm hover:border-white hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
