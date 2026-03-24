"use client";

import { useState, useEffect } from "react";
import {
  ExternalLink,
  Github,
  Star,
  Loader2,
  Quote,
  Briefcase,
} from "lucide-react";
import { getAgentPortfolio } from "@/lib/api";
import type { PortfolioItem } from "@/lib/types";

interface PortfolioGridProps {
  agentId: string;
  limit?: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  smart_contract: "border-purple-400 text-purple-400",
  frontend: "border-blue-400 text-blue-400",
  backend: "border-secondary-400 text-secondary-400",
  data: "border-yellow-400 text-yellow-400",
  coding: "border-cyan-400 text-cyan-400",
  research: "border-orange-400 text-orange-400",
  content: "border-pink-400 text-pink-400",
  other: "border-white/50 text-white/50",
};

export default function PortfolioGrid({ agentId, limit = 6 }: PortfolioGridProps) {
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPortfolio();
  }, [agentId]);

  const fetchPortfolio = async () => {
    try {
      setLoading(true);
      const response = await getAgentPortfolio(agentId, { limit });
      setItems(response.items);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load portfolio");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="border-2 border-white/30 p-8">
        <div className="flex items-center justify-center gap-2 text-white/50">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading portfolio...</span>
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

  if (items.length === 0) {
    return (
      <div className="border-2 border-white/30 p-8 text-center text-white/50">
        <Briefcase className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No portfolio items yet</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((item) => (
        <PortfolioCard key={item.id} item={item} />
      ))}
    </div>
  );
}

function PortfolioCard({ item }: { item: PortfolioItem }) {
  const categoryClass = CATEGORY_COLORS[item.category || "other"] || CATEGORY_COLORS.other;

  return (
    <div className="border-2 border-white hover:border-secondary-400 transition-colors group">
      {/* Thumbnail */}
      {item.thumbnail_url ? (
        <div className="aspect-video bg-white/5 overflow-hidden">
          <img
            src={item.thumbnail_url}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
        </div>
      ) : (
        <div className="aspect-video bg-white/5 flex items-center justify-center">
          <Briefcase className="h-12 w-12 text-white/20" />
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {/* Category & Featured Badge */}
        <div className="flex items-center gap-2 mb-2">
          {item.category && (
            <span
              className={`text-[10px] uppercase border px-1.5 py-0.5 ${categoryClass}`}
            >
              {item.category}
            </span>
          )}
          {item.is_featured && (
            <span className="text-[10px] uppercase bg-yellow-400 text-black px-1.5 py-0.5 font-bold">
              Featured
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="font-bold mb-1 group-hover:text-secondary-400 transition-colors">
          {item.title}
        </h3>

        {/* Description */}
        {item.description && (
          <p className="text-sm text-white/70 mb-3 line-clamp-2">
            {item.description}
          </p>
        )}

        {/* Rating */}
        {item.client_rating && (
          <div className="flex items-center gap-1 mb-2">
            <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
            <span className="text-sm font-bold">{item.client_rating}</span>
          </div>
        )}

        {/* Testimonial */}
        {item.client_testimonial && (
          <div className="text-xs text-white/50 italic border-l-2 border-white/20 pl-2 mb-3">
            <Quote className="h-3 w-3 inline mr-1 opacity-50" />
            {item.client_testimonial.length > 100
              ? `${item.client_testimonial.slice(0, 100)}...`
              : item.client_testimonial}
          </div>
        )}

        {/* Links */}
        <div className="flex gap-2">
          {item.demo_url && (
            <a
              href={item.demo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-white/30 text-white/70 hover:border-white hover:text-white px-2 py-1 text-xs flex items-center gap-1 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              Demo
            </a>
          )}
          {item.github_url && (
            <a
              href={item.github_url}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-white/30 text-white/70 hover:border-white hover:text-white px-2 py-1 text-xs flex items-center gap-1 transition-colors"
            >
              <Github className="h-3 w-3" />
              Code
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
