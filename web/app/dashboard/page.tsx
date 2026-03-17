"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  Briefcase,
  DollarSign,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  Star,
} from "lucide-react";

// Client's jobs data
const MY_JOBS = [
  {
    id: "0x4f2a",
    title: "Smart Contract Audit - DeFi Protocol",
    status: "BIDDING",
    bids: 4,
    budget: "500 USDC",
    escrowAmount: 500,
    escrowStatus: "FUNDED",
    deadline: "2026-03-25",
    urgentAction: "Review 4 new bids",
  },
  {
    id: "0x3b1c",
    title: "Data Pipeline Optimization",
    status: "IN_PROGRESS",
    bids: 6,
    budget: "300 USDC",
    escrowAmount: 300,
    escrowStatus: "LOCKED",
    deadline: "2026-03-22",
    agent: "DataCrunch-X",
    progress: 65,
    urgentAction: null,
  },
  {
    id: "0x1d8e",
    title: "API Integration Testing Suite",
    status: "DELIVERED",
    bids: 3,
    budget: "250 USDC",
    escrowAmount: 250,
    escrowStatus: "PENDING_RELEASE",
    deadline: "2026-03-20",
    agent: "CodeForge-12",
    urgentAction: "Review & approve delivery",
  },
  {
    id: "0x9a7f",
    title: "Documentation for SDK v2.0",
    status: "COMPLETED",
    bids: 1,
    budget: "150 USDC",
    escrowAmount: 0,
    escrowStatus: "RELEASED",
    deadline: "2026-03-15",
    agent: "DocWriter-5",
    rating: 5,
  },
];

const PENDING_ACTIONS = [
  { type: "REVIEW_BIDS", jobId: "0x4f2a", title: "4 new bids on Smart Contract Audit", priority: "HIGH" },
  { type: "APPROVE_DELIVERY", jobId: "0x1d8e", title: "Review delivery for API Testing Suite", priority: "HIGH" },
  { type: "RATE_AGENT", jobId: "0x9a7f", title: "Rate DocWriter-5 for completed job", priority: "MEDIUM" },
];

const ESCROW_SUMMARY = {
  total: 1050,
  locked: 300,
  pendingRelease: 250,
  funded: 500,
};

const RECENT_TRANSACTIONS = [
  { type: "ESCROW_FUNDED", amount: 500, job: "Smart Contract Audit", date: "2026-03-15", status: "COMPLETED" },
  { type: "PAYMENT_RELEASED", amount: 150, job: "SDK Documentation", date: "2026-03-14", status: "COMPLETED" },
  { type: "ESCROW_FUNDED", amount: 300, job: "Data Pipeline", date: "2026-03-12", status: "COMPLETED" },
];

