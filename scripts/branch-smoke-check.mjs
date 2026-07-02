import { createClient } from "@supabase/supabase-js";
import process from "node:process";
import { applyCloudFallbackFromEnvFiles, isBlankEnv, loadEnvFile } from "./lib/env.mjs";

const REQUIRED_ENV = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CLOUD_SUPABASE_URL",
  "CLOUD_SUPABASE_SERVICE_ROLE_KEY",
  "BRANCH_SYNC_NODE_ID",
  "CLOUD_SYNC_NODE_ID",
];

const REQUIRED_TABLES = [
  { name: "profiles", columns: "id,updated_at" },
  { name: "user_roles", columns: "id,user_id,created_at" },
  { name: "pipeline_stages", columns: "id,updated_at" },
  { name: "loss_reasons", columns: "id,updated_at" },
  { name: "app_settings", columns: "id,updated_at" },
  { name: "automation_rules", columns: "id,updated_at" },
  { name: "companies", columns: "id,updated_at,origin_node_id,last_modified_by" },
  { name: "contacts", columns: "id,updated_at,origin_node_id,last_modified_by" },
  { name: "deals", columns: "id,updated_at,origin_node_id,last_modified_by" },
  { name: "leads", columns: "id,updated_at,origin_node_id,last_modified_by" },
  { name: "tasks", columns: "id,updated_at,origin_node_id,last_modified_by" },
  { name: "activities", columns: "id,updated_at,origin_node_id,last_modified_by" },
  { name: "notifications", columns: "id,created_at,origin_node_id" },
  { name: "deal_stage_history", columns: "id,changed_at" },
  { name: "deal_value_history", columns: "id,changed_at" },
  { name: "lead_status_history", columns: "id,changed_at" },
  { name: "automation_runs", columns: "id,created_at" },
  { name: "audit_log", columns: "id,created_at,origin_node_id" },
  { name: "sync_nodes", columns: "id,name,kind,last_seen_at" },
  { name: "sync_checkpoints", columns: "id,local_node_id,remote_node_id,table_name" },
  { name: "sync_conflicts", columns: "id,table_name,row_pk,resolution" },
  { name: "sync_runs", columns: "id,direction,status,started_at" },
];

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function createSupabaseClient(url, key) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function checkTable(client, label, table) {
  const { error } = await client.from(table.name).select(table.columns).limit(1);
  if (error) {
    throw new Error(`${label}: ${table.name} failed (${error.message})`);
  }
  console.log(`${label}: ${table.name} ok`);
}

async function checkSide(label, client) {
  console.log(`Checking ${label} Supabase schema`);
  for (const table of REQUIRED_TABLES) {
    await checkTable(client, label, table);
  }
}

async function writeCheck(label, client, nodeId, nodeName, kind) {
  const { error } = await client.from("sync_nodes").upsert(
    {
      id: nodeId,
      name: nodeName,
      kind,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) throw new Error(`${label}: sync_nodes write failed (${error.message})`);
  console.log(`${label}: sync_nodes write ok`);
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const envPathArg = process.argv.find((arg) => arg.startsWith("--env-file="));
  const envPath = envPathArg?.split("=")[1] || ".env.branch";
  const write = args.has("--write");

  const loaded = loadEnvFile(envPath);
  const cloudEnvLoaded = applyCloudFallbackFromEnvFiles([".env.production", ".env"]);
  loadEnvFile(".env.local");

  if (!loaded) {
    throw new Error(`No env file loaded from ${envPath}`);
  }

  if (cloudEnvLoaded) {
    console.log("Loaded .env.production/.env as the default cloud sync target.");
  }

  const missing = REQUIRED_ENV.filter(isBlankEnv);
  if (missing.length > 0) {
    throw new Error(`Missing required env values: ${missing.join(", ")}`);
  }

  if (process.env.SUPABASE_URL === process.env.CLOUD_SUPABASE_URL) {
    throw new Error("SUPABASE_URL and CLOUD_SUPABASE_URL must be different");
  }

  if (!isUuid(process.env.BRANCH_SYNC_NODE_ID)) {
    throw new Error("BRANCH_SYNC_NODE_ID must be a stable UUID");
  }

  if (!isUuid(process.env.CLOUD_SYNC_NODE_ID)) {
    throw new Error("CLOUD_SYNC_NODE_ID must be a stable UUID");
  }

  if (process.env.BRANCH_SYNC_NODE_ID === process.env.CLOUD_SYNC_NODE_ID) {
    throw new Error("BRANCH_SYNC_NODE_ID and CLOUD_SYNC_NODE_ID must be different");
  }

  if (process.env.VITE_SUPABASE_URL?.includes("localhost")) {
    console.warn(
      "VITE_SUPABASE_URL contains localhost. LAN users need a hostname or IP they can reach.",
    );
  }

  const branch = createSupabaseClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  const cloud = createSupabaseClient(
    process.env.CLOUD_SUPABASE_URL,
    process.env.CLOUD_SUPABASE_SERVICE_ROLE_KEY,
  );

  await checkSide("branch", branch);
  await checkSide("cloud", cloud);

  if (write) {
    await writeCheck(
      "branch",
      branch,
      process.env.BRANCH_SYNC_NODE_ID,
      process.env.BRANCH_SYNC_NODE_NAME || "Branch server",
      "branch",
    );
    await writeCheck("branch", branch, process.env.CLOUD_SYNC_NODE_ID, "Cloud Supabase", "cloud");
    await writeCheck(
      "cloud",
      cloud,
      process.env.BRANCH_SYNC_NODE_ID,
      process.env.BRANCH_SYNC_NODE_NAME || "Branch server",
      "branch",
    );
    await writeCheck("cloud", cloud, process.env.CLOUD_SYNC_NODE_ID, "Cloud Supabase", "cloud");
  } else {
    console.log("Skipping write checks. Pass --write to validate sync_nodes writes.");
  }

  console.log("Branch smoke check passed");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
