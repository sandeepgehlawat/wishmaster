"use client";

import { useState, useEffect } from "react";
import {
  Loader2,
  FileText,
  CheckCircle2,
  XCircle,
  Send,
  MessageSquare,
  Briefcase,
  DollarSign,
  User,
  Clock,
} from "lucide-react";
import { getActivities } from "@/lib/api";
import type { Activity } from "@/lib/types";

interface ActivityFeedProps {
  jobId: string;
  token: string;
}

const ACTION_CONFIG: Record<
  string,
  { icon: React.ElementType; color: string; label: string }
> = {
  job_created: { icon: Briefcase, color: "text-blue-400", label: "Job created" },
  job_published: { icon: Briefcase, color: "text-green-400", label: "Job published" },
  job_cancelled: { icon: XCircle, color: "text-red-400", label: "Job cancelled" },
  job_completed: { icon: CheckCircle2, color: "text-green-400", label: "Job completed" },
  bid_submitted: { icon: DollarSign, color: "text-yellow-400", label: "Bid submitted" },
  bid_accepted: { icon: CheckCircle2, color: "text-green-400", label: "Bid accepted" },
  bid_rejected: { icon: XCircle, color: "text-red-400", label: "Bid rejected" },
  bid_withdrawn: { icon: XCircle, color: "text-white/50", label: "Bid withdrawn" },
  requirement_added: { icon: FileText, color: "text-blue-400", label: "Requirement added" },
  requirement_updated: { icon: FileText, color: "text-yellow-400", label: "Requirement updated" },
  requirement_delivered: { icon: Send, color: "text-blue-400", label: "Requirement delivered" },
  requirement_accepted: { icon: CheckCircle2, color: "text-green-400", label: "Requirement accepted" },
  requirement_rejected: { icon: XCircle, color: "text-red-400", label: "Requirement rejected" },
  deliverable_submitted: { icon: FileText, color: "text-blue-400", label: "Deliverable submitted" },
  deliverable_approved: { icon: CheckCircle2, color: "text-green-400", label: "Deliverable approved" },
  deliverable_changes_requested: { icon: XCircle, color: "text-red-400", label: "Changes requested" },
  message_sent: { icon: MessageSquare, color: "text-white/50", label: "Message sent" },
  escrow_funded: { icon: DollarSign, color: "text-green-400", label: "Escrow funded" },
  escrow_released: { icon: DollarSign, color: "text-green-400", label: "Escrow released" },
};

export default function ActivityFeed({ jobId, token }: ActivityFeedProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchActivities();
  }, [jobId, token]);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const response = await getActivities(jobId, token);
      setActivities(response.activities);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load activity");
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    // Less than a minute
    if (diff < 60000) return "Just now";
    // Less than an hour
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    // Less than a day
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    // Less than a week
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;

    return date.toLocaleDateString();
  };

  const getActionDetails = (activity: Activity): string | null => {
    const details = activity.details;
    if (!details || Object.keys(details).length === 0) return null;

    if (details.title) return `"${details.title}"`;
    if (details.amount) return `$${details.amount}`;
    if (details.agent_name) return details.agent_name as string;

    return null;
  };

  if (loading) {
    return (
      <div className="border-2 border-white p-8">
        <div className="flex items-center justify-center gap-2 text-white/50">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading activity...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border-2 border-red-400/30 p-4 text-red-400 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="border-2 border-white">
      {/* Header */}
      <div className="border-b border-white/30 px-4 py-3 flex items-center justify-between">
        <h3 className="text-sm font-bold tracking-wider">ACTIVITY</h3>
        <span className="text-xs text-white/50">{activities.length} events</span>
      </div>

      {/* Timeline */}
      <div className="max-h-96 overflow-y-auto">
        {activities.length === 0 ? (
          <div className="p-8 text-center text-white/50 text-sm">
            No activity yet
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-6 top-0 bottom-0 w-px bg-white/10" />

            {activities.map((activity, index) => {
              const config = ACTION_CONFIG[activity.action] || {
                icon: Clock,
                color: "text-white/50",
                label: activity.action,
              };
              const Icon = config.icon;
              const details = getActionDetails(activity);

              return (
                <div
                  key={activity.id}
                  className="relative flex items-start gap-3 p-4 hover:bg-white/5"
                >
                  {/* Icon */}
                  <div
                    className={`relative z-10 p-1 bg-black border-2 ${config.color.replace(
                      "text-",
                      "border-"
                    )}`}
                  >
                    <Icon className={`h-3 w-3 ${config.color}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{config.label}</span>
                      {details && (
                        <span className="text-xs text-white/50">{details}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-white/50">
                        {activity.actor_name}
                      </span>
                      <span className="text-[10px] text-white/30">•</span>
                      <span className="text-[10px] text-white/30">
                        {formatTime(activity.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
