import process from "node:process";
import { applyCloudFallbackFromEnvFiles, isBlankEnv, loadEnvFile } from "./lib/env.mjs";

const loaded = loadEnvFile(process.argv[2] || ".env.branch");
const cloudEnvLoaded = applyCloudFallbackFromEnvFiles([".env.production", ".env"]);

const required = [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "CLOUD_SUPABASE_URL",
  "CLOUD_SUPABASE_SERVICE_ROLE_KEY",
  "CLOUD_SYNC_NODE_ID",
  "BRANCH_SYNC_NODE_ID",
  "BRANCH_SYNC_NODE_NAME",
];

const optionalRecommended = ["APP_URL", "LEAD_CAPTURE_ALLOWED_ORIGINS", "PUBLIC_SITE_ORIGINS"];

const missing = required.filter(isBlankEnv);
const recommendedMissing = optionalRecommended.filter(isBlankEnv);

if (!loaded) {
  console.warn("No env file loaded. Pass a path or create .env.branch.");
}

if (cloudEnvLoaded) {
  console.log("Loaded .env.production/.env as the default cloud sync target.");
}

if (missing.length > 0) {
  console.error("Branch env check failed. Missing required values:");
  for (const key of missing) console.error(`- ${key}`);
  process.exit(1);
}

if (recommendedMissing.length > 0) {
  console.warn("Recommended values are missing:");
  for (const key of recommendedMissing) console.warn(`- ${key}`);
}

if (process.env.EMAIL_ENABLED !== "false") {
  console.warn("EMAIL_ENABLED is not false. Branch deployments should keep email disabled first.");
}

if (process.env.SUPABASE_URL === process.env.CLOUD_SUPABASE_URL) {
  console.error("SUPABASE_URL and CLOUD_SUPABASE_URL must be different in branch mode.");
  process.exit(1);
}

console.log("Branch env check passed");
