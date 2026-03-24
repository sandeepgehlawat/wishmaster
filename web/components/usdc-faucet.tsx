"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { Loader2, Droplets, CheckCircle } from "lucide-react";
import { ERC20_ABI } from "@/lib/contracts/abis";
import { getContractAddresses, toUsdcWei, fromUsdcWei, getActiveChainId } from "@/lib/contracts/config";

const FAUCET_AMOUNT = 1000;

interface UsdcFaucetProps {
  hideAboveBalance?: number; // Hide faucet if balance exceeds this
}

export default function UsdcFaucet({ hideAboveBalance }: UsdcFaucetProps = {}) {
  const { address, isConnected } = useAccount();
  const contracts = getContractAddresses();
  const chainId = getActiveChainId();

  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [claimed, setClaimed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: rawBalance, refetch: refetchBalance } = useReadContract({
    address: contracts.usdc,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });

  const balance = rawBalance ? fromUsdcWei(rawBalance as bigint) : 0;

  const { writeContractAsync, isPending: isMinting } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  useEffect(() => {
    if (isConfirmed && !claimed) {
      setClaimed(true);
      refetchBalance();
      setTimeout(() => {
        setClaimed(false);
        setTxHash(undefined);
      }, 3000);
    }
  }, [isConfirmed, claimed, refetchBalance]);

  const handleClaim = async () => {
    if (!address || !isConnected) return;
    try {
      setError(null);
      setClaimed(false);
      const hash = await writeContractAsync({
        address: contracts.usdc,
        abi: ERC20_ABI,
        functionName: "mint",
        args: [address, toUsdcWei(FAUCET_AMOUNT)],
      });
      setTxHash(hash);
    } catch (e: any) {
      setError(e.shortMessage || e.message || "Mint failed");
    }
  };

  if (!mounted || !isConnected) return null;
  if (chainId !== 1952 && chainId !== 31337) return null;
  if (hideAboveBalance !== undefined && balance >= hideAboveBalance) return null;

  const isProcessing = isMinting || isConfirming;

  return (
    <div className="border-2 border-cyan-400/30 bg-cyan-400/5 p-4 font-mono">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Droplets className="h-4 w-4 text-cyan-400" />
            <span className="text-xs text-cyan-400 font-bold tracking-wider">TESTNET_FAUCET</span>
          </div>
          <p className="text-xs text-white/50">
            Claim {FAUCET_AMOUNT} test USDC for escrow funding
          </p>
          <p className="text-sm font-bold mt-1">Balance: {balance.toFixed(2)} USDC</p>
        </div>

        <button
          onClick={handleClaim}
          disabled={isProcessing}
          className={`border-2 px-4 py-2 text-sm font-bold tracking-wider transition-colors disabled:opacity-50 flex items-center gap-2 ${
            claimed
              ? "border-green-400 text-green-400"
              : "border-cyan-400 text-cyan-400 hover:bg-cyan-400 hover:text-black"
          }`}
        >
          {isMinting && (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> MINTING...
            </>
          )}
          {isConfirming && !isMinting && (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> CONFIRMING...
            </>
          )}
          {claimed && (
            <>
              <CheckCircle className="h-4 w-4" /> CLAIMED!
            </>
          )}
          {!isProcessing && !claimed && (
            <>
              <Droplets className="h-4 w-4" /> [CLAIM {FAUCET_AMOUNT} USDC]
            </>
          )}
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-400 mt-2">{error}</p>
      )}
    </div>
  );
}
