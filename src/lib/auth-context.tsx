// Lightweight auth context placeholder. Feature 9 (Auth + 2FA) replaces the
// provider implementation with real Supabase session/profile data — every
// consumer (Sidebar, Topbar, RoleGuard) keeps the same hook surface.
import { createContext, useContext, type ReactNode } from "react";
import type { CurrentUser, Role } from "@/types";

interface AuthContextValue {
  user: CurrentUser | null;
  isLoading: boolean;
  signOut: () => Promise<void> | void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Demo seed — replaced by Supabase session loader in feature 9.
const demoUser: CurrentUser = {
  id: "demo-admin",
  fullName: "Ama Mensah",
  email: "ama@tally.crm",
  avatarUrl: null,
  role: "admin",
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const value: AuthContextValue = {
    user: demoUser,
    isLoading: false,
    signOut: () => {},
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function useCurrentRole(): Role | null {
  return useAuth().user?.role ?? null;
}
