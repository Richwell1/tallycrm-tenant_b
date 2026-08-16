import { createClient } from "@supabase/supabase-js";

const serverEnv = typeof process !== "undefined" && process.env ? process.env : {};

export const TENANT_NAME = import.meta.env.VITE_TENANT_NAME || serverEnv.VITE_TENANT_NAME;

export const CONTROL_PLANE_URL =
  import.meta.env.VITE_CONTROL_PLANE_URL || serverEnv.VITE_CONTROL_PLANE_URL;

export const CONTROL_PLANE_ANON_KEY =
  import.meta.env.VITE_CONTROL_PLANE_ANON_KEY || serverEnv.VITE_CONTROL_PLANE_ANON_KEY;

export function isControlPlaneConfigured() {
  return Boolean(TENANT_NAME && CONTROL_PLANE_URL && CONTROL_PLANE_ANON_KEY);
}

export function missingControlPlaneConfigMessage() {
  const missing = [
    ...(!TENANT_NAME ? ["VITE_TENANT_NAME"] : []),
    ...(!CONTROL_PLANE_URL ? ["VITE_CONTROL_PLANE_URL"] : []),
    ...(!CONTROL_PLANE_ANON_KEY ? ["VITE_CONTROL_PLANE_ANON_KEY"] : []),
  ];

  return `Missing marketplace environment variable(s): ${missing.join(
    ", ",
  )}. Add them to this tenant's deployment.`;
}

function createControlPlaneClient() {
  if (!isControlPlaneConfigured()) {
    throw new Error(missingControlPlaneConfigMessage());
  }

  return createClient(CONTROL_PLANE_URL, CONTROL_PLANE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

let controlPlaneClient: ReturnType<typeof createControlPlaneClient> | undefined;

export const controlPlaneSupabase = new Proxy({} as ReturnType<typeof createControlPlaneClient>, {
  get(_, prop, receiver) {
    if (!controlPlaneClient) controlPlaneClient = createControlPlaneClient();
    return Reflect.get(controlPlaneClient, prop, receiver);
  },
});
