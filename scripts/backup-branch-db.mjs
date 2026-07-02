import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { loadEnvFile } from "./lib/env.mjs";

loadEnvFile(".env.branch");
loadEnvFile(".env.local");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const dataOnly = args.includes("--data-only");
const schemaOnly = args.includes("--schema-only");
const keepComments = args.includes("--keep-comments");
const useCopy = args.includes("--use-copy");
const outputDir = getArgValue("--output-dir") || process.env.BRANCH_BACKUP_DIR || "backups/branch";
const explicitFile = getArgValue("--file");
const dbUrl = getArgValue("--db-url") || process.env.BRANCH_DB_URL || process.env.DATABASE_URL;
const schemas = getArgValue("--schema");
const excludes = getRepeatedArgValues("--exclude");

function getArgValue(name) {
  const prefix = `${name}=`;
  const index = args.findIndex((arg) => arg === name || arg.startsWith(prefix));
  if (index === -1) return null;
  const arg = args[index];
  if (arg.startsWith(prefix)) return arg.slice(prefix.length);
  return args[index + 1] && !args[index + 1].startsWith("--") ? args[index + 1] : null;
}

function getRepeatedArgValues(name) {
  const prefix = `${name}=`;
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg.startsWith(prefix)) {
      values.push(arg.slice(prefix.length));
    } else if (arg === name && args[index + 1] && !args[index + 1].startsWith("--")) {
      values.push(args[index + 1]);
      index += 1;
    }
  }
  return values;
}

function timestamp() {
  return new Date()
    .toISOString()
    .replaceAll(":", "")
    .replaceAll(".", "")
    .replace("T", "_")
    .replace("Z", "Z");
}

const backupFile =
  explicitFile ||
  path.join(
    outputDir,
    `branch-db-${timestamp()}${dataOnly ? "-data" : schemaOnly ? "-schema" : ""}.sql`,
  );

if (dataOnly && schemaOnly) {
  throw new Error("Use either --data-only or --schema-only, not both.");
}

if (!dryRun) {
  fs.mkdirSync(path.dirname(backupFile), { recursive: true, mode: 0o700 });
}

const dumps =
  dataOnly || schemaOnly
    ? [{ kind: dataOnly ? "data" : "schema", file: backupFile, dataOnly }]
    : [
        { kind: "schema", file: withSuffix(backupFile, "schema"), dataOnly: false },
        { kind: "data", file: withSuffix(backupFile, "data"), dataOnly: true },
      ];

for (const dump of dumps) {
  runDump(dump);
}

function withSuffix(file, suffix) {
  const parsed = path.parse(file);
  return path.join(parsed.dir, `${parsed.name}-${suffix}${parsed.ext || ".sql"}`);
}

function runDump({ kind, file, dataOnly: dumpDataOnly }) {
  const command = ["db", "dump", "--file", file];
  if (dbUrl) {
    command.push("--db-url", dbUrl);
  } else {
    command.push("--local");
  }
  if (dumpDataOnly) command.push("--data-only");
  if (keepComments) command.push("--keep-comments");
  if (useCopy || dumpDataOnly) command.push("--use-copy");
  if (schemas) command.push("--schema", schemas);
  for (const exclude of excludes) command.push("--exclude", exclude);
  if (dryRun) command.push("--dry-run");

  const result = spawnSync("supabase", command, {
    encoding: "utf8",
    stdio: "pipe",
  });

  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    console.error(
      "Branch backup failed. Make sure the local Supabase stack is running, or pass --db-url/BRANCH_DB_URL for a direct Postgres connection.",
    );
    process.exit(result.status || 1);
  }

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  console.log(
    dryRun ? `Branch ${kind} backup dry run complete.` : `Branch ${kind} backup written to ${file}`,
  );
}
