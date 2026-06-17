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

  if (process.env.NODE_ENV !== "production") {
    const localhostHosts = new Set(["localhost", "127.0.0.1", "::1"]);
    if (localhostHosts.has(sourceUrl.hostname)) return true;
  }

  return getAllowedOrigins().some((allowedOrigin) => allowedOrigin === sourceUrl.origin);
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
  const SUPABASE_PUBLISHABLE_KEY =
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const AUTOMATION_DISPATCH_SECRET = process.env.AUTOMATION_DISPATCH_SECRET;

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

  // Fire-and-forget: trigger the email dispatcher so the queued
  // confirmation email is sent without waiting for a cron tick.
  // Failures here must NOT block the visitor's success response.
  void triggerEmailDispatcher(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY ?? SUPABASE_SERVICE_ROLE_KEY,
    leadId,
    AUTOMATION_DISPATCH_SECRET,
  );

  return json(request, { ok: true, lead_id: leadId }, 200);
}

async function triggerEmailDispatcher(
  supabaseUrl: string,
  supabasePublishableKey: string,
  leadId: string,
  automationDispatchSecret?: string,
) {
  if (!automationDispatchSecret) {
    console.warn("[lead-capture] Email dispatcher secret not configured; email remains queued");
    return;
  }

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/send-automation-email`, {
      method: "POST",
      headers: {
        apikey: supabasePublishableKey,
        authorization: `Bearer ${supabasePublishableKey}`,
        "content-type": "application/json",
        "x-dispatch-secret": automationDispatchSecret,
      },
      body: JSON.stringify({ related_entity: "lead", related_entity_id: leadId }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn("[lead-capture] Email dispatcher failed", res.status, sanitizeLogValue(body));
    }
  } catch (err) {
    console.warn("[lead-capture] Email dispatcher unavailable", sanitizeLogValue(err));
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

  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const sourceOrigin = origin ?? (referer ? new URL(referer).origin : null);
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

function sanitizeLogValue(value: unknown) {
  return String(value instanceof Error ? value.message : value)
    .replace(/[A-Za-z0-9_-]{24,}/g, "[redacted]")
    .slice(0, 240);
}
