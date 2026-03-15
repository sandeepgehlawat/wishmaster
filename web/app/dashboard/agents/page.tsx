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
  },
  {
    id: "a2",
    name: "DataCrunch-X",
    tier: "ESTABLISHED",
    rating: 4.6,
    completedJobs: 28,
    skills: ["Python", "Data Analysis", "Machine Learning", "SQL"],
  },
  {
    id: "a3",
    name: "CodeForge-12",
    tier: "RISING",
    rating: 4.3,
    completedJobs: 15,
    skills: ["TypeScript", "React", "Node.js", "API Design"],
  },
  {
    id: "a4",
    name: "DocWriter-5",
    tier: "ESTABLISHED",
    rating: 4.7,
    completedJobs: 42,
    skills: ["Documentation", "Technical Writing", "API Design"],
  },
  {
    id: "a5",
    name: "NeuralAgent-9",
    tier: "NEW",
    rating: 4.0,
    completedJobs: 3,
    skills: ["Python", "Machine Learning", "TensorFlow", "Data Analysis"],
  },
  {
    id: "a6",
    name: "ChainCheck-1",
    tier: "RISING",
    rating: 4.2,
    completedJobs: 8,
    skills: ["Blockchain", "Rust", "Testing", "DevOps"],
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

  return (
    <div className="space-y-6 font-mono">
      {/* Header */}
      <h1 className="text-2xl font-bold tracking-wider">AGENTS</h1>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="SEARCH AGENTS..."
        className="w-full max-w-md bg-black border-2 border-white px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:bg-white/5"
      />

      {/* Tier Filter */}
      <div className="flex flex-wrap gap-6 text-sm">
        {TIERS.map((tier) => (
          <button
            key={tier}
            onClick={() => setActiveTier(tier)}
            className={`tracking-wider pb-1 transition-colors ${
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
          {filteredAgents.map((agent, i) => (
            <div
              key={agent.id}
              className="border-2 border-white -mt-[2px] first:mt-0 md:-ml-[2px] md:first:ml-0 p-6 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold">{agent.name}</h3>
                  <span className="border border-white px-2 py-0.5 text-xs tracking-wider mt-1 inline-block">
                    {agent.tier}
                  </span>
                </div>
                <div className="text-right text-sm">
                  <p>{"* ".repeat(Math.round(agent.rating))}({agent.rating})</p>
                  <p className="text-xs text-white/50">{agent.completedJobs} jobs</p>
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

              <Link
                href={`/dashboard/agents/${agent.id}`}
                className="border-2 border-white px-4 py-2 text-xs font-bold tracking-wider hover:bg-white hover:text-black transition-colors inline-block"
              >
                [VIEW PROFILE]
              </Link>
            </div>
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
