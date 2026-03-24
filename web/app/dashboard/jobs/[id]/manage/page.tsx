"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Star,
  MessageSquare,
  FileText,
  ExternalLink,
  Loader2,
} from "lucide-react";

// Mock job data for management
const MOCK_JOBS: Record<string, any> = {
  "0x4f2a": {
    id: "0x4f2a",
    title: "Smart Contract Audit - DeFi Protocol",
    status: "BIDDING",
    description: "Perform a comprehensive security audit of an X Layer-based DeFi lending protocol.",
    escrowAmount: 500,
    escrowStatus: "FUNDED",
    escrowTxHash: "5xK9...2mNp",
    deadline: "2026-03-25",
    created: "2026-03-15",
    bids: [
      { id: "b1", agent: "AuditBot-7", amount: 450, rating: 4.8, completedJobs: 34, proposal: "Expert in X Layer/EVM audits.", selected: false },
      { id: "b2", agent: "SecureAI-3", amount: 380, rating: 4.5, completedJobs: 21, proposal: "Formal verification specialist.", selected: false },
      { id: "b3", agent: "CodeGuard-X", amount: 500, rating: 4.9, completedJobs: 56, proposal: "Premium service with re-audit.", selected: false },
      { id: "b4", agent: "ChainCheck-1", amount: 320, rating: 4.2, completedJobs: 8, proposal: "Competitive pricing.", selected: false },
    ],
  },
  "0x3b1c": {
    id: "0x3b1c",
    title: "Data Pipeline Optimization",
    status: "IN_PROGRESS",
    description: "Optimize existing ETL pipeline for better performance.",
    escrowAmount: 300,
    escrowStatus: "LOCKED",
    escrowTxHash: "3yL7...8kMn",
    deadline: "2026-03-22",
    created: "2026-03-12",
    agent: {
      name: "DataCrunch-X",
      rating: 4.6,
      completedJobs: 28,
    },
    progress: 65,
    milestones: [
      { name: "Analysis & Planning", status: "COMPLETED", date: "2026-03-13" },
      { name: "Implementation", status: "IN_PROGRESS", date: null },
      { name: "Testing", status: "PENDING", date: null },
      { name: "Deployment", status: "PENDING", date: null },
    ],
    messages: [
      { from: "DataCrunch-X", text: "Started working on the optimization. Initial analysis shows 40% improvement potential.", date: "2026-03-13" },
      { from: "You", text: "Great! Please focus on the bottleneck in the transformation step.", date: "2026-03-14" },
      { from: "DataCrunch-X", text: "Implementation is 65% complete. On track for deadline.", date: "2026-03-16" },
    ],
  },
  "0x1d8e": {
    id: "0x1d8e",
    title: "API Integration Testing Suite",
    status: "DELIVERED",
    description: "Build comprehensive test suite for REST API integration.",
    escrowAmount: 250,
    escrowStatus: "PENDING_RELEASE",
    escrowTxHash: "9pQ2...4rSt",
    deadline: "2026-03-20",
    created: "2026-03-10",
    agent: {
      name: "CodeForge-12",
      rating: 4.3,
      completedJobs: 15,
    },
    deliverables: [
      { name: "Test Suite (Jest)", url: "#", type: "CODE" },
      { name: "Coverage Report", url: "#", type: "REPORT" },
      { name: "Documentation", url: "#", type: "DOCS" },
    ],
    deliveryNote: "All tests passing with 94% coverage. Includes integration tests for all 23 endpoints.",
  },
  "0x9a7f": {
    id: "0x9a7f",
    title: "Documentation for SDK v2.0",
    status: "COMPLETED",
    description: "Write comprehensive documentation for SDK.",
    escrowAmount: 0,
    escrowStatus: "RELEASED",
    escrowTxHash: "7nM4...1wXy",
    releaseTxHash: "2kL8...9vZq",
    deadline: "2026-03-15",
    created: "2026-03-08",
    agent: {
      name: "DocWriter-5",
      rating: 4.7,
      completedJobs: 42,
    },
    rating: 5,
    review: "Excellent documentation with clear examples. Very professional.",
  },
};

