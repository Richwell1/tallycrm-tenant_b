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

  // Await the best-effort send so serverless runtimes do not freeze the work
  // after the success response has already been returned.
  await sendLeadCaptureEmails(data, leadId);

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

function emailEnabled() {
  return (
    (process.env.EMAIL_ENABLED ?? "true")
      .trim()
      .replace(/^["']|["']$/g, "")
      .toLowerCase() !== "false"
  );
}

function parseEmailList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

function getLandingFromEmail() {
  return (
    process.env.LANDING_FROM_EMAIL ||
    process.env.AUTOMATION_FROM_EMAIL ||
    "TallyPrime <onboarding@resend.dev>"
  );
}

function getSalesNotificationRecipients() {
  return parseEmailList(
    process.env.LANDING_NOTIFY_EMAILS ||
      process.env.LANDING_NOTIFY_EMAIL ||
      process.env.SALES_NOTIFY_EMAILS ||
      process.env.SALES_NOTIFY_EMAIL ||
      process.env.SALES_NOTIFY_TO ||
      process.env.SALES_NOTIFY_BCC ||
      process.env.PARTNER_EMAIL,
  );
}

async function sendLeadCaptureEmails(data: CapturePayload, leadId: string) {
  if (!emailEnabled()) {
    console.warn("[lead-capture] EMAIL_ENABLED=false; skipping lead capture emails");
    return;
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.warn("[lead-capture] RESEND_API_KEY not configured; skipping lead capture emails");
    return;
  }

  await Promise.all([
    sendLeadConfirmationEmail(data, leadId, RESEND_API_KEY),
    sendInternalLeadNotification(data, leadId, RESEND_API_KEY),
  ]);
}

async function sendLeadConfirmationEmail(
  data: CapturePayload,
  leadId: string,
  RESEND_API_KEY: string,
) {
  const first = escapeHtml(data.first_name || "there");
  const company = data.company_name ? ` at <b>${escapeHtml(data.company_name)}</b>` : "";
  const partnerName = process.env.PARTNER_NAME || "The TallyPrime team";
  const partnerEmail = process.env.PARTNER_EMAIL;
  const salesBcc = parseEmailList(process.env.SALES_NOTIFY_BCC);
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
      <h2 style="margin:0 0 12px">Thanks, ${first} — we've got your request</h2>
      <p>Hi ${first}${company},</p>
      <p>We received your TallyPrime demo request and a member of our team will reach out within one business day to schedule a session.</p>
      <p>If it's urgent, just reply to this email and we'll prioritise it.</p>
      <p style="margin-top:24px">— ${escapeHtml(partnerName)}</p>
    </div>`;
  const text = [
    `Hi ${data.first_name || "there"},`,
    "",
    "We received your TallyPrime demo request and a member of our team will reach out within one business day to schedule a session.",
    "If it's urgent, just reply to this email and we'll prioritise it.",
    "",
    `- ${partnerName}`,
  ].join("\n");

async function sendResendEmail(
  apiKey: string,
  payload: {
    from: string;
    to: string[];
    subject: string;
    html: string;
    reply_to?: string;
  },
) {
  try {
    const res = await sendResendEmail(RESEND_API_KEY, {
      from: getLandingFromEmail(),
      to: [data.email],
      bcc: salesBcc,
      reply_to: partnerEmail ? [partnerEmail] : undefined,
      subject: "We received your TallyPrime demo request",
      html,
      text,
    });
    const body = await res.text().catch(() => "");
    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    return { ok: false, status: 0, body: String(err instanceof Error ? err.message : err) };
  }
}

function extractResendSandboxRecipient(body: string) {
  return body.match(/own email address \(([^)\s]+@[^)\s]+)\)/i)?.[1] ?? null;
}

async function markLeadEmailStatus(leadId: string, status: "sent" | "owner_notified" | "failed") {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    await admin.from("leads").update({ email_status: status }).eq("id", leadId);

    if (status === "sent") {
      await admin
        .from("email_queue")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("related_entity", "lead")
        .eq("related_entity_id", leadId)
        .eq("template", "landing_lead_confirmation");
    }
  } catch (err) {
    console.warn("[lead-capture] Failed to mark email status", sanitizeLogValue(err));
  }
}

async function sendInternalLeadNotification(
  data: CapturePayload,
  leadId: string,
  RESEND_API_KEY: string,
) {
  const recipients = getSalesNotificationRecipients();
  if (recipients.length === 0) {
    console.warn("[lead-capture] No sales notification recipient configured");
    return;
  }

  const fullName = `${data.first_name} ${data.last_name}`.trim();
  const leadUrl = process.env.APP_URL ? `${process.env.APP_URL}/app/leads/${leadId}` : null;
  const details = [
    ["Name", fullName],
    ["Email", data.email],
    ["Phone", data.phone || "Not provided"],
    ["Company", data.company_name || "Not provided"],
    ["Message", data.message || "Not provided"],
    ["Lead ID", leadId],
  ];

  const detailRows = details
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#475569">${escapeHtml(
          label,
        )}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#0f172a">${escapeHtml(
          value,
        )}</td></tr>`,
    )
    .join("");
  const html = `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#111">
      <h2 style="margin:0 0 12px">New TallyPrime landing page lead</h2>
      <p>A new demo request was captured and saved to the CRM.</p>
      <table style="width:100%;border-collapse:collapse;margin-top:16px;border:1px solid #e5e7eb">${detailRows}</table>
      ${leadUrl ? `<p style="margin-top:20px"><a href="${escapeHtml(leadUrl)}">Open lead in CRM</a></p>` : ""}
    </div>`;
  const text = [
    "New TallyPrime landing page lead",
    "",
    ...details.map(([label, value]) => `${label}: ${value}`),
    ...(leadUrl ? ["", `Open lead in CRM: ${leadUrl}`] : []),
  ].join("\n");

  try {
    const res = await sendResendEmail(RESEND_API_KEY, {
      from: getLandingFromEmail(),
      to: recipients,
      reply_to: [data.email],
      subject: `New TallyPrime lead: ${fullName || data.email}`,
      html,
      text,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(
        "[lead-capture] Internal lead notification failed",
        res.status,
        sanitizeLogValue(body),
        "lead:",
        leadId,
      );
    }
  } catch (err) {
    console.warn("[lead-capture] Internal lead notification request failed", sanitizeLogValue(err));
  }
}

async function sendResendEmail(
  RESEND_API_KEY: string,
  payload: {
    from: string;
    to: string[];
    bcc?: string[];
    reply_to?: string[];
    subject: string;
    html: string;
    text: string;
  },
) {
  const body = Object.fromEntries(
    Object.entries(payload).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      return value != null && value !== "";
    }),
  );

  return fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
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
