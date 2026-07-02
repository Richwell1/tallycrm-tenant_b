import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import process from "node:process";
import {
  applyCloudFallbackFromEnvFiles,
  isBlankEnv,
  loadEnvFile,
  parseEnvFile,
} from "./lib/env.mjs";

const REQUIRED_ENV = [
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

function createSupabaseClient(url, key) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function runSupabaseStatus() {
  const result = spawnSync("supabase", ["status"], { encoding: "utf8" });
  const output = `${result.stdout || ""}${result.stderr || ""}`.trim();

  if (result.status === 0) {
    return { ok: true, message: output || "Local Supabase stack is running." };
  }

  if (
    output.includes("No such container") ||
    output.includes("connection refused") ||
    output.includes("cannot connect") ||
    output.includes("permission denied") ||
    output.includes("EROFS") ||
    output.includes("telemetry.json")
  ) {
    return {
      ok: false,
      message:
        "Local Supabase stack is not ready yet or this shell cannot reach Docker. Start it with `supabase start` on the host machine.",
    };
  }

  return {
    ok: false,
    message: "Local Supabase status could not be checked.",
  };
}

async function checkTable(client, table) {
  const { error } = await client.from(table.name).select(table.columns).limit(1);
  if (error) {
    throw new Error(`${table.name}: ${error.message}`);
  }
}

async function checkCloudConnectivity() {
  const cloudUrl = process.env.CLOUD_SUPABASE_URL;
  const cloudKey = process.env.CLOUD_SUPABASE_SERVICE_ROLE_KEY;
  if (!cloudUrl || !cloudKey) {
    return { ok: false, message: "Cloud Supabase service-role env is incomplete." };
  }

  const client = createSupabaseClient(cloudUrl, cloudKey);
  for (const table of REQUIRED_TABLES) {
    await checkTable(client, table);
  }

  return { ok: true, message: "Cloud Supabase service-role access is healthy." };
}

async function checkLocalConnectivity() {
  const localUrl = process.env.SUPABASE_URL;
  const localKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!localUrl || !localKey) {
    return { ok: false, message: "Local Supabase env is incomplete." };
  }

  const client = createSupabaseClient(localUrl, localKey);
  for (const table of REQUIRED_TABLES) {
    await checkTable(client, table);
  }

  return { ok: true, message: "Local Supabase service-role access is healthy." };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const envPathArg = process.argv.find((arg) => arg.startsWith("--env-file="));
  const envPath = envPathArg?.split("=")[1] || ".env.branch";
  const json = args.has("--json");

  const branchLoaded = loadEnvFile(envPath);
  const cloudLoaded = applyCloudFallbackFromEnvFiles([".env.production", ".env"]);
  loadEnvFile(".env.local");

  const report = {
    envFileLoaded: branchLoaded,
    cloudEnvLoaded: cloudLoaded,
    missingEnv: REQUIRED_ENV.filter(isBlankEnv),
    uuidChecks: {
      branchSyncNodeId: isUuid(process.env.BRANCH_SYNC_NODE_ID || ""),
      cloudSyncNodeId: isUuid(process.env.CLOUD_SYNC_NODE_ID || ""),
    },
    localSupabaseStatus: runSupabaseStatus(),
    localConnectivity: null,
    cloudConnectivity: null,
  };

  if (
    !report.missingEnv.includes("SUPABASE_URL") &&
    !report.missingEnv.includes("SUPABASE_SERVICE_ROLE_KEY")
  ) {
    try {
      report.localConnectivity = await checkLocalConnectivity();
    } catch (error) {
      report.localConnectivity = {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  } else {
    report.localConnectivity = { ok: false, message: "Local env is incomplete." };
  }

  if (
    !report.missingEnv.includes("CLOUD_SUPABASE_URL") &&
    !report.missingEnv.includes("CLOUD_SUPABASE_SERVICE_ROLE_KEY")
  ) {
    try {
      report.cloudConnectivity = await checkCloudConnectivity();
    } catch (error) {
      report.cloudConnectivity = {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  } else {
    report.cloudConnectivity = { ok: false, message: "Cloud env is incomplete." };
  }

  if (json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log("Branch doctor");
  console.log(`Env file loaded: ${report.envFileLoaded ? "yes" : "no"}`);
  console.log(`Cloud env loaded: ${report.cloudEnvLoaded ? "yes" : "no"}`);
  console.log(`Missing env: ${report.missingEnv.length ? report.missingEnv.join(", ") : "none"}`);
  console.log(`Branch node ID UUID: ${report.uuidChecks.branchSyncNodeId ? "yes" : "no"}`);
  console.log(`Cloud node ID UUID: ${report.uuidChecks.cloudSyncNodeId ? "yes" : "no"}`);
  console.log(`Local Supabase status: ${report.localSupabaseStatus.message}`);
  console.log(`Local Supabase connectivity: ${report.localConnectivity?.message}`);
  console.log(`Cloud Supabase connectivity: ${report.cloudConnectivity?.message}`);

  if (report.missingEnv.length > 0) {
    process.exitCode = 1;
  } else if (!report.localConnectivity?.ok || !report.cloudConnectivity?.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
