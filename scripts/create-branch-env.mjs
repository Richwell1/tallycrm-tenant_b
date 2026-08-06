import fs from "node:fs";
import process from "node:process";
import { randomUUID } from "node:crypto";
import { parseEnvFile } from "./lib/env.mjs";

const DEFAULT_OUTPUT = ".env.branch";
const DEFAULT_TEMPLATE = ".env.branch.example";
const DEFAULT_PRODUCTION_ENV = ".env.production";
const DEFAULT_SECRET_ENV = ".env";

function argValue(name, fallback) {
  const arg = process.argv.find((value) => value.startsWith(`${name}=`));
  return arg ? arg.slice(name.length + 1) : fallback;
}

function hasArg(name) {
  return process.argv.includes(name);
}

function replaceValue(content, key, value) {
  const pattern = new RegExp(`^${key}=.*$`, "m");
  const line = `${key}=${value ?? ""}`;
  if (pattern.test(content)) return content.replace(pattern, line);
  return `${content.trimEnd()}\n${line}\n`;
}

function requiredValue(values, key) {
  const value = values[key];
  return value?.trim() ? value : "";
}

const outputPath = argValue("--output", DEFAULT_OUTPUT);
const templatePath = argValue("--template", DEFAULT_TEMPLATE);
const productionPath = argValue("--production-env", DEFAULT_PRODUCTION_ENV);
const secretPath = argValue("--secret-env", DEFAULT_SECRET_ENV);
const force = hasArg("--force");

if (!fs.existsSync(templatePath)) {
  throw new Error(`Template not found: ${templatePath}`);
}

if (fs.existsSync(outputPath) && !force) {
  throw new Error(`${outputPath} already exists. Pass --force to overwrite it.`);
}

const { loaded, values: production } = parseEnvFile(productionPath);
if (!loaded) {
  throw new Error(`Production env file not found: ${productionPath}`);
}
const { values: secrets } = parseEnvFile(secretPath);
const cloud = {
  ...production,
  ...Object.fromEntries(Object.entries(secrets).filter(([, value]) => value?.trim())),
};

let output = fs.readFileSync(templatePath, "utf8");
output = replaceValue(output, "CLOUD_SUPABASE_URL", requiredValue(cloud, "SUPABASE_URL"));
output = replaceValue(
  output,
  "CLOUD_SUPABASE_SERVICE_ROLE_KEY",
  requiredValue(cloud, "SUPABASE_SERVICE_ROLE_KEY"),
);
output = replaceValue(
  output,
  "CLOUD_SUPABASE_PUBLISHABLE_KEY",
  requiredValue(cloud, "SUPABASE_PUBLISHABLE_KEY"),
);
output = replaceValue(output, "CLOUD_SYNC_NODE_ID", randomUUID());
output = replaceValue(output, "BRANCH_SYNC_NODE_ID", randomUUID());
output = replaceValue(output, "BRANCH_SYNC_NODE_NAME", "Primary branch server");
output = replaceValue(output, "EMAIL_ENABLED", "false");

fs.writeFileSync(outputPath, output, { mode: 0o600 });

const missing = [];
if (!requiredValue(cloud, "SUPABASE_URL")) missing.push("SUPABASE_URL");
if (!requiredValue(cloud, "SUPABASE_SERVICE_ROLE_KEY")) {
  missing.push("SUPABASE_SERVICE_ROLE_KEY");
}
if (!requiredValue(cloud, "SUPABASE_PUBLISHABLE_KEY")) {
  missing.push("SUPABASE_PUBLISHABLE_KEY");
}

console.log(`Created ${outputPath} from ${templatePath}`);
if (missing.length > 0) {
  console.warn(`Production env is missing values needed for full sync: ${missing.join(", ")}`);
}
console.log(
  "Fill the local branch Supabase URL, publishable key, and service role key before use.",
);
