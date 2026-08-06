import { spawn } from "node:child_process";
import fs from "node:fs";
import process from "node:process";

const envFile =
  process.argv.find((arg) => arg.startsWith("--env-file="))?.split("=")[1] ?? ".env.staging";
const wranglerEnv =
  process.argv.find((arg) => arg.startsWith("--wrangler-env="))?.split("=")[1] ?? "";
const wranglerConfig = process.argv.find((arg) => arg.startsWith("--config="))?.split("=")[1] ?? "";
const allowMissingServiceRole = process.argv.includes("--allow-missing-service-role");

const secretKeys = [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "AUTOMATION_DISPATCH_SECRET",
  "EMAIL_ENABLED",
  "LANDING_FROM_EMAIL",
  "PARTNER_NAME",
  "PARTNER_PHONE",
  "PARTNER_EMAIL",
  "LANDING_NOTIFY_EMAILS",
  "SALES_NOTIFY_EMAILS",
  "SALES_NOTIFY_BCC",
  "APP_URL",
  "AUTOMATION_FROM_EMAIL",
  "RESEND_API_KEY",
];

function parseEnv(path) {
  if (!fs.existsSync(path)) {
    throw new Error(`${path} does not exist`);
  }

  return Object.fromEntries(
    fs
      .readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((line) => line.trim() && !line.trim().startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        const key = line.slice(0, index).trim();
        const value = line
          .slice(index + 1)
          .trim()
          .replace(/^['"]|['"]$/g, "");
        return [key, value];
      }),
  );
}

function refFromUrl(value = "") {
  try {
    return new URL(value).hostname.split(".")[0] ?? "";
  } catch {
    return "";
  }
}

function projectRefs(env) {
  return new Set(
    [
      env.SUPABASE_PROJECT_ID,
      env.VITE_SUPABASE_PROJECT_ID,
      refFromUrl(env.SUPABASE_URL),
      refFromUrl(env.VITE_SUPABASE_URL),
    ].filter(Boolean),
  );
}

function run(command, args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["pipe", "inherit", "inherit"],
      env: {
        ...process.env,
        WRANGLER_LOG: process.env.WRANGLER_LOG ?? "none",
      },
    });

    child.stdin.end(input);
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

const staging = parseEnv(envFile);
const production = fs.existsSync(".env.production") ? parseEnv(".env.production") : {};
const stagingRefs = projectRefs(staging);
const productionRefs = projectRefs(production);

for (const ref of stagingRefs) {
  if (productionRefs.has(ref) && ref) {
    throw new Error(
      `${envFile} points to the same Supabase project as .env.production. Refusing to push staging secrets.`,
    );
  }
}

const requiredKeys = ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"];
if (!allowMissingServiceRole) requiredKeys.push("SUPABASE_SERVICE_ROLE_KEY");

const missing = requiredKeys.filter((key) => !staging[key]);
if (missing.length > 0) {
  throw new Error(`${envFile} is missing required server secrets: ${missing.join(", ")}`);
}

const keysToPush = secretKeys.filter((key) => staging[key] !== undefined && staging[key] !== "");

if (allowMissingServiceRole && !staging.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    "SUPABASE_SERVICE_ROLE_KEY is missing. Staging will deploy, but server-side Supabase admin paths will fail until this secret is set.",
  );
}

console.log(
  `Pushing ${keysToPush.length} secrets to Cloudflare${wranglerEnv ? ` env "${wranglerEnv}"` : ""} from ${envFile}`,
);
for (const key of keysToPush) {
  console.log(`- ${key}`);
  const args = ["wrangler", "secret", "put", key];
  if (wranglerEnv) args.push("--env", wranglerEnv);
  if (wranglerConfig) args.push("--config", wranglerConfig);
  await run("npx", args, staging[key]);
}

console.log("Cloudflare secrets pushed");
