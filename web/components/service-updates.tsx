"use client";

import { useState } from "react";
import {
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  Rocket,
  Loader2,
  MessageSquare,
  FileText,
  Wrench,
  Shield,
  Sparkles,
  ArrowUp,
} from "lucide-react";
import {
  createServiceUpdate,
  approveServiceUpdate,
  rejectServiceUpdate,
  deployServiceUpdate,
} from "@/lib/api";
import type {
  ServiceUpdate,
  CreateServiceUpdateInput,
  UpdateChangeType,
  UpdateStatus,
} from "@/lib/types";

interface ServiceUpdatesProps {
  serviceId: string;
  updates: ServiceUpdate[];
  token: string;
  userType: "client" | "agent";
  serviceStatus: string;
  onUpdate: () => void;
}

const STATUS_CONFIG: Record<
  UpdateStatus,
  { icon: React.ElementType; color: string; label: string }
> = {
  pending: { icon: Clock, color: "text-yellow-400", label: "Pending Review" },
  approved: { icon: CheckCircle2, color: "text-blue-400", label: "Approved" },
  rejected: { icon: XCircle, color: "text-red-400", label: "Rejected" },
  deployed: { icon: Rocket, color: "text-green-400", label: "Deployed" },
};

const CHANGE_TYPE_CONFIG: Record<
  UpdateChangeType,
  { icon: React.ElementType; color: string; label: string }
> = {
  feature: { icon: Sparkles, color: "text-purple-400", label: "Feature" },
  fix: { icon: Wrench, color: "text-orange-400", label: "Fix" },
  upgrade: { icon: ArrowUp, color: "text-blue-400", label: "Upgrade" },
  security: { icon: Shield, color: "text-red-400", label: "Security" },
  other: { icon: FileText, color: "text-white/50", label: "Other" },
};

