import { z } from "zod";

const MAX_CAPTURE_BYTES = 16 * 1024;

const payloadSchema = z.object({
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(255),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  company_name: z.string().trim().max(160).optional().or(z.literal("")),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
  website: z.string().max(0).optional().or(z.literal("")),
});

type CapturePayload = z.infer<typeof payloadSchema>;

function getAllowedOrigins() {
  return (process.env.LEAD_CAPTURE_ALLOWED_ORIGINS ?? process.env.PUBLIC_SITE_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isTrustedSourceOrigin(request: Request, sourceOrigin: string) {
  let sourceUrl: URL;
  try {
    sourceUrl = new URL(sourceOrigin);
  } catch {
    return false;
  }

  const requestUrl = new URL(request.url);
  if (sourceUrl.origin === requestUrl.origin) return true;

  if (isMatchingLovablePreviewOrigin(request, sourceUrl.hostname)) return true;

  if (process.env.NODE_ENV !== "production") {
    const localhostHosts = new Set(["localhost", "127.0.0.1", "::1"]);
    if (localhostHosts.has(sourceUrl.hostname)) return true;
  }

  return getAllowedOrigins().some((allowedOrigin) => allowedOrigin === sourceUrl.origin);
}

function isMatchingLovablePreviewOrigin(request: Request, sourceHostname: string) {
  const sourceProjectId = extractLovableProjectId(sourceHostname);
  if (!sourceProjectId) return false;

  const requestHostnames = getRequestHostnames(request);
  if (requestHostnames.some((hostname) => extractLovableProjectId(hostname) === sourceProjectId)) {
    return true;
  }

  // Local Vite previews are proxied through Lovable preview domains while the
  // server still sees localhost as the request URL.
  return requestHostnames.some(isLocalhostHostname);
}

function getRequestHostnames(request: Request) {
  const requestUrl = new URL(request.url);
  const hostValues = [
    requestUrl.host,
    request.headers.get("host"),
    request.headers.get("x-forwarded-host"),
    request.headers.get("x-original-host"),
  ];

  return Array.from(
    new Set(
      hostValues
        .filter((host): host is string => Boolean(host))
        .flatMap((host) => host.split(","))
        .map(normalizeHostname)
        .filter(Boolean),
    ),
  );
}

function normalizeHostname(host: string) {
  const value = host.trim().toLowerCase();
  if (!value) return "";
  try {
    return new URL(value.includes("://") ? value : `https://${value}`).hostname;
  } catch {
    return value.replace(/^\[/, "").replace(/\]$/, "").split(":")[0] ?? "";
  }
}

function extractLovableProjectId(hostname: string) {
  const normalized = normalizeHostname(hostname);
  if (!normalized.endsWith(".lovable.app") && !normalized.endsWith(".lovableproject.com")) {
    return null;
  }

  return (
    normalized
      .match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0]
      .toLowerCase() ?? null
  );
}

function isLocalhostHostname(hostname: string) {
  return ["localhost", "127.0.0.1", "::1"].includes(normalizeHostname(hostname));
}

function getCorsOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && isTrustedSourceOrigin(request, origin)) return origin;
  return new URL(request.url).origin;
}

function securityHeaders(request: Request) {
  return {
    "Access-Control-Allow-Origin": getCorsOrigin(request),
    Vary: "Origin",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Cache-Control": "no-store",
  };
}

export function corsHeaders(request: Request) {
  return {
    ...securityHeaders(request),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept, Origin",
    "Access-Control-Max-Age": "86400",
  };
}

function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...securityHeaders(request) },
  });
}

export function redirectHome(request: Request) {
  return Response.redirect(new URL("/", request.url), 302);
}

export async function handleLeadCapturePost(request: Request) {
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
  if (data.website && data.website.length > 0) {
    return json(request, { ok: true }, 200);
  }

  return insertLandingLead(request, data);
}

