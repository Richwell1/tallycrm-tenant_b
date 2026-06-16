import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Admin-only: reset (unenroll) all MFA factors for a target user.
 * The next time that user signs in they will be forced to enroll a new TOTP factor.
 */
export const adminResetUserMfa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const input = data as { userId?: string };
    if (!input?.userId || typeof input.userId !== "string") {
      throw new Error("userId is required");
    }
    return { userId: input.userId };
  })
  .handler(async ({ data, context }) => {
    // Caller must be an admin.
    const { data: roleRow, error: roleErr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleErr) throw roleErr;
    if (!roleRow) throw new Error("Forbidden: admin role required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: factorsRes, error: listErr } = await supabaseAdmin.auth.admin.mfa.listFactors({
      userId: data.userId,
    });
    if (listErr) throw listErr;

    let removed = 0;
    for (const factor of factorsRes?.factors ?? []) {
      const { error: delErr } = await supabaseAdmin.auth.admin.mfa.deleteFactor({
        userId: data.userId,
        id: factor.id,
      });
      if (delErr) throw delErr;
      removed += 1;
    }
    return { ok: true, removed };
  });
