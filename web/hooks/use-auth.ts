"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import { useAccount, useSignMessage, useDisconnect } from "wagmi";
import { useAuthStore } from "@/lib/store";
import { getChallenge, verifySignature } from "@/lib/api";

export function useAuth() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();
  const { token, user, setAuth, clearAuth, _hasHydrated } = useAuthStore();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasAttemptedAutoSignIn = useRef(false);
  const lastWalletAddress = useRef<string | null>(null);

  const signIn = useCallback(async () => {
    if (!address || !signMessageAsync) {
      return;
    }

    if (isSigningIn) {
      return;
    }

    setIsSigningIn(true);
    setError(null);

    try {
      // Get challenge from backend
      const walletAddress = address;
      const { message } = await getChallenge(walletAddress);

      // Sign the message using EVM personal_sign
      const signature = await signMessageAsync({ message });

      // Verify and get token (signature is already hex-encoded from wagmi)
      const result = await verifySignature(walletAddress, message, signature);
      setAuth(result.token, result.user);
      setError(null);
    } catch (error: any) {
      setError(error.message || "Sign in failed");
      // Don't clear auth on error - might be network issue
    } finally {
      setIsSigningIn(false);
    }
  }, [address, signMessageAsync, setAuth]);

  const signOut = useCallback(() => {
    clearAuth();
    disconnect();
    hasAttemptedAutoSignIn.current = false;
    lastWalletAddress.current = null;
    setError(null);
  }, [clearAuth, disconnect]);

  // Auto sign-in when wallet connects and no token (after hydration)
  // Only attempt once per wallet connection
  useEffect(() => {
    const walletAddress = address || null;

    // Reset attempt flag if wallet changed
    if (walletAddress !== lastWalletAddress.current) {
      hasAttemptedAutoSignIn.current = false;
      lastWalletAddress.current = walletAddress;
    }

    if (
      _hasHydrated &&
      isConnected &&
      address &&
      !token &&
      !isSigningIn &&
      !hasAttemptedAutoSignIn.current
    ) {
      hasAttemptedAutoSignIn.current = true;
      signIn();
    }
  }, [_hasHydrated, isConnected, address, token, signIn, isSigningIn]);

  // Clear auth when wallet disconnects
  useEffect(() => {
    if (!isConnected && token) {
      clearAuth();
      hasAttemptedAutoSignIn.current = false;
      lastWalletAddress.current = null;
    }
  }, [isConnected, token, clearAuth]);

  return {
    isAuthenticated: !!token && _hasHydrated,
    isLoading: !_hasHydrated || isSigningIn,
    user,
    token,
    error,
    signIn,
    signOut,
  };
}
