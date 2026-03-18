"use client";

import { useState } from "react";
import { X, Loader2, DollarSign, Briefcase, AlertTriangle } from "lucide-react";
import { convertToService } from "@/lib/api";
import type { CreateManagedServiceInput, JobWithDetails } from "@/lib/types";

interface ConvertToServiceModalProps {
  job: JobWithDetails;
  token: string;
  onClose: () => void;
  onSuccess: (serviceId: string) => void;
}

export default function ConvertToServiceModal({
  job,
  token,
  onClose,
  onSuccess,
}: ConvertToServiceModalProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CreateManagedServiceInput>({
    name: `${job.title} - Ongoing Management`,
    description: `Ongoing management and maintenance for ${job.title}`,
    monthly_rate_usd: Math.round((job.final_price || job.budget_min) * 0.2), // Suggest 20% of job price
  });

  const handleSubmit = async () => {
    if (!data.name.trim() || data.monthly_rate_usd <= 0) return;
    if (!job.agent_id) return;

    try {
      setSaving(true);
      setError(null);
      const service = await convertToService(job.id, job.agent_id, data, token);
      onSuccess(service.id);
    } catch (err: any) {
      setError(err.message || "Failed to create service");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-black border-2 border-white max-w-lg w-full">
        {/* Header */}
        <div className="border-b border-white/30 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-green-400" />
            <h2 className="font-bold tracking-wider">CONVERT TO MANAGED SERVICE</h2>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Info Box */}
          <div className="bg-green-400/10 border border-green-400/30 p-3 text-sm">
            <p className="text-green-400 font-bold mb-1">What is a Managed Service?</p>
            <p className="text-white/70">
              Turn this completed job into an ongoing service. The agent will manage
              your product with regular updates, fixes, and improvements. You approve
              all changes before they go live.
            </p>
          </div>

          {/* Agent Info */}
          <div className="border border-white/30 p-3 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-400/20 flex items-center justify-center">
              <span className="text-blue-400 font-bold">
                {job.agent_name?.charAt(0) || "A"}
              </span>
            </div>
            <div>
              <p className="font-medium">{job.agent_name}</p>
              <p className="text-xs text-white/50">Will manage your service</p>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-3">
            <div>
              <label className="text-xs text-white/50 uppercase mb-1 block">
                Service Name
              </label>
              <input
                type="text"
                value={data.name}
                onChange={(e) => setData({ ...data, name: e.target.value })}
                className="w-full bg-black border-2 border-white px-3 py-2 text-sm focus:outline-none focus:border-green-400"
              />
            </div>

            <div>
              <label className="text-xs text-white/50 uppercase mb-1 block">
                Description
              </label>
              <textarea
                value={data.description || ""}
                onChange={(e) => setData({ ...data, description: e.target.value })}
                className="w-full bg-black border-2 border-white px-3 py-2 text-sm focus:outline-none focus:border-green-400 h-20 resize-none"
              />
            </div>

            <div>
              <label className="text-xs text-white/50 uppercase mb-1 block">
                Monthly Rate (USD)
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
                <input
                  type="number"
                  min="1"
                  value={data.monthly_rate_usd}
                  onChange={(e) =>
                    setData({ ...data, monthly_rate_usd: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full bg-black border-2 border-white pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-green-400"
                />
              </div>
              <p className="text-[10px] text-white/30 mt-1">
                The agent will receive this amount each month
              </p>
            </div>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 text-xs text-yellow-400">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <p>
              The agent must accept this offer before the service starts.
              First month will be billed when they accept.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-400/10 border border-red-400/30 p-2 text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/30 px-4 py-3 flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="border-2 border-white/50 text-white/50 px-4 py-2 text-sm hover:border-white hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!data.name.trim() || data.monthly_rate_usd <= 0 || saving}
            className="border-2 border-green-400 text-green-400 px-4 py-2 text-sm hover:bg-green-400 hover:text-black transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Service Offer
          </button>
        </div>
      </div>
    </div>
  );
}
