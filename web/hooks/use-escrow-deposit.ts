"use client";

import { useState, useCallback } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useChainId } from "wagmi";
import { keccak256, toHex, pad } from "viem";
import { ERC20_ABI, ESCROW_ABI } from "@/lib/contracts/abis";
import { getContractAddresses, toUsdcWei, fromUsdcWei, USDC_DECIMALS } from "@/lib/contracts/config";
import { confirmEscrowFunding } from "@/lib/api";

export type EscrowDepositState =
  | "idle"
  | "checking_allowance"
  | "approving"
  | "waiting_approve"
  | "depositing"
  | "waiting_deposit"
  | "confirming"
  | "success"
  | "error";

export interface UseEscrowDepositReturn {
  state: EscrowDepositState;
  error: string | null;
  approveTxHash: `0x${string}` | null;
  depositTxHash: `0x${string}` | null;
  usdcBalance: number;
  allowance: number;
  deposit: (jobId: string, amountUsdc: number, token: string) => Promise<boolean>;
  reset: () => void;
}

// Generate escrow job ID (bytes32) from UUID string
function generateEscrowJobId(jobUuid: string): `0x${string}` {
  // Remove hyphens from UUID
  const cleanUuid = jobUuid.replace(/-/g, "");
  // Hash the UUID to get a bytes32
  return keccak256(toHex(cleanUuid));
}

// Get RPC URL for current chain
function getRpcUrl(): string {
  const chainId = process.env.NEXT_PUBLIC_CHAIN_ID;
  return chainId === "196" ? "https://rpc.xlayer.tech" : "https://testrpc.xlayer.tech";
}

// Poll for transaction receipt (5 min timeout for slow testnets)
async function waitForReceipt(txHash: string, maxAttempts = 150): Promise<boolean> {
  const rpcUrl = getRpcUrl();
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getTransactionReceipt",
        params: [txHash],
      }),
    });
    const data = await response.json();
    if (data.result?.status === "0x1") return true;
    if (data.result?.status === "0x0") throw new Error("Transaction failed on-chain");
  }
  return false;
}

export function useEscrowDeposit(): UseEscrowDepositReturn {
  const { address } = useAccount();
  const chainId = useChainId();
  const contracts = getContractAddresses();

  const [state, setState] = useState<EscrowDepositState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [approveTxHash, setApproveTxHash] = useState<`0x${string}` | null>(null);
  const [depositTxHash, setDepositTxHash] = useState<`0x${string}` | null>(null);

  // Read USDC balance
  const { data: balanceData } = useReadContract({
    address: contracts.usdc,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Read current allowance
  const { data: allowanceData, refetch: refetchAllowance } = useReadContract({
    address: contracts.usdc,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, contracts.escrow] : undefined,
    query: { enabled: !!address },
  });

  const usdcBalance = balanceData ? fromUsdcWei(balanceData as bigint) : 0;
  const allowance = allowanceData ? fromUsdcWei(allowanceData as bigint) : 0;

  // Write contract hooks
  const { writeContractAsync: writeApprove } = useWriteContract();
  const { writeContractAsync: writeDeposit } = useWriteContract();

  // Wait for transaction receipts
  const { isLoading: isApproveLoading, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({
    hash: approveTxHash ?? undefined,
  });

  const { isLoading: isDepositLoading, isSuccess: isDepositSuccess } = useWaitForTransactionReceipt({
    hash: depositTxHash ?? undefined,
  });

  const reset = useCallback(() => {
    setState("idle");
    setError(null);
    setApproveTxHash(null);
    setDepositTxHash(null);
  }, []);

  const deposit = useCallback(
    async (jobId: string, amountUsdc: number, token: string): Promise<boolean> => {
      if (!address) {
        setError("Wallet not connected");
        setState("error");
        return false;
      }

      const amountWei = toUsdcWei(amountUsdc);

      try {
        setError(null);
        console.log("[Escrow] Starting deposit flow", { chainId, usdc: contracts.usdc, escrow: contracts.escrow });

        // Step 1: Check allowance
        setState("checking_allowance");
        await refetchAllowance();
        const currentAllowance = allowanceData ? (allowanceData as bigint) : BigInt(0);
        console.log("[Escrow] Current allowance:", currentAllowance.toString(), "needed:", amountWei.toString());

        // Step 2: Approve if needed
        if (currentAllowance < amountWei) {
          setState("approving");
          console.log("[Escrow] Requesting approval for", amountWei.toString(), "to", contracts.escrow);

          const approveTx = await writeApprove({
            address: contracts.usdc,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [contracts.escrow, amountWei],
            chainId,
          });

          console.log("[Escrow] Approval tx submitted:", approveTx);
          setApproveTxHash(approveTx);
          setState("waiting_approve");

          // Wait for approve confirmation
          const approveConfirmed = await waitForReceipt(approveTx);
          if (!approveConfirmed) {
            throw new Error("Approval transaction timed out");
          }

          // Refresh allowance
          await refetchAllowance();
        }

        // Step 3: Deposit to escrow
        setState("depositing");
        const escrowJobId = generateEscrowJobId(jobId);
        console.log("[Escrow] Depositing", amountWei.toString(), "for job", escrowJobId);

        const depositTx = await writeDeposit({
          address: contracts.escrow,
          abi: ESCROW_ABI,
          functionName: "deposit",
          args: [escrowJobId, amountWei],
          chainId,
        });

        console.log("[Escrow] Deposit tx submitted:", depositTx);
        setDepositTxHash(depositTx);
        setState("waiting_deposit");

        // Wait for deposit confirmation
        const depositConfirmed = await waitForReceipt(depositTx);
        if (!depositConfirmed) {
          throw new Error("Deposit transaction timed out");
        }

        // Step 4: Confirm with backend
        setState("confirming");
        await confirmEscrowFunding(jobId, depositTx, token);

        setState("success");
        return true;
      } catch (err: any) {
        console.error("[Escrow] Error:", err);
        console.error("[Escrow] Error details:", JSON.stringify(err, null, 2));
        const errorMsg = err?.shortMessage || err?.message || "Failed to deposit to escrow";
        setError(errorMsg);
        setState("error");
        return false;
      }
    },
    [address, allowanceData, contracts, refetchAllowance, writeApprove, writeDeposit]
  );

  return {
    state,
    error,
    approveTxHash,
    depositTxHash,
    usdcBalance,
    allowance,
    deposit,
    reset,
  };
}
