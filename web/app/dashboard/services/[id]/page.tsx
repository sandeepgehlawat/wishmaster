"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  ArrowLeft,
  Play,
  Pause,
  XCircle,
  DollarSign,
  Calendar,
  User,
  Briefcase,
  CheckCircle2,
  Clock,
} from "lucide-react";
import {
  getService,
  getServiceUpdates,
  getServiceBilling,
  acceptService,
  pauseService,
  resumeService,
  cancelService,
} from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import ServiceUpdates from "@/components/service-updates";
import type {
  ManagedService,
  ServiceUpdate,
  ServiceBilling,
  ServiceStatus,
} from "@/lib/types";

const STATUS_CONFIG: Record<
  ServiceStatus,
  { icon: React.ElementType; color: string; bgColor: string; label: string }
> = {
  pending: {
    icon: Clock,
    color: "text-yellow-400",
    bgColor: "bg-yellow-400/10",
    label: "Pending Acceptance",
  },
  active: {
    icon: Play,
    color: "text-green-400",
    bgColor: "bg-green-400/10",
    label: "Active",
  },
  paused: {
    icon: Pause,
    color: "text-orange-400",
    bgColor: "bg-orange-400/10",
    label: "Paused",
  },
  cancelled: {
    icon: XCircle,
    color: "text-red-400",
    bgColor: "bg-red-400/10",
    label: "Cancelled",
  },
};

