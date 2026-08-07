// Browser Supabase client bound to the connected Lovable Cloud project.
// Only the publishable (anon) key is used here — never the service role key.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Connected Lovable Cloud project (publishable values are safe in client code).
// These act as the binding when the build environment does not inject VITE_ vars.
const CLOUD_SUPABASE_URL = "https://ncggjsjzjfgoceoszjhf.supabase.co";
const CLOUD_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_VO_1HPPNw-Y-nGVHLEdK8g_6Dkwq6zV";

const serverEnv = typeof process !== "undefined" && process.env ? process.env : {};

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || serverEnv.SUPABASE_URL || CLOUD_SUPABASE_URL;

export const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  serverEnv.SUPABASE_PUBLISHABLE_KEY ||
  CLOUD_SUPABASE_PUBLISHABLE_KEY;

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
}

export function missingSupabaseConfigMessage() {
  const missing = [
    ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
    ...(!SUPABASE_PUBLISHABLE_KEY ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
  ];
  return `Missing Supabase environment variable(s): ${missing.join(
    ", ",
  )}. Reconnect Lovable Cloud for this project.`;
}

function createSupabaseClient() {
  if (!isSupabaseConfigured()) {
    // Fail loudly — there is no demo/mock/offline client.
    throw new Error(missingSupabaseConfigMessage());
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
