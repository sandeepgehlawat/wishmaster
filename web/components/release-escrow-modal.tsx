"use client";

import { useEffect } from "react";
import { X, Loader2, CheckCircle, ExternalLink, AlertTriangle } from "lucide-react";
import { useReadContract } from "wagmi";
import { useEscrowRelease, EscrowReleaseState } from "@/hooks/use-escrow-release";
import { ESCROW_ABI } from "@/lib/contracts/abis";
import { getExplorerTxUrl, getContractAddresses } from "@/lib/contracts/config";

interface ReleaseEscrowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  jobId: string;
  totalAmount: number;
  agentWallet: string;
  bidAmount: number;
  token: string;
}

const STEPS = [
  { key: "lock", label: "LOCK_TO_AGENT", description: "Lock escrow to agent (if needed)" },
  { key: "release", label: "RELEASE_FUNDS", description: "Release USDC to agent wallet" },
  { key: "confirm", label: "CONFIRM", description: "Verify release on-chain" },
] as const;

function getStepIndex(state: EscrowReleaseState): number {
  switch (state) {
    case "idle": return -1;
    case "locking":
    case "waiting_lock": return 0;
    case "releasing":
    case "waiting_release": return 1;
    case "confirming_backend": return 2;
    case "success": return 3;
    case "error": return -1;
    default: return -1;
  }
}

export function ReleaseEscrowModal({
  isOpen,
  onClose,
  onSuccess,
  jobId,
  totalAmount,
  agentWallet,
  bidAmount,
  token,
}: ReleaseEscrowModalProps) {
  const { state, error, releaseTxHash, release, reset } = useEscrowRelease();
  const contracts = getContractAddresses();
  const currentStep = getStepIndex(state);

  // Read platform fee from contract
  const { data: feeBpsData } = useReadContract({
    address: contracts.escrow,
    abi: ESCROW_ABI,
    functionName: "platformFeeBps",
  });
  const feeBps = feeBpsData ? Number(feeBpsData) : 500; // fallback 5%
  const platformFee = totalAmount * feeBps / 10000;
  const agentPayout = totalAmount - platformFee;

  useEffect(() => {
    if (isOpen && state === "idle") {
      release(jobId, token, agentWallet, bidAmount);
    }
  }, [isOpen, state, jobId, token, agentWallet, bidAmount, release]);

  useEffect(() => {
    if (state === "success") {
      const timer = setTimeout(() => {
        onSuccess();
        reset();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [state, onSuccess, reset]);

  if (!isOpen) return null;

  const isProcessing = !["idle", "success", "error"].includes(state);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0a0a0f] border border-neutral-700/40 max-w-lg w-full p-6 font-mono relative">
        {!isProcessing && (
          <button
            onClick={() => { onClose(); reset(); }}
            className="absolute top-4 right-4 text-white/50 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        <h2 className="text-lg font-bold tracking-wider text-center mb-2">
          RELEASE_PAYMENT
        </h2>
        <p className="text-sm text-white/50 text-center mb-6">
          Releasing {totalAmount.toFixed(2)} USDC from escrow
        </p>

        {/* Payout breakdown */}
        <div className="border border-neutral-700/40 p-3 mb-4 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-white/50">Agent payout</span>
            <span className="text-green-400 font-bold">{agentPayout.toFixed(2)} USDC</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-white/50">Platform fee (5%)</span>
            <span className="text-white/70">{platformFee.toFixed(2)} USDC</span>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-3 mb-6">
          {STEPS.map((step, i) => {
            const isActive = currentStep === i;
            const isComplete = currentStep > i;
            const isPending = currentStep < i;

            return (
              <div
                key={step.key}
                className={`flex items-center gap-3 p-3 border transition-colors ${
                  isActive
                    ? "border-yellow-400/50 bg-yellow-400/5"
                    : isComplete
                    ? "border-green-400/30 bg-green-400/5"
                    : "border-neutral-700/30 opacity-50"
                }`}
              >
                <div className="flex-shrink-0">
                  {isComplete ? (
                    <CheckCircle className="h-5 w-5 text-green-400" />
                  ) : isActive ? (
                    <Loader2 className="h-5 w-5 text-yellow-400 animate-spin" />
                  ) : (
                    <span className="h-5 w-5 flex items-center justify-center text-xs text-white/30 border border-white/20 rounded-full">
                      {i + 1}
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold tracking-wider flex items-center gap-2">
                    {step.label}
                    {isComplete && releaseTxHash && i === 0 && (
                      <a
                        href={getExplorerTxUrl(releaseTxHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-yellow-400 hover:underline flex items-center gap-1"
                      >
                        TX <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <p className="text-xs text-white/40">{step.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Success */}
        {state === "success" && (
          <div className="border border-green-400/30 bg-green-400/5 p-4 text-center">
            <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-green-400">PAYMENT RELEASED</p>
            <p className="text-xs text-white/50 mt-1">
              {agentPayout.toFixed(2)} USDC sent to agent
            </p>
          </div>
        )}

        {/* Error */}
        {state === "error" && error && (
          <div className="border border-red-500/30 bg-red-500/5 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-400">TRANSACTION_FAILED</p>
                <p className="text-xs text-white/60 mt-1 break-all">{error}</p>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { onClose(); reset(); }}
                className="flex-1 border border-white/20 px-4 py-2 text-sm font-bold tracking-wider hover:bg-white/5"
              >
                [CANCEL]
              </button>
              <button
                onClick={() => { reset(); release(jobId, token, agentWallet, bidAmount); }}
                className="flex-1 border border-yellow-400 text-yellow-400 px-4 py-2 text-sm font-bold tracking-wider hover:bg-yellow-400/10"
              >
                [RETRY]
              </button>
            </div>
          </div>
        )}

        {/* Processing */}
        {isProcessing && (
          <p className="text-xs text-white/40 text-center flex items-center justify-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            Please confirm transaction in your wallet...
          </p>
        )}

        {/* Contract info */}
        <div className="mt-4 pt-4 border-t border-neutral-700/20 text-xs text-white/30 space-y-1">
          <div className="flex justify-between">
            <span>ESCROW CONTRACT</span>
            <span>{contracts.escrow.slice(0, 12)}...{contracts.escrow.slice(-6)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
