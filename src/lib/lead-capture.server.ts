import { z } from "zod";

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

function securityHeaders(request: Request) {
  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  return {
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
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

  const SUPABASE_URL =
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    console.error("[lead-capture] Missing Supabase publishable env vars");
    return json(
      request,
      { error: "Backend not configured", code: "config_missing" },
      500,
    );
  }

  const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
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
    console.error("[lead-capture] RPC failed", error);
    return json(
      request,
      { error: "Could not save lead", code: "insert_failed" },
      500,
    );
  }

  return json(request, { ok: true, lead_id: leadId }, 200);
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
  const sourceOrigin = origin ?? (referer ? new URL(referer).origin : null);
  if (sourceOrigin) {
    let sourceHost: string;
    try {
      sourceHost = new URL(sourceOrigin).hostname;
    } catch {
      return {
        status: 403,
        body: { error: "Cross-site submission blocked", code: "csrf" },
      };
    }
    const expectedHost = url.hostname;
    const allowedSuffixes = [".lovable.app", ".lovableproject.com", ".lovable.dev"];
    const isSameHost = sourceHost === expectedHost;
    const isAllowedLovable = allowedSuffixes.some((s) => sourceHost.endsWith(s));
    if (!isSameHost && !isAllowedLovable) {
      return {
        status: 403,
        body: { error: "Cross-site submission blocked", code: "csrf" },
      };
    }
  }

  return null;
}
