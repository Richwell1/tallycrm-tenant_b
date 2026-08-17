import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TENANT_NAME } from "@/integrations/supabase/control-plane-client";

export const requestMarketplaceInstall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ featureKey: z.string().trim().min(1) }))
  .handler(async ({ data, context }) => {
    const { data: roleRow, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleError) throw roleError;
    if (!roleRow) throw new Error("Forbidden: admin role required");

    if (!TENANT_NAME) {
      throw new Error("Marketplace configuration is incomplete: VITE_TENANT_NAME is missing.");
    }

    const controlPlaneUrl = process.env.CONTROL_PLANE_URL;
    const controlPlaneServiceKey = process.env.CONTROL_PLANE_SERVICE_KEY;
    if (!controlPlaneUrl || !controlPlaneServiceKey) {
      const missing = [
        ...(!controlPlaneUrl ? ["CONTROL_PLANE_URL"] : []),
        ...(!controlPlaneServiceKey ? ["CONTROL_PLANE_SERVICE_KEY"] : []),
      ];
      throw new Error(`Marketplace server configuration is incomplete: ${missing.join(", ")}.`);
    }

    const { data: userData, error: userError } = await context.supabase.auth.getUser();
    if (userError) throw userError;
    const requestedBy = userData.user?.email || context.userId;

    const { createClient } = await import("@supabase/supabase-js");
    const controlPlane = createClient(controlPlaneUrl, controlPlaneServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    const { data: installRows, error: installError } = await controlPlane.rpc(
      "request_feature_install",
      {
        p_tenant_name: TENANT_NAME,
        p_feature_key: data.featureKey,
        p_requested_by: requestedBy,
      },
    );
    if (installError) throw installError;

    return { install: installRows?.[0] ?? null };
  });
