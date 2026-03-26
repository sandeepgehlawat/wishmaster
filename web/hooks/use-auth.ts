"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import { useAccount, useSignMessage, useDisconnect } from "wagmi";
import { useAuthStore } from "@/lib/store";
import { getChallenge, verifySignature, getApiBaseUrl } from "@/lib/api";

// Track sign-out state globally (persists across re-renders)
let globalSignedOut = false;

export function useAuth() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnectAsync } = useDisconnect();
  const { token, user, setAuth, clearAuth, _hasHydrated } = useAuthStore();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasAttemptedAutoSignIn = useRef(false);
  const lastWalletAddress = useRef<string | null>(null);

  const signIn = useCallback(async () => {
    if (!address || !signMessageAsync || isSigningIn || globalSignedOut) {
      return;
    }

    setIsSigningIn(true);
    setError(null);

    try {
      const walletAddress = address;
      const { message } = await getChallenge(walletAddress);
      const signature = await signMessageAsync({ message });
      const result = await verifySignature(walletAddress, message, signature);
      setAuth(result.token, result.user);
      setError(null);
    } catch (error: any) {
      setError(error.message || "Sign in failed");
      // Don't clear auth here — it would trigger auto sign-in loop
    } finally {
      setIsSigningIn(false);
    }
  }, [address, signMessageAsync, setAuth, isSigningIn]);

  const signOut = useCallback(async () => {
    // Set global flag FIRST to prevent auto sign-in from firing
    globalSignedOut = true;

    // Clear all auth state
    clearAuth();
    setError(null);
    hasAttemptedAutoSignIn.current = false;
    lastWalletAddress.current = null;

    // Clear persisted storage
    try { localStorage.removeItem("wishmaster-auth"); } catch {}

    // Disconnect wallet (async)
    try {
      await disconnectAsync();
    } catch {}
  }, [clearAuth, disconnectAsync]);

  // Auto sign-in when wallet connects and no token (after hydration)
  useEffect(() => {
    const walletAddress = address || null;

    // If wallet address changed, user reconnected manually — allow sign-in again
    if (walletAddress && walletAddress !== lastWalletAddress.current) {
      hasAttemptedAutoSignIn.current = false;
      // Only reset globalSignedOut if this is a NEW address (not re-connect of same)
      if (lastWalletAddress.current !== null) {
        globalSignedOut = false;
      }
      lastWalletAddress.current = walletAddress;
    }

    // If wallet disconnected, reset tracking
    if (!walletAddress) {
      lastWalletAddress.current = null;
      return;
    }

    if (
      _hasHydrated &&
      isConnected &&
      address &&
      !token &&
      !isSigningIn &&
      !hasAttemptedAutoSignIn.current &&
      !globalSignedOut
    ) {
      hasAttemptedAutoSignIn.current = true;
      signIn();
    }
  }, [_hasHydrated, isConnected, address, token, signIn, isSigningIn]);

  // Clear auth when wallet disconnects externally (e.g. from MetaMask)
  useEffect(() => {
    if (!isConnected && token) {
      clearAuth();
      hasAttemptedAutoSignIn.current = false;
      lastWalletAddress.current = null;
      try { localStorage.removeItem("wishmaster-auth"); } catch {}
    }
  }, [isConnected, token, clearAuth]);

  // Validate token on mount — if API returns 401, clear auth
  useEffect(() => {
    if (_hasHydrated && token && isConnected) {
      fetch(`${getApiBaseUrl()}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(res => {
        if (res.status === 401) {
          console.log("[Auth] Token invalid, clearing auth");
          clearAuth();
          try { localStorage.removeItem("wishmaster-auth"); } catch {}
        }
      }).catch(() => {});
    }
  }, [_hasHydrated, token, isConnected, clearAuth]);

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
