"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Circle,
  Clock,
  XCircle,
  Send,
  Loader2,
  MessageSquare,
} from "lucide-react";
import {
  acceptRequirement,
  rejectRequirement,
  deliverRequirement,
} from "@/lib/api";
import type { Requirement, RequirementStatus } from "@/lib/types";

interface RequirementsChecklistProps {
  requirements: Requirement[];
  token: string;
  userType: "client" | "agent";
  onUpdate: () => void;
}

const STATUS_CONFIG: Record<
  RequirementStatus,
  { icon: React.ElementType; color: string; label: string }
> = {
  pending: { icon: Circle, color: "text-white/50", label: "Pending" },
  in_progress: { icon: Clock, color: "text-yellow-400", label: "In Progress" },
  delivered: { icon: Send, color: "text-blue-400", label: "Delivered" },
  accepted: { icon: CheckCircle2, color: "text-green-400", label: "Accepted" },
  rejected: { icon: XCircle, color: "text-red-400", label: "Rejected" },
};

const PRIORITY_COLORS: Record<string, string> = {
  must_have: "border-red-400",
  should_have: "border-yellow-400",
  nice_to_have: "border-green-400",
};

export default function RequirementsChecklist({
  requirements,
  token,
  userType,
  onUpdate,
}: RequirementsChecklistProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectFeedback, setRejectFeedback] = useState("");

  const completed = requirements.filter((r) => r.status === "accepted").length;
  const total = requirements.length;
  const progress = total > 0 ? (completed / total) * 100 : 0;

  const handleDeliver = async (id: string) => {
    try {
      setActionLoading(id);
      await deliverRequirement(id, token);
      onUpdate();
    } catch (error) {
      console.error("Failed to mark as delivered:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleAccept = async (id: string) => {
    try {
      setActionLoading(id);
      await acceptRequirement(id, token);
      onUpdate();
    } catch (error) {
      console.error("Failed to accept:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!rejectFeedback.trim()) return;

    try {
      setActionLoading(id);
      await rejectRequirement(id, rejectFeedback, token);
      setRejectingId(null);
      setRejectFeedback("");
      onUpdate();
    } catch (error) {
      console.error("Failed to reject:", error);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="border-2 border-white">
      {/* Header with Progress */}
      <div className="border-b border-white/30 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold tracking-wider">REQUIREMENTS</h3>
          <span className="text-xs text-white/50">
            {completed} / {total} completed
          </span>
        </div>
        {/* Progress Bar */}
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-400 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Requirements List */}
      <div className="divide-y divide-white/10">
        {requirements.map((req, index) => {
          const StatusIcon = STATUS_CONFIG[req.status].icon;
          const statusColor = STATUS_CONFIG[req.status].color;

          return (
            <div
              key={req.id}
              className={`p-4 ${
                req.status === "accepted" ? "bg-green-400/5" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Status Icon */}
                <div className={`mt-0.5 ${statusColor}`}>
                  <StatusIcon className="h-5 w-5" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-white/50">
                      #{index + 1}
                    </span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        PRIORITY_COLORS[req.priority]?.replace("border-", "bg-")
                      }`}
                    />
                    <span className={`text-[10px] uppercase ${statusColor}`}>
                      {STATUS_CONFIG[req.status].label}
                    </span>
                  </div>

                  <h4
                    className={`font-medium mb-1 ${
                      req.status === "accepted" ? "line-through text-white/50" : ""
                    }`}
                  >
                    {req.title}
                  </h4>

                  {req.description && (
                    <p className="text-sm text-white/70 mb-2">{req.description}</p>
                  )}

                  {req.acceptance_criteria && (
                    <div className="text-xs text-white/50 border-l-2 border-white/20 pl-2 mb-2">
                      <span className="font-bold">Acceptance:</span>{" "}
                      {req.acceptance_criteria}
                    </div>
                  )}

                  {/* Rejection Feedback */}
                  {req.status === "rejected" && req.rejection_feedback && (
                    <div className="text-xs text-red-400 bg-red-400/10 p-2 mt-2 flex items-start gap-2">
                      <MessageSquare className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>{req.rejection_feedback}</span>
                    </div>
                  )}

                  {/* Reject Input Form */}
                  {rejectingId === req.id && (
                    <div className="mt-3 space-y-2">
                      <textarea
                        value={rejectFeedback}
                        onChange={(e) => setRejectFeedback(e.target.value)}
                        placeholder="What needs to be changed?"
                        className="w-full bg-black border-2 border-red-400 px-3 py-2 text-sm focus:outline-none h-20 resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReject(req.id)}
                          disabled={!rejectFeedback.trim() || actionLoading === req.id}
                          className="border-2 border-red-400 text-red-400 px-3 py-1 text-xs hover:bg-red-400 hover:text-black transition-colors disabled:opacity-50 flex items-center gap-1"
                        >
                          {actionLoading === req.id && (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          )}
                          Submit Feedback
                        </button>
                        <button
                          onClick={() => {
                            setRejectingId(null);
                            setRejectFeedback("");
                          }}
                          className="border-2 border-white/50 text-white/50 px-3 py-1 text-xs hover:border-white hover:text-white transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {actionLoading !== req.id && rejectingId !== req.id && (
                  <div className="flex gap-2 flex-shrink-0">
                    {/* Agent can mark as delivered */}
                    {userType === "agent" &&
                      (req.status === "pending" ||
                        req.status === "in_progress" ||
                        req.status === "rejected") && (
                        <button
                          onClick={() => handleDeliver(req.id)}
                          className="border-2 border-blue-400 text-blue-400 px-3 py-1 text-xs hover:bg-blue-400 hover:text-black transition-colors"
                        >
                          Mark Delivered
                        </button>
                      )}

                    {/* Client can accept/reject delivered requirements */}
                    {userType === "client" && req.status === "delivered" && (
                      <>
                        <button
                          onClick={() => handleAccept(req.id)}
                          className="border-2 border-green-400 text-green-400 px-3 py-1 text-xs hover:bg-green-400 hover:text-black transition-colors"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => setRejectingId(req.id)}
                          className="border-2 border-red-400 text-red-400 px-3 py-1 text-xs hover:bg-red-400 hover:text-black transition-colors"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                )}

                {actionLoading === req.id && (
                  <Loader2 className="h-5 w-5 animate-spin text-white/50" />
                )}
              </div>
            </div>
          );
        })}

        {requirements.length === 0 && (
          <div className="p-8 text-center text-white/50 text-sm">
            No requirements defined for this job.
          </div>
        )}
      </div>
    </div>
  );
}