export default function ServiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { token, userType, user } = useAuthStore();
  const serviceId = params.id as string;

  const [service, setService] = useState<ManagedService | null>(null);
  const [updates, setUpdates] = useState<ServiceUpdate[]>([]);
  const [billing, setBilling] = useState<ServiceBilling[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token && serviceId) {
      fetchData();
    }
  }, [token, serviceId]);

  const fetchData = async () => {
    if (!token) return;

    try {
      setLoading(true);
      const [serviceData, updatesData, billingData] = await Promise.all([
        getService(serviceId, token),
        getServiceUpdates(serviceId, token),
        getServiceBilling(serviceId, token),
      ]);
      setService(serviceData);
      setUpdates(updatesData.updates);
      setBilling(billingData.records);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load service");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!token || !service) return;

    try {
      setActionLoading(true);
      await acceptService(service.id, token);
      fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to accept service");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    if (!token || !service) return;

    try {
      setActionLoading(true);
      await pauseService(service.id, token);
      fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to pause service");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    if (!token || !service) return;

    try {
      setActionLoading(true);
      await resumeService(service.id, token);
      fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to resume service");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!token || !service) return;
    if (!confirm("Are you sure you want to cancel this service?")) return;

    try {
      setActionLoading(true);
      await cancelService(service.id, token);
      fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to cancel service");
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString();
  };

  if (!token) {
    return (
      <div className="p-8 text-center text-white/50">
        Please connect your wallet to view this service.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 font-mono">
        <Loader2 className="h-8 w-8 animate-spin text-white/50" />
        <span className="ml-3 text-white/50">LOADING_SERVICE...</span>
      </div>
    );
  }

  if (error || !service) {
    return (
      <div className="border-2 border-red-400 p-8 text-center font-mono">
        <p className="text-red-400 mb-4">{error || "Service not found"}</p>
        <Link
          href="/dashboard/services"
          className="border-2 border-white px-6 py-3 text-sm font-bold tracking-wider hover:bg-white hover:text-black transition-colors inline-block"
        >
          [BACK TO SERVICES]
        </Link>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[service.status];
  const StatusIcon = statusConfig.icon;
  const isOwner = userType === "client" && service.client_id === user?.id;
  const isAgent = userType === "agent" && service.agent_id === user?.id;
  const totalPaid = billing.filter((b) => b.status === "paid").reduce((sum, b) => sum + b.amount_usd, 0);

  return (
    <div className="space-y-6 font-mono">
      {/* Back Link */}
      <Link
        href="/dashboard/services"
        className="inline-flex items-center gap-2 text-white/50 hover:text-white mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Services
      </Link>

      {/* Header */}
      <div className={`border-2 border-white p-6 mb-6 ${statusConfig.bgColor}`}>
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <StatusIcon className={`h-5 w-5 ${statusConfig.color}`} />
              <span className={`text-sm uppercase ${statusConfig.color}`}>
                {statusConfig.label}
              </span>
            </div>
            <h1 className="text-2xl font-bold mb-2">{service.name}</h1>
            {service.description && (
              <p className="text-white/70">{service.description}</p>
            )}
          </div>

          {/* Monthly Rate */}
          <div className="text-left sm:text-right">
            <div className="flex items-center gap-1 text-green-400 text-2xl">
              <DollarSign className="h-6 w-6" />
              <span className="font-bold">{service.monthly_rate_usd}</span>
            </div>
            <span className="text-xs text-white/50">per month</span>
          </div>
        </div>

        {/* Meta Info */}
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-white/70 border-t border-white/10 pt-4">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-white/50" />
            <span>
              {isOwner ? "Agent: " : "Client: "}
              {isOwner ? service.agent_name : service.client_name}
            </span>
          </div>

          {service.started_at && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-white/50" />
              <span>Started {formatDate(service.started_at)}</span>
            </div>
          )}

          {service.next_billing_at && service.status === "active" && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-white/50" />
              <span>Next billing {formatDate(service.next_billing_at)}</span>
            </div>
          )}

          <Link
            href={`/dashboard/jobs/${service.original_job_id}`}
            className="flex items-center gap-2 text-blue-400 hover:text-blue-300"
          >
            <Briefcase className="h-4 w-4" />
            <span>View Original Job</span>
          </Link>
        </div>
      </div>

      {/* Actions */}
      {!actionLoading && (
        <div className="flex flex-col sm:flex-row gap-2 mb-6">
          {/* Agent can accept pending offers */}
          {isAgent && service.status === "pending" && (
            <button
              onClick={handleAccept}
              className="border-2 border-green-400 text-green-400 px-4 py-2 text-sm hover:bg-green-400 hover:text-black transition-colors flex items-center gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              Accept Service Offer
            </button>
          )}

          {/* Both can pause active services */}
          {service.status === "active" && (
            <button
              onClick={handlePause}
              className="border-2 border-orange-400 text-orange-400 px-4 py-2 text-sm hover:bg-orange-400 hover:text-black transition-colors flex items-center gap-2"
            >
              <Pause className="h-4 w-4" />
              Pause Service
            </button>
          )}

          {/* Both can resume paused services */}
          {service.status === "paused" && (
            <button
              onClick={handleResume}
              className="border-2 border-green-400 text-green-400 px-4 py-2 text-sm hover:bg-green-400 hover:text-black transition-colors flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              Resume Service
            </button>
          )}

          {/* Both can cancel non-cancelled services */}
          {service.status !== "cancelled" && (
            <button
              onClick={handleCancel}
              className="border-2 border-red-400 text-red-400 px-4 py-2 text-sm hover:bg-red-400 hover:text-black transition-colors flex items-center gap-2"
            >
              <XCircle className="h-4 w-4" />
              Cancel Service
            </button>
          )}
        </div>
      )}

      {actionLoading && (
        <div className="flex items-center gap-2 text-white/50 mb-6">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Processing...</span>
        </div>
      )}

      {/* Updates Section */}
      <div className="mb-6">
        <ServiceUpdates
          serviceId={serviceId}
          updates={updates}
          token={token}
          userType={(userType || "client") as "client" | "agent"}
          serviceStatus={service.status}
          onUpdate={fetchData}
        />
      </div>

      {/* Billing History */}
      <div className="border-2 border-white overflow-x-auto">
        <div className="border-b border-white/30 px-4 py-3 flex items-center justify-between">
          <h3 className="text-sm font-bold tracking-wider">BILLING HISTORY</h3>
          <span className="text-xs text-white/50">
            ${totalPaid.toFixed(2)} total paid
          </span>
        </div>

        {billing.length === 0 ? (
          <div className="p-8 text-center text-white/50 text-sm">
            No billing records yet
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {billing.map((record) => (
              <div key={record.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] uppercase ${
                        record.status === "paid"
                          ? "text-green-400"
                          : record.status === "pending"
                          ? "text-yellow-400"
                          : "text-red-400"
                      }`}
                    >
                      {record.status}
                    </span>
                  </div>
                  <span className="text-sm text-white/70">
                    {formatDate(record.period_start)} — {formatDate(record.period_end)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-bold">${record.amount_usd}</span>
                  {record.paid_at && (
                    <div className="text-[10px] text-white/30">
                      Paid {formatDate(record.paid_at)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
