import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

function securityHeaders(request: Request) {
  const origin = new URL(request.url).origin;
  return {
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  };
}

function corsHeaders(request: Request) {
  return {
    ...securityHeaders(request),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept, Origin",
    "Access-Control-Max-Age": "86400",
  };
}

const payloadSchema = z.object({
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(255),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  company_name: z.string().trim().max(160).optional().or(z.literal("")),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
  // Honeypot — bots fill hidden fields; humans don't.
  website: z.string().max(0).optional().or(z.literal("")),
});

function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...securityHeaders(request) },
  });
}

function redirectHome(request: Request) {
  return Response.redirect(new URL("/", request.url), 302);
}

export const Route = createFileRoute("/api/public/leads-capture-submit")({
  server: {
    handlers: {
      GET: async ({ request }) => redirectHome(request),
      OPTIONS: async ({ request }) =>
        new Response(null, { status: 204, headers: corsHeaders(request) }),
      POST: async ({ request }) => {
        const securityError = validatePublicPost(request);
        if (securityError) return json(request, securityError.body, securityError.status);

        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return json(request, { error: "Invalid JSON", code: "bad_request" }, 400);
        }

        const parsed = payloadSchema.safeParse(raw);
        if (!parsed.success) {
          return json(
            request,
            { error: "Validation failed", code: "validation", issues: parsed.error.flatten() },
            400,
          );
        }
        const data = parsed.data;

        // Honeypot tripped — silently succeed so bots don't retry.
        if (data.website && data.website.length > 0) {
          return json(request, { ok: true }, 200);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const [existingContactRes, repsRes] = await Promise.all([
          supabaseAdmin
            .from("contacts")
            .select("id, assigned_to")
            .eq("email", data.email)
            .is("deleted_at", null)
            .maybeSingle(),
          supabaseAdmin.from("user_roles").select("user_id").eq("role", "rep"),
        ]);

        const existingContact = existingContactRes.data;
        let assignedTo: string | null = null;
        const reps = repsRes.data ?? [];
        if (reps.length > 0) {
          try {
            const counts = await Promise.all(
              reps.map(async (r) => {
                const { count } = await supabaseAdmin
                  .from("leads")
                  .select("id", { count: "exact", head: true })
                  .eq("assigned_to", r.user_id)
                  .in("status", ["new", "contacted", "qualified"]);
                return { id: r.user_id as string, count: count ?? 0 };
              }),
            );
            counts.sort((a, b) => a.count - b.count);
            assignedTo = counts[0]?.id ?? null;
          } catch {
            assignedTo = null;
          }
        }

        if (existingContact?.assigned_to) {
          assignedTo = existingContact.assigned_to as string;
        }

        // Insert the lead.
        const { data: lead, error: insertError } = await supabaseAdmin
          .from("leads")
          .insert({
            first_name: data.first_name,
            last_name: data.last_name,
            email: data.email,
            phone: data.phone || null,
            company_name: data.company_name || null,
            message: data.message || null,
            source: "Tally Landing Page",
            status: "new",
            assigned_to: assignedTo,
            email_status: "pending",
          })
          .select("id")
          .single();

        if (insertError || !lead) {
          return json(request, { error: "Could not save lead", code: "insert_failed" }, 500);
        }

        // Non-critical side effects are intentionally fire-and-forget so the
        // public capture response is gated only by validation and lead insert.
        const dueAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
        void Promise.all([
          supabaseAdmin.from("tasks").insert({
            title: `Make first contact: ${data.first_name} ${data.last_name}`,
            type: "call",
            due_at: dueAt,
            priority: "high",
            assigned_to: assignedTo,
            contact_id: existingContact?.id ?? null,
            notes: `Auto-created from Tally Landing Page lead. Email: ${data.email}`,
          }),
          supabaseAdmin.from("audit_log").insert({
            entity: "lead",
            entity_id: lead.id,
            action: "create",
            actor_id: null,
            metadata: { source: "Tally Landing Page", assigned_to: assignedTo },
          }),
        ]);

        return json(request, { ok: true, lead_id: lead.id }, 200);
      },
    },
  },
});

function validatePublicPost(request: Request) {
  const url = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const isHttps = url.protocol === "https:" || forwardedProto === "https";
  if (process.env.NODE_ENV === "production" && !isHttps) {
    return {
      status: 403,
      body: { error: "HTTPS is required", code: "https_required" },
    };
  }

  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const expectedOrigin = url.origin;
  const sourceOrigin = origin ?? (referer ? new URL(referer).origin : null);
  if (sourceOrigin && sourceOrigin !== expectedOrigin) {
    return {
      status: 403,
      body: { error: "Cross-site submission blocked", code: "csrf" },
    };
  }

  return null;
}
