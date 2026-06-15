import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import {
  isLocalPreviewEnabled,
  isSupabaseConfigured,
  supabase,
} from "@/integrations/supabase/client";

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
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }
    // AAL2 (MFA) gate — block CRM unless session is fully verified.
    const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const next = aal.data?.nextLevel ?? "aal1";
    const current = aal.data?.currentLevel ?? "aal1";
    if (next === "aal2" && current !== "aal2") {
      throw redirect({ to: "/auth/mfa" });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
