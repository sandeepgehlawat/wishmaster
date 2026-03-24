"use client";

import { CheckCircle2, Circle, Clock, AlertCircle } from "lucide-react";
import type { Requirement } from "@/lib/types";

interface ProgressBarProps {
  requirements: Requirement[];
}

export default function ProgressBar({ requirements }: ProgressBarProps) {
  const total = requirements.length;
  const accepted = requirements.filter((r) => r.status === "accepted").length;
  const delivered = requirements.filter((r) => r.status === "delivered").length;
  const inProgress = requirements.filter((r) => r.status === "in_progress").length;
  const rejected = requirements.filter((r) => r.status === "rejected").length;
  const pending = requirements.filter((r) => r.status === "pending").length;

  const progress = total > 0 ? (accepted / total) * 100 : 0;

  const stats = [
    { label: "Accepted", count: accepted, color: "text-secondary-400", icon: CheckCircle2 },
    { label: "Delivered", count: delivered, color: "text-blue-400", icon: Clock },
    { label: "In Progress", count: inProgress, color: "text-yellow-400", icon: Clock },
    { label: "Rejected", count: rejected, color: "text-red-400", icon: AlertCircle },
    { label: "Pending", count: pending, color: "text-white/50", icon: Circle },
  ].filter((s) => s.count > 0);

  if (total === 0) {
    return (
      <div className="border-2 border-white/30 p-4 text-center text-white/50 text-sm">
        No requirements defined
      </div>
    );
  }

  return (
    <div className="border-2 border-white p-4">
      {/* Main Progress */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold tracking-wider">PROGRESS</span>
        <span className="text-lg font-bold text-secondary-400">
          {Math.round(progress)}%
        </span>
      </div>

      {/* Progress Bar */}
      <div className="h-3 bg-white/10 rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-gradient-to-r from-green-600 to-secondary-400 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-4">
        {stats.map(({ label, count, color, icon: Icon }) => (
          <div key={label} className="flex items-center gap-1.5">
            <Icon className={`h-4 w-4 ${color}`} />
            <span className="text-xs">
              <span className={`font-bold ${color}`}>{count}</span>
              <span className="text-white/50 ml-1">{label}</span>
            </span>
          </div>
        ))}
      </div>

      {/* Completion Message */}
      {accepted === total && total > 0 && (
        <div className="mt-4 p-2 bg-secondary-400/10 border border-secondary-400/30 text-secondary-400 text-sm text-center">
          All requirements completed!
        </div>
      )}
    </div>
  );
}
