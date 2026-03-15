"use client";

import { useAuth } from "@/hooks/use-auth";

// This component just initializes the auth hook
// It will auto-sign when wallet connects
export function AuthProvider({ children }: { children: React.ReactNode }) {
  useAuth(); // Initialize auth hook
  return <>{children}</>;
}