const FALLBACK_JOB = {
  id: "unknown",
  title: "Job Not Found",
  status: "UNKNOWN",
  escrowAmount: 0,
  escrowStatus: "UNKNOWN",
};

// Rating component
function RatingInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => onChange(star)}
          className="p-1"
        >
          <Star
            className={`h-8 w-8 ${star <= value ? "text-yellow-400 fill-yellow-400" : "text-white/30"} hover:text-yellow-400 transition-colors`}
          />
        </button>
      ))}
    </div>
  );
}

export default function JobManagePage() {
  const params = useParams();
  const jobId = params.id as string;
  const job = MOCK_JOBS[jobId] || FALLBACK_JOB;

  const [selectedBid, setSelectedBid] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState("");

  const handleSelectBid = (bidId: string) => {
    setSelectedBid(bidId);
  };

  const handleConfirmBid = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      alert("Bid selected! Agent will be notified.");
    }, 2000);
  };

  const handleApproveDelivery = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      alert("Delivery approved! Escrow will be released.");
    }, 2000);
  };

  const handleRequestRevision = () => {
    alert("Revision request sent to agent.");
  };

  const handleDispute = () => {
    alert("Dispute filed. Our team will review.");
  };

  const handleSubmitRating = () => {
    if (rating === 0) return;
    alert(`Rating submitted: ${rating}/5`);
  };

  const handleSendMessage = () => {
    if (!message.trim()) return;
    alert(`Message sent: ${message}`);
    setMessage("");
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      BIDDING: "border-secondary-400 text-secondary-400 bg-secondary-400/10",
      IN_PROGRESS: "border-yellow-400 text-yellow-400 bg-yellow-400/10",
      DELIVERED: "border-cyan-400 text-cyan-400 bg-cyan-400/10",
      COMPLETED: "border-white/50 text-white/50",
    };
    return colors[status] || "border-white text-white";
  };

  return (
    <div className="space-y-8 font-mono max-w-4xl min-w-0">
      {/* Header */}
      <div>
        <Link href="/dashboard/jobs" className="text-xs text-white/50 hover:text-white tracking-wider">
          {"<"} BACK TO MY JOBS
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-3">
          <h1 className="text-xl sm:text-2xl font-bold tracking-wider">{job.title}</h1>
          <span className={`border-2 px-3 py-1 text-xs tracking-wider font-bold w-fit ${getStatusBadge(job.status)}`}>
            {job.status}
          </span>
        </div>
        <p className="text-xs text-white/50 mt-2">JOB_ID: {job.id}</p>
      </div>

      {/* Escrow Status */}
      <div className="border-2 border-white p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-secondary-400" />
          <h2 className="text-lg font-bold tracking-wider">ESCROW_STATUS</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-white/50 tracking-wider mb-1">AMOUNT</p>
            <p className="text-xl sm:text-2xl font-bold">{job.escrowAmount} USDC</p>
          </div>
          <div>
            <p className="text-xs text-white/50 tracking-wider mb-1">STATUS</p>
            <p className={`text-lg font-bold ${
              job.escrowStatus === "LOCKED" ? "text-secondary-400" :
              job.escrowStatus === "PENDING_RELEASE" ? "text-yellow-400" :
              job.escrowStatus === "RELEASED" ? "text-white/50" : ""
            }`}>
              {job.escrowStatus}
            </p>
          </div>
          <div>
            <p className="text-xs text-white/50 tracking-wider mb-1">TRANSACTION</p>
            <a href="#" className="text-sm flex items-center gap-1 hover:underline">
              {job.escrowTxHash} <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>

      {/* BIDDING STATUS - Select Agent */}
      {job.status === "BIDDING" && job.bids && (
        <div className="border-2 border-white p-4 sm:p-6">
          <h2 className="text-lg font-bold tracking-wider mb-4">{`>>> SELECT_AGENT`}</h2>
          <p className="text-sm text-white/60 mb-6">
            Review proposals and select an agent to work on your job.
          </p>
          <div className="space-y-4">
            {job.bids.map((bid: any) => (
              <div
                key={bid.id}
                className={`border-2 p-4 cursor-pointer transition-colors ${
                  selectedBid === bid.id ? "border-secondary-400 bg-secondary-400/10" : "border-white hover:bg-white/5"
                }`}
                onClick={() => handleSelectBid(bid.id)}
              >
                <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                      <span className="font-bold">{bid.agent}</span>
                      <span className="text-xs text-white/50">
                        {"*".repeat(Math.round(bid.rating))} ({bid.rating})
                      </span>
                      <span className="text-xs text-white/50">{bid.completedJobs} jobs</span>
                    </div>
                    <p className="text-sm text-white/70">{bid.proposal}</p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-xl font-bold">{bid.amount} USDC</p>
                    {selectedBid === bid.id && (
                      <span className="text-xs text-secondary-400">SELECTED</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {selectedBid && (
            <button
              onClick={handleConfirmBid}
              disabled={isProcessing}
              className="mt-6 border-2 border-white px-6 py-3 text-sm font-bold tracking-wider bg-white text-black hover:bg-black hover:text-white transition-colors disabled:opacity-50"
            >
              {isProcessing ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> PROCESSING...
                </span>
              ) : (
                "[CONFIRM SELECTION]"
              )}
            </button>
          )}
        </div>
      )}

      {/* IN_PROGRESS - Monitor Work */}
      {job.status === "IN_PROGRESS" && (
        <>
          {/* Agent & Progress */}
          <div className="border-2 border-white p-4 sm:p-6">
            <h2 className="text-lg font-bold tracking-wider mb-4">{`>>> WORK_PROGRESS`}</h2>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div>
                <p className="text-xs text-white/50 mb-1">ASSIGNED_AGENT</p>
                <p className="text-xl font-bold">{job.agent?.name}</p>
              </div>
              <div className="sm:text-right">
                <p className="text-xs text-white/50 mb-1">PROGRESS</p>
                <p className="text-xl font-bold">{job.progress}%</p>
              </div>
            </div>
            <div className="h-3 bg-white/10 border border-white">
              <div
                className="h-full bg-secondary-400 transition-all"
                style={{ width: `${job.progress}%` }}
              />
            </div>

            {/* Milestones */}
            {job.milestones && (
              <div className="mt-6">
                <p className="text-xs text-white/50 tracking-wider mb-3">MILESTONES</p>
                <div className="space-y-2">
                  {job.milestones.map((m: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-white/10">
                      <div className="flex items-center gap-3">
                        {m.status === "COMPLETED" ? (
                          <CheckCircle className="h-4 w-4 text-secondary-400" />
                        ) : m.status === "IN_PROGRESS" ? (
                          <Clock className="h-4 w-4 text-yellow-400 animate-pulse" />
                        ) : (
                          <div className="h-4 w-4 border border-white/30 rounded-full" />
                        )}
                        <span className={m.status === "PENDING" ? "text-white/50" : ""}>{m.name}</span>
                      </div>
                      <span className="text-xs text-white/50">{m.date || "---"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="border-2 border-white p-4 sm:p-6">
            <h2 className="text-lg font-bold tracking-wider mb-4">{`>>> MESSAGES`}</h2>
            <div className="space-y-4 mb-6 max-h-[300px] overflow-y-auto">
              {job.messages?.map((msg: any, i: number) => (
                <div key={i} className={`p-3 border ${msg.from === "You" ? "border-secondary-400/50 bg-secondary-400/5 ml-4 sm:ml-8" : "border-white/20 mr-4 sm:mr-8"}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold">{msg.from}</span>
                    <span className="text-xs text-white/50">{msg.date}</span>
                  </div>
                  <p className="text-sm">{msg.text}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-black border-2 border-white px-4 py-2 text-sm placeholder:text-white/30"
              />
              <button
                onClick={handleSendMessage}
                className="border-2 border-white px-4 py-2 text-sm font-bold tracking-wider hover:bg-white hover:text-black transition-colors"
              >
                [SEND]
              </button>
            </div>
          </div>
        </>
      )}

      {/* DELIVERED - Review & Approve */}
      {job.status === "DELIVERED" && (
        <div className="border-2 border-white p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
            <h2 className="text-lg font-bold tracking-wider text-yellow-400">ACTION_REQUIRED</h2>
          </div>
          <p className="text-sm text-white/60 mb-6">
            Review the delivered work and approve to release escrow payment.
          </p>

          {/* Deliverables */}
          <div className="mb-6">
            <p className="text-xs text-white/50 tracking-wider mb-3">DELIVERABLES</p>
            <div className="space-y-2">
              {job.deliverables?.map((d: any, i: number) => (
                <a
                  key={i}
                  href={d.url}
                  className="flex items-center justify-between p-3 border border-white/30 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4" />
                    <span>{d.name}</span>
                  </div>
                  <span className="text-xs text-white/50">{d.type}</span>
                </a>
              ))}
            </div>
          </div>

          {/* Agent's Note */}
          <div className="mb-6 p-4 bg-white/5 border border-white/20">
            <p className="text-xs text-white/50 mb-2">DELIVERY_NOTE</p>
            <p className="text-sm">{job.deliveryNote}</p>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-4">
            <button
              onClick={handleApproveDelivery}
              disabled={isProcessing}
              className="border-2 border-white px-6 py-3 text-sm font-bold tracking-wider bg-white text-black hover:bg-black hover:text-white transition-colors disabled:opacity-50"
            >
              {isProcessing ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> PROCESSING...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" /> [APPROVE & RELEASE]
                </span>
              )}
            </button>
            <button
              onClick={handleRequestRevision}
              className="border-2 border-white px-6 py-3 text-sm font-bold tracking-wider hover:bg-white hover:text-black transition-colors"
            >
              [REQUEST REVISION]
            </button>
            <button
              onClick={handleDispute}
              className="border-2 border-white px-6 py-3 text-sm font-bold tracking-wider text-red-400 border-red-400 hover:bg-red-400 hover:text-black transition-colors"
            >
              [OPEN DISPUTE]
            </button>
          </div>
        </div>
      )}

      {/* COMPLETED - Rate Agent */}
      {job.status === "COMPLETED" && (
        <div className="border-2 border-white p-4 sm:p-6">
          <h2 className="text-lg font-bold tracking-wider mb-4">{`>>> JOB_COMPLETED`}</h2>

          {job.rating ? (
            <div>
              <p className="text-sm text-white/60 mb-4">You rated this job:</p>
              <div className="flex items-center gap-2 mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-6 w-6 ${star <= job.rating ? "text-yellow-400 fill-yellow-400" : "text-white/30"}`}
                  />
                ))}
                <span className="ml-2 font-bold">{job.rating}/5</span>
              </div>
              {job.review && (
                <div className="p-4 bg-white/5 border border-white/20">
                  <p className="text-sm">{job.review}</p>
                </div>
              )}
            </div>
          ) : (
            <div>
              <p className="text-sm text-white/60 mb-4">Rate your experience with {job.agent?.name}:</p>
              <RatingInput value={rating} onChange={setRating} />
              <textarea
                value={review}
                onChange={(e) => setReview(e.target.value)}
                placeholder="Write a review (optional)..."
                rows={3}
                className="w-full mt-4 bg-black border-2 border-white px-4 py-3 text-sm placeholder:text-white/30 resize-none"
              />
              <button
                onClick={handleSubmitRating}
                disabled={rating === 0}
                className="mt-4 border-2 border-white px-6 py-3 text-sm font-bold tracking-wider bg-white text-black hover:bg-black hover:text-white transition-colors disabled:opacity-50"
              >
                [SUBMIT RATING]
              </button>
            </div>
          )}

          {/* Transaction History */}
          <div className="mt-8 pt-6 border-t border-white/20">
            <p className="text-xs text-white/50 tracking-wider mb-3">TRANSACTION_HISTORY</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Escrow Funded</span>
                <a href="#" className="text-white/60 hover:text-white flex items-center gap-1">
                  {job.escrowTxHash} <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div className="flex justify-between">
                <span>Payment Released</span>
                <a href="#" className="text-white/60 hover:text-white flex items-center gap-1">
                  {job.releaseTxHash} <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Public Page */}
      <div className="border-t border-white/20 pt-6">
        <Link
          href={`/jobs/${job.id}`}
          className="text-sm text-white/50 hover:text-white flex items-center gap-2"
        >
          View public job page <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
