import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  disableLocalPreview,
  isLocalPreviewEnabled,
  isSupabaseConfigured,
  supabase,
} from "@/integrations/supabase/client";
import { clearMfaSession } from "@/lib/mfa-session";
import type { CurrentUser, Role } from "@/types";

interface AuthContextValue {
  user: CurrentUser | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    if (!isSupabaseConfigured()) {
      setUser(
        isLocalPreviewEnabled()
          ? {
              id: "local-preview-admin",
              fullName: "Local Preview Admin",
              email: "preview@example.com",
              avatarUrl: null,
              role: "admin",
            }
          : null,
      );
      setIsLoading(false);
      return () => {
        mounted = false;
      };
    }

    async function hydrate(userId: string | undefined, email: string | null | undefined) {
      if (!userId) {
        if (mounted) {
          setUser(null);
          setIsLoading(false);
        }
        return;
      }
      // Fetch profile + role in parallel
      const [profileRes, roleRes] = await Promise.all([
        supabase.from("profiles").select("full_name,avatar_url").eq("id", userId).maybeSingle(),
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .order("role", { ascending: true })
          .limit(1)
          .maybeSingle(),
      ]);
      if (!mounted) return;
      const role = (roleRes.data?.role as Role | undefined) ?? "rep";
      setUser({
        id: userId,
        fullName: profileRes.data?.full_name || email || "User",
        email: email ?? "",
        avatarUrl: profileRes.data?.avatar_url ?? null,
        role,
      });
      setIsLoading(false);
    }

    supabase.auth
      .getUser()
      .then(({ data }) => hydrate(data.user?.id, data.user?.email))
      .catch((err: unknown) => {
        console.warn("[Auth] Could not hydrate Supabase user", err);
        if (mounted) {
          setUser(null);
          setIsLoading(false);
        }
      });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") {
        return;
      }
      if (event === "SIGNED_OUT") {
        setUser(null);
        return;
      }
      hydrate(session?.user?.id, session?.user?.email);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    clearMfaSession();
    if (!isSupabaseConfigured()) {
      disableLocalPreview();
      setUser(null);
      navigate({ to: "/auth", replace: true });
      return;
    }
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, signOut }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function useCurrentRole(): Role | null {
  return useAuth().user?.role ?? null;
}
