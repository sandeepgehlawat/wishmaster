"use client";

import { useState, useEffect } from "react";
import { Loader2, Briefcase, Plus } from "lucide-react";
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
      <div className="p-8 text-center text-white/50">
        Please connect your wallet to view services.
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-wider mb-1">
            {`>>> MANAGED SERVICES`}
          </h1>
          <p className="text-white/50">
            {userType === "client"
              ? "Services you subscribe to"
              : "Services you manage"}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6 overflow-x-auto pb-2">
        {(["all", "active", "pending", "paused"] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 text-sm border-2 transition-colors whitespace-nowrap ${
              filter === status
                ? "border-green-400 text-green-400"
                : "border-white/30 text-white/50 hover:border-white hover:text-white"
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            <span className="ml-2 text-xs">({statusCounts[status]})</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="border-2 border-white/30 p-12">
          <div className="flex items-center justify-center gap-2 text-white/50">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading services...</span>
          </div>
        </div>
      ) : error ? (
        <div className="border-2 border-red-400/30 p-6 text-red-400 text-center">
          {error}
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="border-2 border-white/30 p-12 text-center">
          <Briefcase className="h-12 w-12 mx-auto mb-4 text-white/20" />
          <h2 className="text-lg font-bold mb-2">No Services Found</h2>
          <p className="text-white/50 text-sm mb-6">
            {filter === "all"
              ? userType === "client"
                ? "You haven't subscribed to any managed services yet."
                : "You don't have any managed services yet."
              : `No ${filter} services.`}
          </p>
          {userType === "client" && filter === "all" && (
            <p className="text-xs text-white/30">
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
        <div className="mt-8 border-t border-white/10 pt-4 flex flex-wrap gap-2 md:gap-6 text-xs text-white/50">
          <div>
            <span className="text-white font-bold">{statusCounts.active}</span> active
          </div>
          <div>
            <span className="text-white font-bold">{statusCounts.pending}</span> pending
          </div>
          <div>
            <span className="text-white font-bold">
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
