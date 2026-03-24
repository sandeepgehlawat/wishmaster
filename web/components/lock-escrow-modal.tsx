"use client";

import { useEffect, useState } from "react";
import { X, Loader2, CheckCircle, ExternalLink, AlertTriangle, ArrowRight } from "lucide-react";
import { useEscrowLock, EscrowLockState } from "@/hooks/use-escrow-lock";
import { getExplorerTxUrl, getContractAddresses } from "@/lib/contracts/config";

interface LockEscrowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  jobId: string;
  agentWallet: string;
  agentName: string;
  bidAmount: number;
  escrowAmount: number;
}

export function LockEscrowModal({
  isOpen,
  onClose,
  onSuccess,
  jobId,
  agentWallet,
  agentName,
  bidAmount,
  escrowAmount,
}: LockEscrowModalProps) {
  const {
    state,
    error,
    lockTxHash,
    excessRefunded,
    lockToAgent,
    reset,
  } = useEscrowLock();

  const contracts = getContractAddresses();
  const isProcessing = state !== "idle" && state !== "success" && state !== "error";
  const excess = escrowAmount - bidAmount;

  // Start lock when modal opens
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    if (isOpen && state === "idle" && !hasStarted) {
      setHasStarted(true);
      lockToAgent(jobId, agentWallet, bidAmount, escrowAmount);
    }
    if (!isOpen) {
      setHasStarted(false);
    }
  }, [isOpen, state, hasStarted, jobId, agentWallet, bidAmount, escrowAmount, lockToAgent]);

  // Handle success
  useEffect(() => {
    if (state === "success") {
      const timer = setTimeout(() => {
        onSuccess();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [state, onSuccess]);

  // Reset on close
  const handleClose = () => {
    if (!isProcessing) {
      reset();
      onClose();
    }
  };

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isProcessing) {
        handleClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isProcessing]);

  // Prevent body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center font-mono">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/95"
        onClick={!isProcessing ? handleClose : undefined}
      />

      {/* Modal */}
      <div className="relative bg-black border-2 border-white p-4 sm:p-8 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        {!isProcessing && (
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-white/50 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-xl font-bold tracking-wider mb-2">LOCK_ESCROW_TO_AGENT</h2>
          <p className="text-sm text-white/60">
            Confirm bid selection for {agentName}
          </p>
        </div>

        {/* Transaction Details */}
        <div className="border border-white/20 p-4 mb-6 space-y-3">
          <div className="flex justify-between">
            <span className="text-xs text-white/50">ESCROW FUNDED</span>
            <span className="font-bold">{escrowAmount.toFixed(2)} USDC</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-white/50">WINNING BID</span>
            <span className="font-bold text-secondary-400">{bidAmount.toFixed(2)} USDC</span>
          </div>
          {excess > 0 && (
            <div className="flex justify-between border-t border-white/10 pt-3">
              <span className="text-xs text-white/50">REFUND TO YOU</span>
              <span className="font-bold text-cyan-400">+{excess.toFixed(2)} USDC</span>
            </div>
          )}
        </div>

        {/* Flow Visualization */}
        <div className="border border-white/20 p-4 mb-6">
          <div className="flex items-center justify-between text-xs flex-wrap gap-2 sm:flex-nowrap">
            <div className="text-center">
              <div className="w-12 h-12 border-2 border-white/50 flex items-center justify-center mb-2 mx-auto">
                <span className="font-bold">{escrowAmount.toFixed(0)}</span>
              </div>
              <span className="text-white/50">ESCROW</span>
            </div>
            <ArrowRight className="h-5 w-5 text-white/30" />
            <div className="text-center">
              <div className="w-12 h-12 border-2 border-secondary-400 flex items-center justify-center mb-2 mx-auto">
                <span className="font-bold text-secondary-400">{bidAmount.toFixed(0)}</span>
              </div>
              <span className="text-white/50">LOCKED</span>
            </div>
            {excess > 0 && (
              <>
                <span className="text-white/30">+</span>
                <div className="text-center">
                  <div className="w-12 h-12 border-2 border-cyan-400 flex items-center justify-center mb-2 mx-auto">
                    <span className="font-bold text-cyan-400">{excess.toFixed(0)}</span>
                  </div>
                  <span className="text-white/50">REFUND</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Status */}
        <div className="mb-6">
          {state === "locking" && (
            <div className="flex items-center gap-3 text-yellow-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Please confirm transaction in your wallet...</span>
            </div>
          )}
          {(state === "waiting_lock" || state === "confirming") && (
            <div className="flex items-center gap-3 text-yellow-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Confirming transaction...</span>
            </div>
          )}
          {state === "success" && (
            <div className="border-2 border-secondary-400 bg-secondary-400/10 p-4 text-center">
              <CheckCircle className="h-8 w-8 text-secondary-400 mx-auto mb-2" />
              <p className="text-secondary-400 font-bold">ESCROW_LOCKED</p>
              <p className="text-xs text-white/60 mt-1">
                {bidAmount.toFixed(2)} USDC locked to {agentName}
                {excess > 0 && `, ${excess.toFixed(2)} USDC refunded to you`}
              </p>
            </div>
          )}
          {state === "error" && error && (
            <div className="border-2 border-red-500 bg-red-500/10 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-500 font-bold text-sm">TRANSACTION_FAILED</p>
                  <p className="text-xs text-white/60 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Transaction Link */}
        {lockTxHash && (
          <div className="mb-6 text-center">
            <a
              href={getExplorerTxUrl(lockTxHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-cyan-400 hover:underline flex items-center justify-center gap-1"
            >
              View transaction <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4">
          {state === "error" && (
            <>
              <button
                onClick={handleClose}
                className="flex-1 border-2 border-white/50 px-4 py-3 text-sm font-bold tracking-wider hover:border-white transition-colors"
              >
                [CANCEL]
              </button>
              <button
                onClick={() => {
                  reset();
                  lockToAgent(jobId, agentWallet, bidAmount, escrowAmount);
                }}
                className="flex-1 border-2 border-white bg-white text-black px-4 py-3 text-sm font-bold tracking-wider hover:bg-black hover:text-white transition-colors"
              >
                [RETRY]
              </button>
            </>
          )}
        </div>

        {/* Contract Info */}
        <div className="mt-6 pt-4 border-t border-white/10 text-xs text-white/30 overflow-hidden">
          <div className="flex justify-between gap-2">
            <span className="flex-shrink-0">ESCROW CONTRACT</span>
            <span className="font-mono truncate">{contracts.escrow.slice(0, 10)}...{contracts.escrow.slice(-8)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
