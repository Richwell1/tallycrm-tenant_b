import { createClient } from "@supabase/supabase-js";
import process from "node:process";
import { applyCloudFallbackFromEnvFiles, loadEnvFile } from "./lib/env.mjs";

const TABLE_CONFIGS = {
  profiles: { cursorColumn: "updated_at", pullOnly: true },
  user_roles: {
    cursorColumn: "created_at",
    appendOnly: true,
    onConflict: "user_id,role",
    pullOnly: true,
  },
  pipeline_stages: {
    cursorColumn: "updated_at",
    naturalKey: ["name"],
    preserveTargetIdOnNaturalMatch: true,
    pullOnly: true,
  },
  loss_reasons: {
    cursorColumn: "updated_at",
    naturalKey: ["label"],
    preserveTargetIdOnNaturalMatch: true,
    pullOnly: true,
  },
  app_settings: { cursorColumn: "updated_at", pullOnly: true },
  automation_rules: { cursorColumn: "updated_at", pullOnly: true },
  companies: { cursorColumn: "updated_at" },
  contacts: { cursorColumn: "updated_at" },
  deals: { cursorColumn: "updated_at" },
  leads: { cursorColumn: "updated_at" },
  tasks: { cursorColumn: "updated_at" },
  activities: { cursorColumn: "updated_at" },
  notifications: { cursorColumn: "created_at", appendOnly: true },
  deal_stage_history: { cursorColumn: "changed_at", appendOnly: true },
  deal_value_history: { cursorColumn: "changed_at", appendOnly: true },
  lead_status_history: { cursorColumn: "changed_at", appendOnly: true },
  quote_catalog_items: { cursorColumn: "updated_at", pullOnly: true },
  quotes: { cursorColumn: "updated_at" },
  quote_line_items: { cursorColumn: "updated_at" },
  quote_status_history: { cursorColumn: "changed_at", appendOnly: true },
  automation_runs: { cursorColumn: "created_at", appendOnly: true },
  audit_log: { cursorColumn: "created_at", appendOnly: true },
};

const DEFAULT_TABLES = [
  "profiles",
  "user_roles",
  "pipeline_stages",
  "loss_reasons",
  "app_settings",
  "automation_rules",
  "companies",
  "contacts",
  "deals",
  "leads",
  "tasks",
  "activities",
  "quote_catalog_items",
  "quotes",
  "quote_line_items",
];
const EPOCH = "1970-01-01T00:00:00.000Z";
const LOOP_PREVENTION_COLUMNS = new Set([
  "created_at",
  "updated_at",
  "origin_node_id",
  "last_modified_by",
]);

loadEnvFile(".env.branch");
applyCloudFallbackFromEnvFiles([".env.production", ".env"]);
loadEnvFile(".env.local");

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const fullSync = args.has("--full");
const directionArg = process.argv.find((arg) => arg.startsWith("--direction="));
const tableArg = process.argv.find((arg) => arg.startsWith("--tables="));
const direction = directionArg?.split("=")[1] ?? "bidirectional";
const tables = tableArg ? expandTables(tableArg.split("=")[1]) : DEFAULT_TABLES;

if (!["push", "pull", "bidirectional"].includes(direction)) {
  throw new Error("--direction must be push, pull, or bidirectional");
}

for (const table of tables) {
  if (!TABLE_CONFIGS[table]) {
    throw new Error(
      `Unsupported table "${table}". Supported tables: ${Object.keys(TABLE_CONFIGS).join(", ")}`,
    );
  }
}

const config = {
  branchUrl: process.env.SUPABASE_URL,
  branchServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  cloudUrl: process.env.CLOUD_SUPABASE_URL,
  cloudServiceKey: process.env.CLOUD_SUPABASE_SERVICE_ROLE_KEY,
  branchNodeId: process.env.BRANCH_SYNC_NODE_ID,
  branchNodeName: process.env.BRANCH_SYNC_NODE_NAME || "Branch server",
  cloudNodeId: process.env.CLOUD_SYNC_NODE_ID,
  batchSize: Number(process.env.SYNC_BATCH_SIZE || 100),
};

