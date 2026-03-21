"use client";

import { useEffect, useState } from "react";
import { X, Loader2, CheckCircle, ExternalLink, AlertTriangle, Wallet } from "lucide-react";
import { useEscrowDeposit, EscrowDepositState } from "@/hooks/use-escrow-deposit";
import { getExplorerTxUrl, getContractAddresses } from "@/lib/contracts/config";

interface FundEscrowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  jobId: string;
  amountUsdc: number;
  token: string;
}

// Step configuration
const STEPS = [
  { key: "approve", label: "APPROVE_USDC", description: "Allow escrow contract to transfer USDC" },
  { key: "deposit", label: "DEPOSIT_ESCROW", description: "Deposit USDC to escrow contract" },
  { key: "confirm", label: "CONFIRM", description: "Verify transaction on-chain" },
] as const;

// Map state to current step
function getStepIndex(state: EscrowDepositState): number {
  switch (state) {
    case "idle":
    case "checking_allowance":
      return -1;
    case "approving":
    case "waiting_approve":
      return 0;
    case "depositing":
    case "waiting_deposit":
      return 1;
    case "confirming":
      return 2;
    case "success":
      return 3;
    case "error":
      return -1;
    default:
      return -1;
  }
}

export function FundEscrowModal({
  isOpen,
  onClose,
  onSuccess,
  jobId,
  amountUsdc,
  token,
}: FundEscrowModalProps) {
  const {
    state,
    error,
    approveTxHash,
    depositTxHash,
    usdcBalance,
    deposit,
    reset,
  } = useEscrowDeposit();

  const contracts = getContractAddresses();
  const currentStep = getStepIndex(state);
  const isProcessing = state !== "idle" && state !== "success" && state !== "error";
  const insufficientBalance = usdcBalance < amountUsdc;

  // Start deposit when modal opens (only once)
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    if (isOpen && state === "idle" && !insufficientBalance && !hasStarted) {
      setHasStarted(true);
      deposit(jobId, amountUsdc, token);
    }
    // Reset hasStarted when modal closes
    if (!isOpen) {
      setHasStarted(false);
    }
  }, [isOpen, state, insufficientBalance, jobId, amountUsdc, token, deposit, hasStarted]);

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
          <h2 className="text-xl font-bold tracking-wider mb-2">FUND_ESCROW</h2>
          <p className="text-sm text-white/60">
            Depositing {amountUsdc.toFixed(2)} USDC to escrow
          </p>
        </div>

        {/* Balance Check */}
        {insufficientBalance && state === "idle" && (
          <div className="border-2 border-red-500 p-4 mb-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-red-500" />
              <div>
                <p className="text-red-500 font-bold">INSUFFICIENT_BALANCE</p>
                <p className="text-xs text-white/60 mt-1">
                  You have {usdcBalance.toFixed(2)} USDC but need {amountUsdc.toFixed(2)} USDC
                </p>
              </div>
            </div>
          </div>
        )}

        {/* USDC Balance Display */}
        <div className="border border-white/20 p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-white/50" />
              <span className="text-xs text-white/50">YOUR USDC BALANCE</span>
            </div>
            <span className="font-bold">{usdcBalance.toFixed(2)} USDC</span>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="space-y-4 mb-8">
          {STEPS.map((step, index) => {
            const isActive = currentStep === index;
            const isComplete = currentStep > index || state === "success";
            const isPending = currentStep < index && state !== "error";

            return (
              <div
                key={step.key}
                className={`border-2 p-4 transition-colors ${
                  isActive
                    ? "border-yellow-400 bg-yellow-400/5"
                    : isComplete
                    ? "border-green-400 bg-green-400/5"
                    : "border-white/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 border-2 flex items-center justify-center text-sm font-bold ${
                        isActive
                          ? "border-yellow-400 text-yellow-400"
                          : isComplete
                          ? "border-green-400 bg-green-400 text-black"
                          : "border-white/30 text-white/30"
                      }`}
                    >
                      {isComplete ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : isActive ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        index + 1
                      )}
                    </div>
                    <div>
                      <p
                        className={`font-bold text-sm ${
                          isActive ? "text-yellow-400" : isComplete ? "text-green-400" : "text-white/50"
                        }`}
                      >
                        {step.label}
                      </p>
                      <p className="text-xs text-white/40">{step.description}</p>
                    </div>
                  </div>

                  {/* Transaction link */}
                  {step.key === "approve" && approveTxHash && (
                    <a
                      href={getExplorerTxUrl(approveTxHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-cyan-400 hover:underline flex items-center gap-1"
                    >
                      TX <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {step.key === "deposit" && depositTxHash && (
                    <a
                      href={getExplorerTxUrl(depositTxHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-cyan-400 hover:underline flex items-center gap-1"
                    >
                      TX <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Success State */}
        {state === "success" && (
          <div className="border-2 border-green-400 bg-green-400/10 p-4 text-center mb-6">
            <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
            <p className="text-green-400 font-bold">ESCROW_FUNDED</p>
            <p className="text-xs text-white/60 mt-1">
              {amountUsdc.toFixed(2)} USDC deposited successfully
            </p>
          </div>
        )}

        {/* Error State */}
        {state === "error" && error && (
          <div className="border-2 border-red-500 bg-red-500/10 p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-500 font-bold text-sm">TRANSACTION_FAILED</p>
                <p className="text-xs text-white/60 mt-1">{error}</p>
              </div>
            </div>
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
                  deposit(jobId, amountUsdc, token);
                }}
                className="flex-1 border-2 border-white bg-white text-black px-4 py-3 text-sm font-bold tracking-wider hover:bg-black hover:text-white transition-colors"
              >
                [RETRY]
              </button>
            </>
          )}

          {insufficientBalance && state === "idle" && (
            <button
              onClick={handleClose}
              className="w-full border-2 border-white px-4 py-3 text-sm font-bold tracking-wider hover:bg-white hover:text-black transition-colors"
            >
              [CLOSE]
            </button>
          )}

          {isProcessing && (
            <div className="w-full text-center text-sm text-white/50">
              <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
              Please confirm transaction in your wallet...
            </div>
          )}
        </div>

        {/* Contract Info */}
        <div className="mt-6 pt-4 border-t border-white/10 text-xs text-white/30 overflow-hidden">
          <div className="flex justify-between gap-2">
            <span className="flex-shrink-0">ESCROW CONTRACT</span>
            <span className="font-mono truncate">{contracts.escrow.slice(0, 10)}...{contracts.escrow.slice(-8)}</span>
          </div>
          <div className="flex justify-between gap-2 mt-1">
            <span className="flex-shrink-0">USDC TOKEN</span>
            <span className="font-mono truncate">{contracts.usdc.slice(0, 10)}...{contracts.usdc.slice(-8)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
