"use client";

import { useState, useCallback } from "react";
import { useAccount, useWriteContract, usePublicClient, useChainId } from "wagmi";
import { keccak256 } from "viem";
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
  const cleanUuid = uuid.replace(/-/g, "");
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(cleanUuid.substr(i * 2, 2), 16);
  }
  return keccak256(bytes);
}

export function useEscrowLock(): UseEscrowLockResult {
  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
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
          jobId, jobIdBytes32, agentWallet, bidAmount,
          bidAmountWei: bidAmountWei.toString(), excess,
        });

        const hash = await writeContractAsync({
          address: contracts.escrow,
          abi: ESCROW_ABI,
          functionName: "lockToAgent",
          args: [jobIdBytes32, agentWallet as `0x${string}`, bidAmountWei],
          chainId,
        });

        setLockTxHash(hash);
        setState("waiting_lock");
        setState("confirming");

        if (!publicClient) throw new Error("No public client available");

        const receipt = await publicClient.waitForTransactionReceipt({
          hash,
          timeout: 300_000,
        });

        if (receipt.status === "success") {
          setState("success");
        } else {
          throw new Error("Lock transaction reverted on-chain");
        }
      } catch (err: any) {
        console.error("Lock escrow error:", err);
        setError(err?.shortMessage || err?.message || "Failed to lock escrow");
        setState("error");
      }
    },
    [address, chainId, publicClient, contracts.escrow, writeContractAsync]
  );

  return { state, error, lockTxHash, excessRefunded, lockToAgent, reset };
}
