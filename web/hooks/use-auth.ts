"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAuthStore } from "@/lib/store";
import { getChallenge, verifySignature } from "@/lib/api";
import bs58 from "bs58";

export function useAuth() {
  const { publicKey, signMessage, connected, disconnect } = useWallet();
  const { token, user, setAuth, clearAuth, _hasHydrated } = useAuthStore();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasAttemptedAutoSignIn = useRef(false);
  const lastWalletAddress = useRef<string | null>(null);

  const signIn = useCallback(async () => {
    if (!publicKey || !signMessage) {
      console.log("No wallet connected or signMessage not available");
      return;
    }

    if (isSigningIn) {
      console.log("Already signing in...");
      return;
    }

    setIsSigningIn(true);
    setError(null);

    try {
      // Get challenge from backend
      const walletAddress = publicKey.toBase58();
      console.log("Getting challenge for:", walletAddress);
      const { message } = await getChallenge(walletAddress);
      console.log("Got challenge, signing message...");

      // Sign the message
      const encodedMessage = new TextEncoder().encode(message);
      const signatureBytes = await signMessage(encodedMessage);
      const signature = bs58.encode(signatureBytes);
      console.log("Message signed, verifying...");
      console.log("Signature length:", signature.length);

      // Verify and get token
      const result = await verifySignature(walletAddress, message, signature);
      console.log("Verification result:", result);
      setAuth(result.token, result.user);
      setError(null);

      console.log("Signed in successfully!");
    } catch (error: any) {
      console.error("Sign in failed:", error);
      setError(error.message || "Sign in failed");
      // Don't clear auth on error - might be network issue
    } finally {
      setIsSigningIn(false);
    }
  }, [publicKey, signMessage, setAuth]);

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
    const walletAddress = publicKey?.toBase58() || null;

    // Reset attempt flag if wallet changed
    if (walletAddress !== lastWalletAddress.current) {
      hasAttemptedAutoSignIn.current = false;
      lastWalletAddress.current = walletAddress;
    }

    if (
      _hasHydrated &&
      connected &&
      publicKey &&
      !token &&
      !isSigningIn &&
      !hasAttemptedAutoSignIn.current
    ) {
      console.log("Auto sign-in triggered (first attempt)");
      hasAttemptedAutoSignIn.current = true;
      signIn();
    }
  }, [_hasHydrated, connected, publicKey, token, signIn, isSigningIn]);

  // Clear auth when wallet disconnects
  useEffect(() => {
    if (!connected && token) {
      clearAuth();
      hasAttemptedAutoSignIn.current = false;
      lastWalletAddress.current = null;
    }
  }, [connected, token, clearAuth]);

  // Debug logging
  useEffect(() => {
    console.log("Auth state:", {
      connected,
      hasToken: !!token,
      hasHydrated: _hasHydrated,
      isSigningIn,
      error,
      hasAttemptedAutoSignIn: hasAttemptedAutoSignIn.current
    });
  }, [connected, token, _hasHydrated, isSigningIn, error]);

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