export default function ServiceUpdates({
  serviceId,
  updates,
  token,
  userType,
  serviceStatus,
  onUpdate,
}: ServiceUpdatesProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectFeedback, setRejectFeedback] = useState("");

  const pendingCount = updates.filter((u) => u.status === "pending").length;
  const canAddUpdate = userType === "agent" && serviceStatus === "active";

  const handleApprove = async (id: string) => {
    try {
      setActionLoading(id);
      await approveServiceUpdate(id, token);
      onUpdate();
    } catch (error) {
      console.error("Failed to approve:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!rejectFeedback.trim()) return;

    try {
      setActionLoading(id);
      await rejectServiceUpdate(id, rejectFeedback, token);
      setRejectingId(null);
      setRejectFeedback("");
      onUpdate();
    } catch (error) {
      console.error("Failed to reject:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeploy = async (id: string) => {
    try {
      setActionLoading(id);
      await deployServiceUpdate(id, token);
      onUpdate();
    } catch (error) {
      console.error("Failed to deploy:", error);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="border-2 border-white">
      {/* Header */}
      <div className="border-b border-white/30 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold tracking-wider">UPDATES</h3>
          {pendingCount > 0 && (
            <span className="bg-yellow-400 text-black text-[10px] px-1.5 py-0.5 font-bold">
              {pendingCount} PENDING
            </span>
          )}
        </div>
        <span className="text-xs text-white/50">{updates.length} total</span>
      </div>

      {/* Updates List */}
      <div className="divide-y divide-white/10 max-h-96 overflow-y-auto">
        {updates.map((update) => {
          const statusConfig = STATUS_CONFIG[update.status];
          const StatusIcon = statusConfig.icon;
          const changeConfig = update.change_type
            ? CHANGE_TYPE_CONFIG[update.change_type]
            : null;

          return (
            <div
              key={update.id}
              className={`p-4 ${
                update.status === "deployed" ? "bg-green-400/5" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Status Icon */}
                <div className={`mt-0.5 ${statusConfig.color}`}>
                  <StatusIcon className="h-5 w-5" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span
                      className={`text-[10px] uppercase ${statusConfig.color}`}
                    >
                      {statusConfig.label}
                    </span>
                    {changeConfig && (
                      <span
                        className={`text-[10px] uppercase border px-1 ${changeConfig.color} ${changeConfig.color.replace(
                          "text-",
                          "border-"
                        )}`}
                      >
                        {changeConfig.label}
                      </span>
                    )}
                  </div>

                  <h4 className="font-medium mb-1">{update.title}</h4>

                  {update.description && (
                    <p className="text-sm text-white/70 mb-2">
                      {update.description}
                    </p>
                  )}

                  {/* Client Feedback */}
                  {update.client_feedback && update.status === "rejected" && (
                    <div className="text-xs text-red-400 bg-red-400/10 p-2 mt-2 flex items-start gap-2">
                      <MessageSquare className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>{update.client_feedback}</span>
                    </div>
                  )}

                  {/* Reject Input Form */}
                  {rejectingId === update.id && (
                    <div className="mt-3 space-y-2">
                      <textarea
                        value={rejectFeedback}
                        onChange={(e) => setRejectFeedback(e.target.value)}
                        placeholder="What needs to be changed?"
                        className="w-full bg-black border-2 border-red-400 px-3 py-2 text-sm focus:outline-none h-20 resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReject(update.id)}
                          disabled={
                            !rejectFeedback.trim() || actionLoading === update.id
                          }
                          className="border-2 border-red-400 text-red-400 px-3 py-1 text-xs hover:bg-red-400 hover:text-black transition-colors disabled:opacity-50 flex items-center gap-1"
                        >
                          {actionLoading === update.id && (
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

                  {/* Timestamp */}
                  <div className="text-[10px] text-white/30 mt-2">
                    {new Date(update.created_at).toLocaleDateString()}
                    {update.deployed_at && (
                      <span>
                        {" "}
                        • Deployed {new Date(update.deployed_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {actionLoading !== update.id && rejectingId !== update.id && (
                  <div className="flex gap-2 flex-shrink-0">
                    {/* Client can approve/reject pending updates */}
                    {userType === "client" && update.status === "pending" && (
                      <>
                        <button
                          onClick={() => handleApprove(update.id)}
                          className="border-2 border-green-400 text-green-400 px-3 py-1 text-xs hover:bg-green-400 hover:text-black transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => setRejectingId(update.id)}
                          className="border-2 border-red-400 text-red-400 px-3 py-1 text-xs hover:bg-red-400 hover:text-black transition-colors"
                        >
                          Reject
                        </button>
                      </>
                    )}

                    {/* Agent can deploy approved updates */}
                    {userType === "agent" && update.status === "approved" && (
                      <button
                        onClick={() => handleDeploy(update.id)}
                        className="border-2 border-green-400 text-green-400 px-3 py-1 text-xs hover:bg-green-400 hover:text-black transition-colors flex items-center gap-1"
                      >
                        <Rocket className="h-3 w-3" />
                        Deploy
                      </button>
                    )}
                  </div>
                )}

                {actionLoading === update.id && (
                  <Loader2 className="h-5 w-5 animate-spin text-white/50" />
                )}
              </div>
            </div>
          );
        })}

        {updates.length === 0 && !isAdding && (
          <div className="p-8 text-center text-white/50 text-sm">
            No updates yet
          </div>
        )}
      </div>

      {/* Add Update Form (Agent only) */}
      {canAddUpdate && (
        <>
          {isAdding ? (
            <AddUpdateForm
              serviceId={serviceId}
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
              Push Update
            </button>
          )}
        </>
      )}
    </div>
  );
}

function AddUpdateForm({
  serviceId,
  token,
  onSubmit,
  onCancel,
}: {
  serviceId: string;
  token: string;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<CreateServiceUpdateInput>({
    title: "",
    description: "",
    change_type: "feature",
    file_url: "",
    file_name: "",
  });

  const handleSubmit = async () => {
    if (!data.title.trim()) return;

    try {
      setSaving(true);
      await createServiceUpdate(serviceId, data, token);
      onSubmit();
    } catch (error) {
      console.error("Failed to create update:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 border-t border-white/30 bg-white/5 space-y-3">
      <input
        type="text"
        placeholder="Update title..."
        value={data.title}
        onChange={(e) => setData({ ...data, title: e.target.value })}
        className="w-full bg-black border-2 border-white px-3 py-2 text-sm focus:outline-none focus:border-green-400"
      />

      <textarea
        placeholder="Description..."
        value={data.description || ""}
        onChange={(e) => setData({ ...data, description: e.target.value })}
        className="w-full bg-black border-2 border-white px-3 py-2 text-sm focus:outline-none focus:border-green-400 h-20 resize-none"
      />

      <select
        value={data.change_type || "feature"}
        onChange={(e) =>
          setData({ ...data, change_type: e.target.value as UpdateChangeType })
        }
        className="bg-black border-2 border-white px-3 py-2 text-sm focus:outline-none focus:border-green-400"
      >
        <option value="feature">Feature</option>
        <option value="fix">Fix</option>
        <option value="upgrade">Upgrade</option>
        <option value="security">Security</option>
        <option value="other">Other</option>
      </select>

      <input
        type="text"
        placeholder="File/artifact URL (optional)..."
        value={data.file_url || ""}
        onChange={(e) => setData({ ...data, file_url: e.target.value })}
        className="w-full bg-black border-2 border-white px-3 py-2 text-sm focus:outline-none focus:border-green-400"
      />

      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={!data.title.trim() || saving}
          className="border-2 border-green-400 text-green-400 px-4 py-2 text-sm hover:bg-green-400 hover:text-black transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Submit for Review
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
