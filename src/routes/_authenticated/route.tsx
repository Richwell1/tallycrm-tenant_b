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
    return { user: data.user };
  },
  component: () => <Outlet />,
});
