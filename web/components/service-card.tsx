"use client";

import Link from "next/link";
import {
  Play,
  Pause,
  XCircle,
  Clock,
  DollarSign,
  User,
  Calendar,
} from "lucide-react";
import type { ManagedService, ServiceStatus } from "@/lib/types";

interface ServiceCardProps {
  service: ManagedService;
  userType: "client" | "agent";
}

const STATUS_CONFIG: Record<
  ServiceStatus,
  { icon: React.ElementType; color: string; bgColor: string; label: string }
> = {
  pending: {
    icon: Clock,
    color: "text-yellow-400",
    bgColor: "bg-yellow-400/10",
    label: "Pending",
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

export default function ServiceCard({ service, userType }: ServiceCardProps) {
  const statusConfig = STATUS_CONFIG[service.status];
  const StatusIcon = statusConfig.icon;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <Link href={`/dashboard/services/${service.id}`}>
      <div
        className={`border-2 border-white hover:border-green-400 transition-colors p-4 ${statusConfig.bgColor}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-bold text-lg mb-1">{service.name}</h3>
            <div className="flex items-center gap-2">
              <StatusIcon className={`h-4 w-4 ${statusConfig.color}`} />
              <span className={`text-xs uppercase ${statusConfig.color}`}>
                {statusConfig.label}
              </span>
            </div>
          </div>

          {/* Monthly Rate */}
          <div className="text-right">
            <div className="flex items-center gap-1 text-green-400">
              <DollarSign className="h-4 w-4" />
              <span className="font-bold text-lg">{service.monthly_rate_usd}</span>
            </div>
            <span className="text-[10px] text-white/50">per month</span>
          </div>
        </div>

        {/* Description */}
        {service.description && (
          <p className="text-sm text-white/70 mb-4 line-clamp-2">
            {service.description}
          </p>
        )}

        {/* Meta Info */}
        <div className="flex flex-wrap gap-4 text-xs text-white/50">
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" />
            <span>
              {userType === "client" ? service.agent_name : service.client_name}
            </span>
          </div>

          {service.started_at && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>Started {formatDate(service.started_at)}</span>
            </div>
          )}

          {service.next_billing_at && service.status === "active" && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>Bills {formatDate(service.next_billing_at)}</span>
            </div>
          )}
        </div>

        {/* Job Reference */}
        {service.job_title && (
          <div className="mt-3 pt-3 border-t border-white/10 text-xs text-white/30">
            Based on: {service.job_title}
          </div>
        )}
      </div>
    </Link>
  );
}
