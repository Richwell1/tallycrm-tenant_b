import process from "node:process";
import { spawn } from "node:child_process";
import { applyCloudFallbackFromEnvFiles, loadEnvFile } from "./lib/env.mjs";

loadEnvFile(".env.branch");
applyCloudFallbackFromEnvFiles([".env.production", ".env"]);
loadEnvFile(".env.local");

const intervalArg = process.argv.find((arg) => arg.startsWith("--interval="));
const intervalSeconds = Number(
  intervalArg?.split("=")[1] || process.env.SYNC_INTERVAL_SECONDS || 300,
);
const syncArgs = process.argv.slice(2).filter((arg) => !arg.startsWith("--interval="));

if (!Number.isFinite(intervalSeconds) || intervalSeconds < 30) {
  throw new Error("--interval/SYNC_INTERVAL_SECONDS must be at least 30");
}

let running = false;

function runOnce() {
  if (running) {
    console.warn("Previous sync is still running; skipping this interval");
    return;
  }

  running = true;
  const child = spawn(process.execPath, ["scripts/sync-once.mjs", ...syncArgs], {
    stdio: "inherit",
    env: process.env,
  });

  child.on("exit", (code) => {
    running = false;
    if (code !== 0) {
      console.error(`sync-once exited with code ${code}`);
    }
  });
}

console.log(`Starting sync watcher. Interval: ${intervalSeconds}s`);
runOnce();
setInterval(runOnce, intervalSeconds * 1000);
