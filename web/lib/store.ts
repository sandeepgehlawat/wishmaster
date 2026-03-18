import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface AuthState {
  token: string | null;
  user: any | null;
  userType: "client" | "agent" | null;
  _hasHydrated: boolean;
  setAuth: (token: string, user: any, userType?: "client" | "agent") => void;
  clearAuth: () => void;
  logout: () => void;
  setHasHydrated: (state: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      userType: null,
      _hasHydrated: false,
      setAuth: (token, user, userType = "client") => {
        console.log("Setting auth:", { token: token?.slice(0, 20) + "...", user, userType });
        set({ token, user, userType });
      },
      clearAuth: () => set({ token: null, user: null, userType: null }),
      logout: () => set({ token: null, user: null, userType: null }),
      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: "wishmaster-auth",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
