import fs from "node:fs";
import { spawnSync } from "node:child_process";
import process from "node:process";

const DEFAULT_ENV_PATH = ".env.local";

function argValue(name, fallback) {
  const arg = process.argv.find((value) => value.startsWith(`${name}=`));
  return arg ? arg.slice(name.length + 1) : fallback;
}

function parseEnvBlock(block) {
  const values = {};
  for (const line of block.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const raw = trimmed.slice(index + 1).trim();
    values[key] = raw.replace(/^['"]|['"]$/g, "");
  }
  return values;
}

function replaceOrAppend(content, key, value) {
  const pattern = new RegExp(`^${key}=.*$`, "m");
  const line = `${key}=${JSON.stringify(value ?? "")}`;
  if (pattern.test(content)) return content.replace(pattern, line);
  const trimmed = content.trimEnd();
  return `${trimmed ? `${trimmed}\n` : ""}${line}\n`;
}

function firstValue(values, keys) {
  for (const key of keys) {
    const value = values[key];
    if (value && String(value).trim()) return String(value).trim();
  }
  return "";
}

const envPath = argValue("--env-file", DEFAULT_ENV_PATH);
const fallbackProjectId = argValue("--project-id", "branch-local");
const publicUrl = argValue("--public-url", process.env.BRANCH_PUBLIC_SUPABASE_URL || "");
const mirrorPaths = process.argv
  .filter((value) => value.startsWith("--mirror="))
  .map((value) => value.slice("--mirror=".length));
const dryRun = process.argv.includes("--dry-run");

const status = spawnSync("supabase", ["status", "-o", "env"], {
  encoding: "utf8",
  maxBuffer: 1024 * 1024,
});

if (status.status !== 0) {
  const output = `${status.stdout || ""}${status.stderr || ""}`.trim();
  console.error(output || "supabase status failed");
  process.exit(status.status || 1);
}

const values = parseEnvBlock(status.stdout || "");
const supabaseUrl = firstValue(values, ["SUPABASE_URL", "API_URL"]);
const publishableKey = firstValue(values, [
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY",
  "PUBLISHABLE_KEY",
  "ANON_KEY",
]);
const serviceRoleKey = firstValue(values, ["SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY"]);
const detectedProjectId =
  firstValue(values, ["SUPABASE_PROJECT_ID"]) ||
  (supabaseUrl.includes("127.0.0.1") || supabaseUrl.includes("localhost") ? "branch-local" : "");
const projectId = detectedProjectId || fallbackProjectId;

if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
  console.error("Could not find the local Supabase URL, publishable key, or service role key.");
  console.error(
    "Inspect `supabase status -o env` on the host machine and confirm the stack is running.",
  );
  process.exit(1);
}

function buildEnvContent(path) {
  const current = fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";
  let next = current || "";
  if (projectId) {
    next = replaceOrAppend(next, "SUPABASE_PROJECT_ID", projectId);
  }
  next = replaceOrAppend(next, "SUPABASE_URL", supabaseUrl);
  next = replaceOrAppend(next, "SUPABASE_PUBLISHABLE_KEY", publishableKey);
  if (projectId) {
    next = replaceOrAppend(next, "VITE_SUPABASE_PROJECT_ID", projectId);
  }
  next = replaceOrAppend(next, "VITE_SUPABASE_URL", publicUrl || supabaseUrl);
  next = replaceOrAppend(next, "VITE_SUPABASE_PUBLISHABLE_KEY", publishableKey);
  next = replaceOrAppend(next, "SUPABASE_SERVICE_ROLE_KEY", serviceRoleKey);
  return next;
}

const targets = [envPath, ...mirrorPaths];
for (const target of targets) {
  if (target.includes("branch") && !publicUrl && isLoopbackUrl(supabaseUrl)) {
    console.warn(
      `${target} is a branch/LAN env file, but local Supabase reported ${supabaseUrl}. ` +
        "Browser clients will rewrite loopback to the app hostname at runtime. " +
        "Pass --public-url=http://<branch-server-lan-ip>:54321 if this deployment needs an explicit public Supabase URL.",
    );
  }
  const next = buildEnvContent(target);
  if (!dryRun) {
    fs.writeFileSync(target, next, { mode: 0o600 });
  }
  console.log(`${dryRun ? "Would update" : "Updated"} ${target} from local Supabase status`);
}

function isLoopbackUrl(value) {
  try {
    const hostname = new URL(value).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}
