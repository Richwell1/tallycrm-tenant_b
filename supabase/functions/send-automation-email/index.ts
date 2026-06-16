// Tally CRM — Automation email dispatcher.
// Reads pending rows from public.email_queue, sends each via Resend, and
// records the result. Gated by RESEND_API_KEY — if the key is absent the
// function is a no-op (in-app notifications still work).
//
// Trigger by HTTP POST (manual or scheduled). Edge function secret only;
// never expose RESEND_API_KEY to the client or DB.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-dispatch-secret",
};

type QueueRow = {
  id: string;
  template: string;
  recipient: string;
  subject: string;
  payload: Record<string, unknown>;
  attempts: number;
};

function constantTimeEqual(a: string, b: string) {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  const maxLength = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;

  for (let i = 0; i < maxLength; i += 1) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }

  return diff === 0;
}

function escapeHtml(value: unknown) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderHtml(template: string, payload: Record<string, unknown>): string {
  if (template === "daily_digest") {
    return `<h2>Your Tally CRM digest</h2>
      <p>Today's tasks: <b>${payload.today ?? 0}</b></p>
      <p>Overdue: <b>${payload.overdue ?? 0}</b></p>
      <p>New leads: <b>${payload.new_leads ?? 0}</b></p>`;
  }
  if (template === "landing_lead_confirmation") {
    const first = escapeHtml(payload.first_name ?? "there");
    const company = payload.company_name ? ` at <b>${escapeHtml(payload.company_name)}</b>` : "";
    return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
      <h2 style="margin:0 0 12px">Thanks, ${first} — we've got your request</h2>
      <p>Hi ${first}${company},</p>
      <p>We received your TallyPrime demo request and a member of our team will reach out within one business day to schedule a session.</p>
      <p>If it's urgent, just reply to this email and we'll prioritise it.</p>
      <p style="margin-top:24px">— The TallyPrime team</p>
    </div>`;
  }
  // Generic fallback — payload rendered as a list.
  const items = Object.entries(payload)
    .map(([k, v]) => `<li><b>${escapeHtml(k)}</b>: ${escapeHtml(v)}</li>`)
    .join("");
  return `<h2>${escapeHtml(template)}</h2><ul>${items}</ul>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const AUTOMATION_DISPATCH_SECRET = Deno.env.get("AUTOMATION_DISPATCH_SECRET");
  const FROM_EMAIL = Deno.env.get("AUTOMATION_FROM_EMAIL") ?? "onboarding@resend.dev";

  if (!AUTOMATION_DISPATCH_SECRET) {
    return new Response(JSON.stringify({ ok: false, error: "Dispatcher secret not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const providedSecret = req.headers.get("x-dispatch-secret") ?? "";
  if (!constantTimeEqual(providedSecret, AUTOMATION_DISPATCH_SECRET)) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Pull up to 50 pending rows
  const { data: rows, error } = await supabase
    .from("email_queue")
    .select("id, template, recipient, subject, payload, attempts")
    .eq("status", "pending")
    .lt("attempts", 5)
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!RESEND_API_KEY) {
    // Gracefully skip when sender not configured; mark rows as "skipped".
    if (rows && rows.length > 0) {
      await supabase
        .from("email_queue")
        .update({ status: "skipped", last_error: "RESEND_API_KEY not set" })
        .in(
          "id",
          rows.map((r) => r.id),
        );
    }
    return new Response(
      JSON.stringify({ ok: true, sent: 0, skipped: rows?.length ?? 0, reason: "no_key" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let sent = 0;
  let failed = 0;

  for (const row of (rows ?? []) as QueueRow[]) {
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [row.recipient],
          subject: row.subject,
          html: renderHtml(row.template, row.payload ?? {}),
        }),
      });
      if (!r.ok) {
        const body = await r.text();
        throw new Error(`Resend ${r.status}: ${body.slice(0, 240)}`);
      }
      await supabase
        .from("email_queue")
        .update({ status: "sent", sent_at: new Date().toISOString(), attempts: row.attempts + 1 })
        .eq("id", row.id);
      sent += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await supabase
        .from("email_queue")
        .update({
          status: row.attempts + 1 >= 5 ? "failed" : "pending",
          attempts: row.attempts + 1,
          last_error: msg,
        })
        .eq("id", row.id);
      failed += 1;
    }
  }

  return new Response(JSON.stringify({ ok: true, sent, failed }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
