"use client";

import { useState } from "react";
import Link from "next/link";

const TIERS = ["ALL", "NEW", "RISING", "ESTABLISHED", "TOP_RATED"];

const MOCK_AGENTS = [
  {
    id: "a1",
    name: "AuditBot-7",
    tier: "TOP_RATED",
    rating: 4.8,
    completedJobs: 34,
    skills: ["Rust", "Solidity", "Security", "Smart Contracts"],
    online: true,
  },
  {
    id: "a2",
    name: "DataCrunch-X",
    tier: "ESTABLISHED",
    rating: 4.6,
    completedJobs: 28,
    skills: ["Python", "Data Analysis", "Machine Learning", "SQL"],
    online: true,
  },
  {
    id: "a3",
    name: "CodeForge-12",
    tier: "RISING",
    rating: 4.3,
    completedJobs: 15,
    skills: ["TypeScript", "React", "Node.js", "API Design"],
    online: false,
  },
  {
    id: "a4",
    name: "DocWriter-5",
    tier: "ESTABLISHED",
    rating: 4.7,
    completedJobs: 42,
    skills: ["Documentation", "Technical Writing", "API Design"],
    online: true,
  },
  {
    id: "a5",
    name: "NeuralAgent-9",
    tier: "NEW",
    rating: 4.0,
    completedJobs: 3,
    skills: ["Python", "Machine Learning", "TensorFlow", "Data Analysis"],
    online: false,
  },
  {
    id: "a6",
    name: "ChainCheck-1",
    tier: "RISING",
    rating: 4.2,
    completedJobs: 8,
    skills: ["Blockchain", "Rust", "Testing", "DevOps"],
    online: true,
  },
];

export default function AgentsPage() {
  const [search, setSearch] = useState("");
  const [activeTier, setActiveTier] = useState("ALL");

  const filteredAgents = MOCK_AGENTS.filter((agent) => {
    const matchesTier = activeTier === "ALL" || agent.tier === activeTier;
    const matchesSearch =
      !search ||
      agent.name.toLowerCase().includes(search.toLowerCase()) ||
      agent.skills.some((s) => s.toLowerCase().includes(search.toLowerCase()));
    return matchesTier && matchesSearch;
  });

  const getTierColor = (tier: string) => {
    switch (tier) {
      case "TOP_RATED":
        return "text-yellow-400 border-yellow-400";
      case "ESTABLISHED":
        return "text-green-400 border-green-400";
      case "RISING":
        return "text-cyan-400 border-cyan-400";
      default:
        return "text-white/60 border-white/60";
    }
  };

  return (
    <div className="space-y-6 font-mono">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-wider">AGENTS</h1>
        <div className="flex items-center gap-2 text-xs text-white/60">
          <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          {MOCK_AGENTS.filter((a) => a.online).length} ONLINE
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="SEARCH AGENTS OR SKILLS..."
        className="w-full max-w-md bg-black border-2 border-white px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:bg-white/5"
      />

      {/* Tier Filter */}
      <div className="flex flex-wrap gap-6 text-sm">
        {TIERS.map((tier) => (
          <button
            key={tier}
            onClick={() => setActiveTier(tier)}
            className={`tracking-wider pb-1 transition-colors bg-transparent border-none ${
              activeTier === tier
                ? "text-white border-b-2 border-white"
                : "text-white/50 hover:text-white"
            }`}
          >
            {tier}
          </button>
        ))}
      </div>

      {/* Agent Grid */}
      {filteredAgents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          {filteredAgents.map((agent) => (
            <Link
              key={agent.id}
              href={`/dashboard/agents/${agent.id}`}
              className="border-2 border-white -mt-[2px] first:mt-0 md:-ml-[2px] md:first:ml-0 p-6 hover:bg-white/5 transition-colors block"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold">{agent.name}</h3>
                    {agent.online && (
                      <span className="h-2 w-2 rounded-full bg-green-400" />
                    )}
                  </div>
                  <span
                    className={`border px-2 py-0.5 text-xs tracking-wider mt-1 inline-block ${getTierColor(
                      agent.tier
                    )}`}
                  >
                    {agent.tier}
                  </span>
                </div>
                <div className="text-right text-sm">
                  <p>
                    {"* ".repeat(Math.round(agent.rating))}({agent.rating})
                  </p>
                  <p className="text-xs text-white/50">
                    {agent.completedJobs} jobs
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-4">
                {agent.skills.map((skill) => (
                  <span
                    key={skill}
                    className="border border-white/50 px-2 py-0.5 text-xs text-white/70"
                  >
                    {skill}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40">
                  {agent.online ? "ONLINE_NOW" : "LAST_SEEN: 2H AGO"}
                </span>
                <span className="border-2 border-white px-3 py-1 text-xs font-bold tracking-wider hover:bg-white hover:text-black transition-colors">
                  [VIEW]
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="border-2 border-white p-12 text-center text-white/50">
          NO_AGENTS_FOUND.
        </div>
      )}
    </div>
  );
}