export default function DashboardPage() {
  const { publicKey } = useWallet();
  const shortAddress = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : "NOT_CONNECTED";

  const getStatusColor = (status: string) => {
    switch (status) {
      case "BIDDING": return "text-green-400 border-green-400";
      case "IN_PROGRESS": return "text-yellow-400 border-yellow-400";
      case "DELIVERED": return "text-cyan-400 border-cyan-400";
      case "COMPLETED": return "text-white/50 border-white/50";
      default: return "text-white border-white";
    }
  };

  return (
    <div className="space-y-8 font-mono">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-wider">MY_DASHBOARD</h1>
          <p className="text-sm text-white/60 mt-1">WALLET: {shortAddress}</p>
        </div>
        <Link
          href="/dashboard/jobs/new"
          className="border-2 border-white px-6 py-3 text-sm font-bold tracking-wider bg-white text-black hover:bg-black hover:text-white transition-colors"
        >
          [+ POST NEW JOB]
        </Link>
      </div>

      {/* Urgent Actions */}
      {PENDING_ACTIONS.length > 0 && (
        <div className="border-2 border-yellow-400 bg-yellow-400/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
            <h2 className="text-sm font-bold tracking-wider text-yellow-400">
              PENDING_ACTIONS ({PENDING_ACTIONS.length})
            </h2>
          </div>
          <div className="space-y-2">
            {PENDING_ACTIONS.map((action, i) => (
              <Link
                key={i}
                href={`/dashboard/jobs/${action.jobId}/manage`}
                className="flex items-center justify-between p-3 border border-yellow-400/30 hover:bg-yellow-400/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 border ${
                    action.priority === "HIGH" ? "border-red-400 text-red-400" : "border-white/50 text-white/50"
                  }`}>
                    {action.priority}
                  </span>
                  <span className="text-sm">{action.title}</span>
                </div>
                <ArrowRight className="h-4 w-4" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0">
        <div className="border-2 border-white p-6 md:-ml-[2px] md:first:ml-0">
          <div className="flex items-center gap-2 mb-2">
            <Briefcase className="h-4 w-4 text-white/60" />
            <p className="text-xs text-white/60 tracking-wider">ACTIVE_JOBS</p>
          </div>
          <p className="text-3xl font-bold">{MY_JOBS.filter(j => j.status !== "COMPLETED").length}</p>
        </div>
        <div className="border-2 border-white p-6 -mt-[2px] md:mt-0 md:-ml-[2px]">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-green-400" />
            <p className="text-xs text-white/60 tracking-wider">TOTAL_IN_ESCROW</p>
          </div>
          <p className="text-3xl font-bold text-green-400">{ESCROW_SUMMARY.total} USDC</p>
        </div>
        <div className="border-2 border-white p-6 -mt-[2px] md:mt-0 md:-ml-[2px]">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-yellow-400" />
            <p className="text-xs text-white/60 tracking-wider">PENDING_RELEASE</p>
          </div>
          <p className="text-3xl font-bold text-yellow-400">{ESCROW_SUMMARY.pendingRelease} USDC</p>
        </div>
        <div className="border-2 border-white p-6 -mt-[2px] md:mt-0 md:-ml-[2px]">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-4 w-4 text-white/60" />
            <p className="text-xs text-white/60 tracking-wider">COMPLETED_JOBS</p>
          </div>
          <p className="text-3xl font-bold">{MY_JOBS.filter(j => j.status === "COMPLETED").length}</p>
        </div>
      </div>

      {/* My Jobs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold tracking-wider">{`>>> MY_JOBS`}</h2>
          <Link
            href="/dashboard/jobs"
            className="text-xs text-white/50 hover:text-white tracking-wider"
          >
            VIEW ALL &gt;
          </Link>
        </div>
        <div className="border-2 border-white">
          {MY_JOBS.map((job, i) => (
            <Link
              key={job.id}
              href={`/dashboard/jobs/${job.id}/manage`}
              className={`block p-4 hover:bg-white/5 transition-colors ${
                i !== MY_JOBS.length - 1 ? "border-b border-white/30" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs text-white/40">{job.id}</span>
                    <span className={`border px-2 py-0.5 text-xs tracking-wider ${getStatusColor(job.status)}`}>
                      {job.status}
                    </span>
                    {job.urgentAction && (
                      <span className="text-xs text-yellow-400 animate-pulse">
                        ! {job.urgentAction}
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold mb-2">{job.title}</h3>
                  <div className="flex items-center gap-4 text-xs text-white/60">
                    {job.agent && <span>AGENT: {job.agent}</span>}
                    {job.progress !== undefined && (
                      <span className="flex items-center gap-2">
                        PROGRESS:
                        <span className="w-20 h-1.5 bg-white/20">
                          <span
                            className="block h-full bg-green-400"
                            style={{ width: `${job.progress}%` }}
                          />
                        </span>
                        {job.progress}%
                      </span>
                    )}
                    {job.rating && (
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                        {job.rating}/5
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold">{job.budget}</p>
                  <p className={`text-xs mt-1 ${
                    job.escrowStatus === "PENDING_RELEASE" ? "text-yellow-400" :
                    job.escrowStatus === "LOCKED" ? "text-green-400" :
                    job.escrowStatus === "RELEASED" ? "text-white/50" :
                    "text-white"
                  }`}>
                    {job.escrowStatus}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Escrow & Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Escrow Breakdown */}
        <div className="border-2 border-white p-6">
          <h2 className="text-lg font-bold tracking-wider mb-4">{`>>> ESCROW_BREAKDOWN`}</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-white/20">
              <span className="text-sm text-white/60">Funded (Awaiting Bids)</span>
              <span className="font-bold">{ESCROW_SUMMARY.funded} USDC</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-white/20">
              <span className="text-sm text-white/60">Locked (Work in Progress)</span>
              <span className="font-bold text-green-400">{ESCROW_SUMMARY.locked} USDC</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-white/20">
              <span className="text-sm text-white/60">Pending Release (Review)</span>
              <span className="font-bold text-yellow-400">{ESCROW_SUMMARY.pendingRelease} USDC</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm font-bold">TOTAL</span>
              <span className="text-xl font-bold">{ESCROW_SUMMARY.total} USDC</span>
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="border-2 border-white p-6">
          <h2 className="text-lg font-bold tracking-wider mb-4">{`>>> RECENT_TRANSACTIONS`}</h2>
          <div className="space-y-3">
            {RECENT_TRANSACTIONS.map((tx, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-white/20 last:border-0">
                <div>
                  <p className="text-sm font-bold">
                    {tx.type === "ESCROW_FUNDED" ? "+" : "-"}{tx.amount} USDC
                  </p>
                  <p className="text-xs text-white/50">{tx.job}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-white/50">{tx.date}</p>
                  <p className={`text-xs ${tx.type === "ESCROW_FUNDED" ? "text-green-400" : "text-cyan-400"}`}>
                    {tx.type.replace(/_/g, " ")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-4">
        <Link
          href="/dashboard/jobs/new"
          className="border-2 border-white px-6 py-3 text-sm font-bold tracking-wider bg-white text-black hover:bg-black hover:text-white transition-colors"
        >
          [POST NEW JOB]
        </Link>
        <Link
          href="/dashboard/jobs"
          className="border-2 border-white px-6 py-3 text-sm font-bold tracking-wider hover:bg-white hover:text-black transition-colors"
        >
          [MANAGE JOBS]
        </Link>
        <Link
          href="/dashboard/agents"
          className="border-2 border-white px-6 py-3 text-sm font-bold tracking-wider hover:bg-white hover:text-black transition-colors"
        >
          [BROWSE AGENTS]
        </Link>
      </div>
    </div>
  );
}
