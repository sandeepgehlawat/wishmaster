"use client";

import { useState, useEffect } from "react";
import { Loader2, Briefcase } from "lucide-react";
import { getServices } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import ServiceCard from "@/components/service-card";
import type { ManagedService } from "@/lib/types";

export default function ServicesPage() {
  const { token, userType } = useAuthStore();
  const [services, setServices] = useState<ManagedService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "pending" | "paused">("all");

  useEffect(() => {
    if (token) {
      fetchServices();
    }
  }, [token]);

  const fetchServices = async () => {
    if (!token) return;

    try {
      setLoading(true);
      const response = await getServices(token);
      setServices(response.services);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load services");
    } finally {
      setLoading(false);
    }
  };

  const filteredServices = services.filter((s) => {
    if (filter === "all") return true;
    return s.status === filter;
  });

  const statusCounts = {
    all: services.length,
    active: services.filter((s) => s.status === "active").length,
    pending: services.filter((s) => s.status === "pending").length,
    paused: services.filter((s) => s.status === "paused").length,
  };

  if (!token) {
    return (
      <div className="p-8 text-center text-neutral-500 font-mono">
        Please connect your wallet to view services.
      </div>
    );
  }

  return (
    <div className="space-y-6 font-mono">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Briefcase className="h-4 w-4 text-secondary-400" />
            <h1 className="text-xl md:text-2xl font-bold tracking-wider">
              MANAGED SERVICES
            </h1>
          </div>
          <p className="text-neutral-500 text-sm">
            {userType === "client"
              ? "Services you subscribe to"
              : "Services you manage"}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mb-1 scrollbar-none">
        {(["all", "active", "pending", "paused"] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 text-sm border transition-colors whitespace-nowrap flex-shrink-0 ${
              filter === status
                ? "border-secondary-500/30 bg-secondary-500/10 text-secondary-400"
                : "border-neutral-700/40 text-neutral-400 hover:border-neutral-500 hover:text-white"
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            <span className="ml-2 text-xs text-neutral-500">({statusCounts[status]})</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="border border-neutral-700/40 bg-[#1a1a1f] p-12">
          <div className="flex items-center justify-center gap-2 text-neutral-400">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-sm">Loading services...</span>
          </div>
        </div>
      ) : error ? (
        <div className="border border-red-500/30 bg-red-500/5 p-6 text-red-400 text-center text-sm">
          {error}
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="border border-neutral-700/40 bg-[#1a1a1f] p-8 sm:p-12 text-center">
          <Briefcase className="h-12 w-12 mx-auto mb-4 text-neutral-600" />
          <h2 className="text-lg font-bold mb-2">No Services Found</h2>
          <p className="text-neutral-500 text-sm mb-6">
            {filter === "all"
              ? userType === "client"
                ? "You haven't subscribed to any managed services yet."
                : "You don't have any managed services yet."
              : `No ${filter} services.`}
          </p>
          {userType === "client" && filter === "all" && (
            <p className="text-xs text-neutral-600">
              Complete a job and offer ongoing management to the agent.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredServices.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              userType={(userType || "client") as "client" | "agent"}
            />
          ))}
        </div>
      )}

      {/* Stats Footer */}
      {services.length > 0 && (
        <div className="mt-8 border-t border-neutral-700/40 pt-4 flex flex-wrap gap-4 sm:gap-6 text-xs text-neutral-500">
          <div>
            <span className="text-white font-bold">{statusCounts.active}</span> active
          </div>
          <div>
            <span className="text-white font-bold">{statusCounts.pending}</span> pending
          </div>
          <div>
            <span className="text-secondary-400 font-bold">
              ${services
                .filter((s) => s.status === "active")
                .reduce((sum, s) => sum + s.monthly_rate_usd, 0)
                .toFixed(2)}
            </span>{" "}
            /month {userType === "client" ? "spent" : "earned"}
          </div>
        </div>
      )}
    </div>
  );
}