const missing = Object.entries(config)
  .filter(([key, value]) => {
    if (key === "batchSize" || key === "branchNodeName") return false;
    return !value;
  })
  .map(([key]) => key);

if (missing.length > 0) {
  console.error(`Missing sync config: ${missing.join(", ")}`);
  console.error("Create .env.branch from .env.branch.example and fill local/cloud sync values.");
  process.exit(1);
}

const branch = createClient(config.branchUrl, config.branchServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const cloud = createClient(config.cloudUrl, config.cloudServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function iso(value) {
  return value ? new Date(value).toISOString() : EPOCH;
}

function newer(left, right) {
  return new Date(iso(left)).getTime() > new Date(iso(right)).getTime();
}

function expandTables(value) {
  const requested = value
    .split(",")
    .map((table) => table.trim())
    .filter(Boolean);
  if (requested.includes("all")) return Object.keys(TABLE_CONFIGS);
  if (requested.includes("core")) return DEFAULT_TABLES;
  return requested;
}

async function upsertNode(client, node) {
  if (dryRun) return;
  const { error } = await client.from("sync_nodes").upsert(
    {
      id: node.id,
      name: node.name,
      kind: node.kind,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) throw error;
}

async function ensureBranchNodes() {
  await Promise.all([
    upsertNode(branch, { id: config.branchNodeId, name: config.branchNodeName, kind: "branch" }),
    upsertNode(branch, { id: config.cloudNodeId, name: "Cloud Supabase", kind: "cloud" }),
  ]);
}

async function ensureCloudNodes() {
  await Promise.all([
    upsertNode(cloud, { id: config.branchNodeId, name: config.branchNodeName, kind: "branch" }),
    upsertNode(cloud, { id: config.cloudNodeId, name: "Cloud Supabase", kind: "cloud" }),
  ]);
}

async function getCheckpoint(client, tableName) {
  const { data, error } = await client
    .from("sync_checkpoints")
    .select("last_pushed_at,last_pulled_at")
    .eq("local_node_id", config.branchNodeId)
    .eq("remote_node_id", config.cloudNodeId)
    .eq("table_name", tableName)
    .maybeSingle();
  if (error) throw error;
  return {
    lastPushedAt: data?.last_pushed_at ?? EPOCH,
    lastPulledAt: data?.last_pulled_at ?? EPOCH,
  };
}

async function saveCheckpoint(client, tableName, patch) {
  if (dryRun) return;
  const { error } = await client.from("sync_checkpoints").upsert(
    {
      local_node_id: config.branchNodeId,
      remote_node_id: config.cloudNodeId,
      table_name: tableName,
      ...patch,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "local_node_id,remote_node_id,table_name" },
  );
  if (error) throw error;
}

async function listChangedRows(client, tableName, since, cursorColumn, highWatermark) {
  const { data, error } = await client
    .from(tableName)
    .select("*")
    .gt(cursorColumn, since)
    .lte(cursorColumn, highWatermark)
    .order(cursorColumn, { ascending: true })
    .order("id", { ascending: true })
    .limit(config.batchSize);
  if (error) throw error;
  return data ?? [];
}

async function getRow(client, tableName, id) {
  if (!id) return null;
  const { data, error } = await client.from(tableName).select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

async function getRowByNaturalKey(client, tableName, row) {
  const tableConfig = TABLE_CONFIGS[tableName];
  if (!tableConfig.naturalKey) return null;
  let query = client.from(tableName).select("*");
  for (const column of tableConfig.naturalKey) {
    if (row[column] === null || row[column] === undefined) return null;
    query = query.eq(column, row[column]);
  }
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

async function getExistingRow(client, tableName, row) {
  const byId = await getRow(client, tableName, row.id);
  if (byId) return { row: byId, matchedBy: "id" };

  const byNaturalKey = await getRowByNaturalKey(client, tableName, row);
  if (byNaturalKey) return { row: byNaturalKey, matchedBy: "naturalKey" };

  return { row: null, matchedBy: null };
}

async function ensureTargetPipelineStage({ source, target, sourceStageId }) {
  if (!sourceStageId) return sourceStageId;

  const sourceStage = await getRow(source, "pipeline_stages", sourceStageId);
  if (!sourceStage) return sourceStageId;

  const targetStage = await getRowByNaturalKey(target, "pipeline_stages", sourceStage);
  if (targetStage?.id) return targetStage.id;

  await upsertPreparedRow(target, "pipeline_stages", sourceStage);
  return sourceStage.id;
}

async function prepareRowForTarget({
  tableName,
  row,
  source,
  target,
  existing,
  matchedBy,
  originNodeId,
}) {
  const tableConfig = TABLE_CONFIGS[tableName];
  const payload = { ...row };

  if (
    existing &&
    matchedBy === "naturalKey" &&
    tableConfig.preserveTargetIdOnNaturalMatch &&
    existing.id !== row.id
  ) {
    payload.id = existing.id;
  }

  if (tableName === "deals") {
    payload.stage_id = await ensureTargetPipelineStage({
      source,
      target,
      sourceStageId: row.stage_id,
    });
  }

  if (tableName === "deal_stage_history") {
    payload.from_stage = await ensureTargetPipelineStage({
      source,
      target,
      sourceStageId: row.from_stage,
    });
    payload.to_stage = await ensureTargetPipelineStage({
      source,
      target,
      sourceStageId: row.to_stage,
    });
  }

  if ("origin_node_id" in payload) {
    payload.origin_node_id = payload.origin_node_id ?? originNodeId;
  }

  return payload;
}

async function upsertPreparedRow(client, tableName, payload) {
  if (dryRun) return;
  const tableConfig = TABLE_CONFIGS[tableName];
  const { error } = await client
    .from(tableName)
    .upsert(payload, { onConflict: tableConfig.onConflict ?? "id" });
  if (error) throw error;
}

function normalizeComparableRow(row, tableName) {
  const tableConfig = TABLE_CONFIGS[tableName];
  const ignoredColumns = new Set(LOOP_PREVENTION_COLUMNS);
  if (tableConfig.cursorColumn) ignoredColumns.add(tableConfig.cursorColumn);

  return Object.fromEntries(
    Object.entries(row)
      .filter(([key]) => !ignoredColumns.has(key))
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

function rowsEquivalent(left, right, tableName) {
  return (
    JSON.stringify(normalizeComparableRow(left, tableName)) ===
    JSON.stringify(normalizeComparableRow(right, tableName))
  );
}

async function logConflict(client, tableName, rowId, localRow, remoteRow, resolution) {
  if (dryRun) return;
  const { error } = await client.from("sync_conflicts").insert({
    table_name: tableName,
    row_pk: String(rowId),
    local_node_id: config.branchNodeId,
    remote_node_id: config.cloudNodeId,
    conflict_type: "concurrent_update",
    local_payload: localRow,
    remote_payload: remoteRow,
    resolution,
  });
  if (error) throw error;
}

async function syncTable({ tableName, source, target, mode, since, originNodeId, highWatermark }) {
  const tableConfig = TABLE_CONFIGS[tableName];
  const cursorColumn = tableConfig.cursorColumn;
  const rows = await listChangedRows(source, tableName, since, cursorColumn, highWatermark);
  let changed = 0;
  let conflicts = 0;

  for (const row of rows) {
    const existingResult = await getExistingRow(target, tableName, row);
    const existing = existingResult.row;
    const preparedRow = await prepareRowForTarget({
      tableName,
      row,
      source,
      target,
      existing,
      matchedBy: existingResult.matchedBy,
      originNodeId,
    });

    if (!existing) {
      await upsertPreparedRow(target, tableName, preparedRow);
      changed += 1;
      continue;
    }

    if (tableConfig.appendOnly) {
      continue;
    }

    if (rowsEquivalent(preparedRow, existing, tableName)) {
      continue;
    }

    const sourceCursor = row[cursorColumn];
    const targetCursor = existing[cursorColumn];
    const sourceChanged = newer(sourceCursor, since);
    const targetChanged = newer(targetCursor, since);
    const applySource =
      tableConfig.pullOnly && mode === "pull" ? true : newer(sourceCursor, targetCursor);
    if (sourceChanged && targetChanged && sourceCursor !== targetCursor) {
      await logConflict(
        source === branch ? cloud : branch,
        tableName,
        row.id,
        source === branch ? row : existing,
        source === branch ? existing : row,
        applySource ? `${mode}_source_wins` : `${mode}_target_kept`,
      );
      conflicts += 1;
      if (!applySource) continue;
    }

    if (applySource) {
      await upsertPreparedRow(target, tableName, preparedRow);
      changed += 1;
    }
  }

  const checkpointAt =
    rows.length === 0 || rows.length < config.batchSize
      ? highWatermark
      : rows[rows.length - 1]?.[cursorColumn];

  return { processed: rows.length, changed, conflicts, checkpointAt };
}

async function createRun(status = "running") {
  if (dryRun) return null;
  const { data, error } = await branch
    .from("sync_runs")
    .insert({
      local_node_id: config.branchNodeId,
      remote_node_id: config.cloudNodeId,
      direction,
      status,
      tables_processed: tables,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function finishRun(runId, patch) {
  if (dryRun || !runId) return;
  const { error } = await branch
    .from("sync_runs")
    .update({ ...patch, finished_at: new Date().toISOString() })
    .eq("id", runId);
  if (error) throw error;
}

async function main() {
  console.log(
    `Starting ${direction} sync for ${tables.join(", ")}${dryRun ? " (dry run)" : ""}${
      fullSync ? " (full scan)" : ""
    }`,
  );
  const highWatermark = new Date().toISOString();
  await ensureBranchNodes();
  const runId = await createRun();
  let rowsProcessed = 0;
  let rowsChanged = 0;

  try {
    await ensureCloudNodes();

    for (const tableName of tables) {
      const checkpoint = await getCheckpoint(branch, tableName);
      const since = fullSync ? { lastPushedAt: EPOCH, lastPulledAt: EPOCH } : checkpoint;

      if (direction === "push" || direction === "bidirectional") {
        if (TABLE_CONFIGS[tableName].pullOnly) {
          console.log(`push ${tableName}: skipped=pull_only`);
        } else {
          const result = await syncTable({
            tableName,
            source: branch,
            target: cloud,
            mode: "push",
            since: since.lastPushedAt,
            originNodeId: config.branchNodeId,
            highWatermark,
          });
          rowsProcessed += result.processed;
          rowsChanged += result.changed;
          await saveCheckpoint(branch, tableName, { last_pushed_at: result.checkpointAt });
          console.log(
            `push ${tableName}: processed=${result.processed} changed=${result.changed} conflicts=${result.conflicts}`,
          );
        }
      }

      if (direction === "pull" || direction === "bidirectional") {
        const result = await syncTable({
          tableName,
          source: cloud,
          target: branch,
          mode: "pull",
          since: since.lastPulledAt,
          originNodeId: config.cloudNodeId,
          highWatermark,
        });
        rowsProcessed += result.processed;
        rowsChanged += result.changed;
        await saveCheckpoint(branch, tableName, { last_pulled_at: result.checkpointAt });
        console.log(
          `pull ${tableName}: processed=${result.processed} changed=${result.changed} conflicts=${result.conflicts}`,
        );
      }
    }

    await finishRun(runId, {
      status: "success",
      rows_processed: rowsProcessed,
      rows_changed: rowsChanged,
    });
    console.log(`Sync complete: processed=${rowsProcessed} changed=${rowsChanged}`);
  } catch (error) {
    await finishRun(runId, {
      status: "failed",
      rows_processed: rowsProcessed,
      rows_changed: rowsChanged,
      error_message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
