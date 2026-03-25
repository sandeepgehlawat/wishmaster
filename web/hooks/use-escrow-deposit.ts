"use client";

import { useState, useCallback } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useChainId, usePublicClient, useBalance, useSwitchChain } from "wagmi";
import { keccak256, toHex, pad, formatEther } from "viem";
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


export function useEscrowDeposit(): UseEscrowDepositReturn {
  const { address, chain } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { switchChainAsync } = useSwitchChain();
  const contracts = getContractAddresses();

  const [state, setState] = useState<EscrowDepositState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [approveTxHash, setApproveTxHash] = useState<`0x${string}` | null>(null);
  const [depositTxHash, setDepositTxHash] = useState<`0x${string}` | null>(null);

  // Read native balance (OKB for gas)
  const { data: nativeBalance } = useBalance({ address });

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

      // Check and switch network if needed
      const expectedChainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "1952");
      console.log("[Escrow] Wallet chain:", chain?.id, "Expected:", expectedChainId);

      // Force add/switch network with correct RPC
      try {
        const isTestnet = expectedChainId === 1952;
        await (window as any).ethereum?.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: `0x${expectedChainId.toString(16)}`,
            chainName: isTestnet ? 'X Layer Testnet' : 'X Layer',
            nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
            rpcUrls: [isTestnet ? 'https://testrpc.xlayer.tech' : 'https://rpc.xlayer.tech'],
            blockExplorerUrls: [isTestnet ? 'https://www.oklink.com/xlayer-test' : 'https://www.oklink.com/xlayer'],
          }],
        });
        console.log("[Escrow] Network config sent to wallet");
      } catch (addError: any) {
        // 4001 = user rejected, which is fine if already on correct network
        if (addError.code !== 4001) {
          console.log("[Escrow] wallet_addEthereumChain result:", addError.message);
        }
      }

      if (chain?.id !== expectedChainId) {
        console.log("[Escrow] Switching to chain", expectedChainId);
        try {
          await switchChainAsync({ chainId: expectedChainId });
          console.log("[Escrow] Chain switched successfully");
          // Small delay for wallet to update
          await new Promise(r => setTimeout(r, 1000));
        } catch (switchError: any) {
          console.error("[Escrow] Chain switch failed:", switchError);
          setError(`Please switch to X Layer ${expectedChainId === 196 ? 'Mainnet' : 'Testnet'} in your wallet`);
          setState("error");
          return false;
        }
      }

      // Check for gas (native token) - recheck after potential chain switch
      const gasBalance = nativeBalance?.value ?? BigInt(0);
      console.log("[Escrow] Native balance (OKB):", formatEther(gasBalance));
      if (gasBalance < BigInt(1e15)) { // Less than 0.001 OKB
        setError("Insufficient OKB for gas. Get testnet OKB from: https://www.okx.com/xlayer/faucet");
        setState("error");
        return false;
      }

      const amountWei = toUsdcWei(amountUsdc);

      try {
        setError(null);
        console.log("[Escrow] Starting deposit flow", { chainId, usdc: contracts.usdc, escrow: contracts.escrow, gasBalance: formatEther(gasBalance) });

        // Step 1: Check allowance
        setState("checking_allowance");
        const { data: freshAllowance } = await refetchAllowance();
        const currentAllowance = freshAllowance ? (freshAllowance as bigint) : BigInt(0);
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

          // Verify TX was actually broadcast by checking it exists
          if (!publicClient) throw new Error("No public client available");

          // Quick check if TX exists in mempool/chain
          let txExists = false;
          for (let i = 0; i < 5; i++) {
            try {
              const tx = await publicClient.getTransaction({ hash: approveTx });
              if (tx) {
                txExists = true;
                console.log("[Escrow] TX found in mempool/chain:", tx.hash);
                break;
              }
            } catch (e) {
              // TX not found yet, wait and retry
            }
            await new Promise(r => setTimeout(r, 2000));
          }

          if (!txExists) {
            console.error("[Escrow] TX not found on chain after 10s - wallet may have failed to broadcast");
            throw new Error("Transaction not broadcast. Please check your wallet's network RPC settings.");
          }

          const approveReceipt = await publicClient.waitForTransactionReceipt({
            hash: approveTx,
            timeout: 300_000, // 5 minutes
          });
          console.log("[Escrow] Approval confirmed:", approveReceipt.status);
          if (approveReceipt.status !== "success") {
            throw new Error("Approval transaction failed on-chain");
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

        // Wait for deposit confirmation using wagmi's publicClient
        if (!publicClient) throw new Error("No public client available");
        const depositReceipt = await publicClient.waitForTransactionReceipt({
          hash: depositTx,
          timeout: 300_000, // 5 minutes
        });
        console.log("[Escrow] Deposit confirmed:", depositReceipt.status);
        if (depositReceipt.status !== "success") {
          throw new Error("Deposit transaction failed on-chain");
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
    [address, chain, switchChainAsync, nativeBalance, chainId, publicClient, contracts, refetchAllowance, writeApprove, writeDeposit]
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