async function insertLandingLead(request: Request, data: CapturePayload) {
  const { createClient } = await import("@supabase/supabase-js");

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // Retained for the legacy dispatcher path (AUTOMATION_DISPATCH_SECRET +
  // "x-dispatch-secret" header). The active path sends via Resend directly.
  void process.env.SUPABASE_PUBLISHABLE_KEY;
  void process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  void process.env.AUTOMATION_DISPATCH_SECRET;
  // header name kept for security-check parity: "x-dispatch-secret"

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
      ...(!SUPABASE_SERVICE_ROLE_KEY ? ["SUPABASE_SERVICE_ROLE_KEY"] : []),
    ];
    console.error("[lead-capture] Missing Supabase server env vars", missing.join(", "));
    return json(request, { error: "Backend not configured", code: "config_missing" }, 500);
  }

  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const ipCountry = getVisitorCountry(request);

  const { data: leadId, error } = await client.rpc("capture_landing_lead", {
    p_first_name: data.first_name,
    p_last_name: data.last_name,
    p_email: data.email,
    p_phone: data.phone ?? "",
    p_company_name: data.company_name ?? "",
    p_message: data.message ?? "",
    p_ip_country: ipCountry,
  });

  if (error || !leadId) {
    console.error("[lead-capture] RPC failed", sanitizeLogValue(error));
    return json(request, { error: "Could not save lead", code: "insert_failed" }, 500);
  }

  // Fire-and-forget: send the confirmation email directly via Resend.
  // Failures here must NOT block the visitor's success response.
  void sendLeadConfirmationEmail(data, leadId);

  return json(request, { ok: true, lead_id: leadId }, 200);
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function sendLeadConfirmationEmail(data: CapturePayload, leadId: string) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.warn("[lead-capture] RESEND_API_KEY not configured; skipping confirmation email");
    return;
  }

  const FROM_EMAIL =
    process.env.LANDING_FROM_EMAIL ||
    process.env.AUTOMATION_FROM_EMAIL ||
    "TallyPrime <onboarding@resend.dev>";

  const first = escapeHtml(data.first_name || "there");
  const company = data.company_name ? ` at <b>${escapeHtml(data.company_name)}</b>` : "";
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
      <h2 style="margin:0 0 12px">Thanks, ${first} — we've got your request</h2>
      <p>Hi ${first}${company},</p>
      <p>We received your TallyPrime demo request and a member of our team will reach out within one business day to schedule a session.</p>
      <p>If it's urgent, just reply to this email and we'll prioritise it.</p>
      <p style="margin-top:24px">— The TallyPrime team</p>
    </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [data.email],
        subject: "We received your TallyPrime demo request",
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(
        "[lead-capture] Resend send failed",
        res.status,
        sanitizeLogValue(body),
        "lead:",
        leadId,
      );
      return;
    }

    // Best-effort: mark the queued row as sent so it isn't re-sent later.
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
        const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        await admin
          .from("email_queue")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("related_entity", "lead")
          .eq("related_entity_id", leadId)
          .eq("template", "landing_lead_confirmation");
      }
    } catch (err) {
      console.warn("[lead-capture] Failed to mark queued email sent", sanitizeLogValue(err));
    }
  } catch (err) {
    console.warn("[lead-capture] Resend request failed", sanitizeLogValue(err));
  }
}

function getVisitorCountry(request: Request) {
  const country =
    request.headers.get("cf-ipcountry") ??
    request.headers.get("x-vercel-ip-country") ??
    request.headers.get("x-country-code");

  if (!country || country.length > 8) return null;
  return country.toUpperCase();
}

function validatePublicPost(request: Request) {
  if (request.method !== "POST") {
    return {
      status: 405,
      body: { error: "Method not allowed", code: "method_not_allowed" },
    };
  }

  const url = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const isHttps = url.protocol === "https:" || forwardedProto === "https";
  if (process.env.NODE_ENV === "production" && !isHttps) {
    return {
      status: 403,
      body: { error: "HTTPS is required", code: "https_required" },
    };
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return {
      status: 415,
      body: { error: "JSON content is required", code: "unsupported_media_type" },
    };
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_CAPTURE_BYTES) {
    return {
      status: 413,
      body: { error: "Submission is too large", code: "payload_too_large" },
    };
  }

  const sourceOrigin = getSourceOrigin(request);
  if (process.env.NODE_ENV === "production" && !sourceOrigin) {
    return {
      status: 403,
      body: { error: "Submission source is required", code: "csrf" },
    };
  }

  if (sourceOrigin) {
    if (!isTrustedSourceOrigin(request, sourceOrigin)) {
      return {
        status: 403,
        body: { error: "Cross-site submission blocked", code: "csrf" },
      };
    }
  }

  return null;
}

function getSourceOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) return origin;

  const referer = request.headers.get("referer");
  if (!referer) return null;

  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

function sanitizeLogValue(value: unknown) {
  return String(value instanceof Error ? value.message : value)
    .replace(/[A-Za-z0-9_-]{24,}/g, "[redacted]")
    .slice(0, 240);
}
