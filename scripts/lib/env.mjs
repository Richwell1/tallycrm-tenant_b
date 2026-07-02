import fs from "node:fs";

export function parseEnvFile(path) {
  if (!fs.existsSync(path)) return { loaded: false, values: {} };

  const values = {};
  const lines = fs.readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const raw = trimmed.slice(index + 1).trim();
    values[key] = raw.replace(/^['"]|['"]$/g, "");
  }

  return { loaded: true, values };
}

export function loadEnvFile(path, { override = false } = {}) {
  const { loaded, values } = parseEnvFile(path);
  if (!loaded) return false;

  for (const [key, value] of Object.entries(values)) {
    if (override || process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  return true;
}

export function applyCloudFallbackFromEnvFile(path) {
  const { loaded, values } = parseEnvFile(path);
  if (!loaded) return false;

  const mappings = {
    CLOUD_SUPABASE_URL: ["CLOUD_SUPABASE_URL", "SUPABASE_URL", "VITE_SUPABASE_URL"],
    CLOUD_SUPABASE_SERVICE_ROLE_KEY: [
      "CLOUD_SUPABASE_SERVICE_ROLE_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
    ],
    CLOUD_SUPABASE_PUBLISHABLE_KEY: [
      "CLOUD_SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_PUBLISHABLE_KEY",
      "VITE_SUPABASE_PUBLISHABLE_KEY",
    ],
  };

  for (const [target, sources] of Object.entries(mappings)) {
    if (process.env[target]?.trim()) continue;
    const value = sources.map((source) => values[source]).find((candidate) => candidate?.trim());
    if (value) process.env[target] = value;
  }

  return true;
}

export function applyCloudFallbackFromEnvFiles(paths) {
  let loadedAny = false;

  for (const path of paths) {
    if (applyCloudFallbackFromEnvFile(path)) {
      loadedAny = true;
    }
  }

  return loadedAny;
}

export function isBlankEnv(key) {
  return !process.env[key] || process.env[key].trim() === "";
}
