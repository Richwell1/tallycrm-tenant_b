import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import {
  isLocalPreviewEnabled,
  isSupabaseConfigured,
  supabase,
} from "@/integrations/supabase/client";
import { clearMfaSession, hasFreshMfaSession, touchMfaSession } from "@/lib/mfa-session";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    if (!isSupabaseConfigured()) {
      if (!isLocalPreviewEnabled()) {
        throw redirect({ to: "/auth" });
      }
      return {
        user: {
          id: "local-preview-admin",
          email: "preview@example.com",
        },
      };
    }
    const { data, error } = await supabase.auth.getUser().catch((err: unknown) => {
      console.warn("[Auth] Could not reach Supabase auth", err);
      return { data: { user: null }, error: err };
    });
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }
    // AAL2 (MFA) gate — block CRM unless session is fully verified.
    const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel().catch((err: unknown) => {
      console.warn("[Auth] Could not check MFA assurance level", err);
      return { data: { currentLevel: "aal1", nextLevel: "aal1" } };
    });
    const current = aal.data?.currentLevel ?? "aal1";
    if (current !== "aal2" || !hasFreshMfaSession(data.user.id)) {
      clearMfaSession();
      throw redirect({ to: "/mfa" });
    }
    touchMfaSession(data.user.id);
    return { user: data.user };
  },
  component: () => <Outlet />,
});
