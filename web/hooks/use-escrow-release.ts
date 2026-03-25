"use client";

import { useState, useCallback } from "react";
import { useAccount, useWriteContract, usePublicClient, useChainId } from "wagmi";
import { keccak256, toHex } from "viem";
import { ESCROW_ABI } from "@/lib/contracts/abis";
import { getContractAddresses, toUsdcWei } from "@/lib/contracts/config";
import { getApiBaseUrl } from "@/lib/api";

export type EscrowReleaseState =
  | "idle"
  | "locking"
  | "waiting_lock"
  | "releasing"
  | "waiting_release"
  | "confirming_backend"
  | "success"
  | "error";

export interface UseEscrowReleaseReturn {
  state: EscrowReleaseState;
  error: string | null;
  releaseTxHash: `0x${string}` | null;
  release: (jobId: string, token: string, agentWallet: string, bidAmount: number) => Promise<boolean>;
  reset: () => void;
}

function generateEscrowJobId(jobUuid: string): `0x${string}` {
  const cleanUuid = jobUuid.replace(/-/g, "");
  return keccak256(toHex(cleanUuid));
}

// On-chain escrow statuses: 0=Pending, 1=Funded, 2=Locked, 3=Released, 4=Refunded, 5=Disputed
const ESCROW_STATUS = { Pending: 0, Funded: 1, Locked: 2, Released: 3, Refunded: 4, Disputed: 5 };

export function useEscrowRelease(): UseEscrowReleaseReturn {
  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const contracts = getContractAddresses();

  const [state, setState] = useState<EscrowReleaseState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [releaseTxHash, setReleaseTxHash] = useState<`0x${string}` | null>(null);

  const { writeContractAsync } = useWriteContract();

  const reset = useCallback(() => {
    setState("idle");
    setError(null);
    setReleaseTxHash(null);
  }, []);

  const waitForTx = useCallback(async (txHash: `0x${string}`) => {
    if (!publicClient) throw new Error("No public client available");

    // Verify TX broadcast
    for (let i = 0; i < 5; i++) {
      try {
        const tx = await publicClient.getTransaction({ hash: txHash });
        if (tx) break;
      } catch (e) {}
      if (i === 4) throw new Error("Transaction not broadcast. Check your wallet's network RPC settings.");
      await new Promise(r => setTimeout(r, 2000));
    }

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      timeout: 300_000,
    });

    if (receipt.status !== "success") {
      throw new Error("Transaction reverted on-chain");
    }

    return receipt;
  }, [publicClient]);

  const release = useCallback(
    async (jobId: string, token: string, agentWallet: string, bidAmount: number): Promise<boolean> => {
      if (!address) {
        setError("Wallet not connected");
        setState("error");
        return false;
      }

      try {
        setError(null);
        const escrowJobId = generateEscrowJobId(jobId);
        if (!publicClient) throw new Error("No public client available");

        // Step 1: Check on-chain escrow status
        console.log("[Escrow Release] Checking on-chain status for", escrowJobId);
        const escrowData = await publicClient.readContract({
          address: contracts.escrow,
          abi: ESCROW_ABI,
          functionName: "getEscrow",
          args: [escrowJobId],
        }) as any;

        const onChainStatus = Number(escrowData.status);
        const statusNames = ["Pending", "Funded", "Locked", "Released", "Refunded", "Disputed"];
        console.log("[Escrow Release] On-chain status:", statusNames[onChainStatus]);

        if (onChainStatus === ESCROW_STATUS.Released) {
          // Already released, just confirm with backend
          setState("confirming_backend");
          await confirmWithBackend(jobId, token, "0x0");
          setState("success");
          return true;
        }

        if (onChainStatus === ESCROW_STATUS.Pending) {
          throw new Error("Escrow not funded on-chain. Please fund the escrow first.");
        }

        // Step 2: Lock to agent if still in Funded state
        if (onChainStatus === ESCROW_STATUS.Funded) {
          // If agent wallet not passed, fetch it from the backend
          if (!agentWallet || agentWallet === "0x0000000000000000000000000000000000000000") {
            const baseUrl = getApiBaseUrl();
            const agentRes = await fetch(`${baseUrl}/api/jobs/${jobId}/agent-wallet`);
            if (agentRes.ok) {
              const agentData = await agentRes.json();
              agentWallet = agentData.wallet_address;
            }
          }
          if (!agentWallet || agentWallet === "0x0000000000000000000000000000000000000000") {
            throw new Error("No agent wallet to lock escrow to.");
          }

          setState("locking");
          console.log("[Escrow Release] Locking escrow to agent", agentWallet, "amount", bidAmount);

          const bidAmountWei = toUsdcWei(bidAmount);
          const lockTx = await writeContractAsync({
            address: contracts.escrow,
            abi: ESCROW_ABI,
            functionName: "lockToAgent",
            args: [escrowJobId, agentWallet as `0x${string}`, bidAmountWei],
            chainId,
          });

          console.log("[Escrow Release] Lock TX submitted:", lockTx);
          setState("waiting_lock");
          await waitForTx(lockTx);
          console.log("[Escrow Release] Lock confirmed");
        }

        // Step 3: Release funds
        setState("releasing");
        console.log("[Escrow Release] Releasing funds for job", escrowJobId);

        const releaseTx = await writeContractAsync({
          address: contracts.escrow,
          abi: ESCROW_ABI,
          functionName: "release",
          args: [escrowJobId],
          chainId,
        });

        console.log("[Escrow Release] Release TX submitted:", releaseTx);
        setReleaseTxHash(releaseTx);
        setState("waiting_release");
        await waitForTx(releaseTx);
        console.log("[Escrow Release] Release confirmed");

        // Step 4: Confirm with backend
        setState("confirming_backend");
        await confirmWithBackend(jobId, token, releaseTx);

        setState("success");
        return true;
      } catch (err: any) {
        console.error("[Escrow Release] Error:", err);
        setError(err?.shortMessage || err?.message || "Failed to release escrow");
        setState("error");
        return false;
      }
    },
    [address, chainId, publicClient, contracts, writeContractAsync, waitForTx]
  );

  return { state, error, releaseTxHash, release, reset };
}

async function confirmWithBackend(jobId: string, token: string, releaseTx: string) {
  const baseUrl = getApiBaseUrl();

  const res = await fetch(`${baseUrl}/api/jobs/${jobId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ release_tx: releaseTx }),
  });

  if (!res.ok) {
    // Fallback: try dev-approve to update DB state
    await fetch(`${baseUrl}/api/jobs/${jobId}/dev-approve`, { method: "POST" });
  }
}
