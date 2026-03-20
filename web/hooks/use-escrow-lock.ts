"use client";

import { useState, useCallback } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { keccak256, toBytes, encodeAbiParameters, parseAbiParameters } from "viem";
import { ESCROW_ABI } from "@/lib/contracts/abis";
import { getContractAddresses, toUsdcWei } from "@/lib/contracts/config";

export type EscrowLockState =
  | "idle"
  | "locking"
  | "waiting_lock"
  | "confirming"
  | "success"
  | "error";

interface UseEscrowLockResult {
  state: EscrowLockState;
  error: string | null;
  lockTxHash: string | null;
  excessRefunded: number;
  lockToAgent: (jobId: string, agentWallet: string, bidAmount: number, escrowAmount: number) => Promise<void>;
  reset: () => void;
}

// Generate jobId bytes32 from UUID (same as backend)
function uuidToBytes32(uuid: string): `0x${string}` {
  // Remove hyphens and convert to bytes
  const cleanUuid = uuid.replace(/-/g, "");
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(cleanUuid.substr(i * 2, 2), 16);
  }
  // Hash to get bytes32
  return keccak256(bytes);
}

export function useEscrowLock(): UseEscrowLockResult {
  const { address } = useAccount();
  const contracts = getContractAddresses();

  const [state, setState] = useState<EscrowLockState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lockTxHash, setLockTxHash] = useState<string | null>(null);
  const [excessRefunded, setExcessRefunded] = useState<number>(0);

  const { writeContractAsync } = useWriteContract();

  const reset = useCallback(() => {
    setState("idle");
    setError(null);
    setLockTxHash(null);
    setExcessRefunded(0);
  }, []);

  const lockToAgent = useCallback(
    async (jobId: string, agentWallet: string, bidAmount: number, escrowAmount: number) => {
      if (!address) {
        setError("Please connect your wallet");
        setState("error");
        return;
      }

      try {
        setState("locking");
        setError(null);

        const jobIdBytes32 = uuidToBytes32(jobId);
        const bidAmountWei = toUsdcWei(bidAmount);
        const excess = escrowAmount - bidAmount;
        setExcessRefunded(excess);

        console.log("Locking escrow:", {
          jobId,
          jobIdBytes32,
          agentWallet,
          bidAmount,
          bidAmountWei: bidAmountWei.toString(),
          excess,
        });

        // Call lockToAgent on escrow contract
        const hash = await writeContractAsync({
          address: contracts.escrow,
          abi: ESCROW_ABI,
          functionName: "lockToAgent",
          args: [jobIdBytes32, agentWallet as `0x${string}`, bidAmountWei],
        });

        setLockTxHash(hash);
        setState("waiting_lock");

        // Wait for transaction confirmation
        setState("confirming");

        // Poll for receipt
        const receipt = await waitForReceipt(hash);

        if (receipt.status === "success") {
          setState("success");
        } else {
          throw new Error("Transaction failed");
        }
      } catch (err: any) {
        console.error("Lock escrow error:", err);
        setError(err.message || "Failed to lock escrow");
        setState("error");
      }
    },
    [address, contracts.escrow, writeContractAsync]
  );

  return {
    state,
    error,
    lockTxHash,
    excessRefunded,
    lockToAgent,
    reset,
  };
}

// Helper to wait for transaction receipt
async function waitForReceipt(
  hash: string,
  maxAttempts = 60,
  interval = 2000
): Promise<{ status: "success" | "reverted" }> {
  const { getActiveChainId } = await import("@/lib/contracts/config");
  const chainId = getActiveChainId();

  const rpcUrl =
    chainId === 196
      ? "https://rpc.xlayer.tech"
      : chainId === 1952
      ? "https://testrpc.xlayer.tech"
      : "http://127.0.0.1:8545";

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_getTransactionReceipt",
          params: [hash],
        }),
      });

      const data = await response.json();

      if (data.result) {
        const status = data.result.status === "0x1" ? "success" : "reverted";
        return { status };
      }
    } catch (e) {
      console.warn("Receipt poll error:", e);
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error("Transaction confirmation timeout");
}
