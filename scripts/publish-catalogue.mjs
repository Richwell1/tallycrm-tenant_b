import { execFileSync } from "node:child_process";
import { appendFile } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import path from "node:path";

const controlPlaneUrl = process.env.CONTROL_PLANE_URL?.trim();
const serviceRoleKey = process.env.CONTROL_PLANE_SERVICE_KEY?.trim();

if (!controlPlaneUrl || !serviceRoleKey) {
  throw new Error(
    "CONTROL_PLANE_URL and CONTROL_PLANE_SERVICE_KEY are required to publish the catalogue.",
  );
}

const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8",
}).trim();
const detectedBranch = execFileSync("git", ["branch", "--show-current"], {
  encoding: "utf8",
}).trim();
const sourceBranch = process.env.SOURCE_BRANCH?.trim() || detectedBranch;

if (!sourceBranch) {
  throw new Error("Could not determine the current branch. Set SOURCE_BRANCH explicitly.");
}

const trackedFiles = execFileSync("git", ["ls-files", "-z", "--", ":(glob)**/feature.json"], {
  encoding: "utf8",
  cwd: repoRoot,
})
  .split("\0")
  .filter(Boolean)
  .sort();

const requiredString = (manifest, field, manifestPath) => {
  if (typeof manifest[field] !== "string" || !manifest[field].trim()) {
    throw new Error(`${manifestPath}: ${field} must be a non-empty string.`);
  }
  return manifest[field].trim();
};

const rows = [];
const seenKeys = new Set();

for (const relativePath of trackedFiles) {
  const manifestPath = path.join(repoRoot, relativePath);
  let manifest;

  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    throw new Error(`Could not read ${relativePath}: ${error.message}`, { cause: error });
  }

  const featureKey = requiredString(manifest, "key", relativePath);
  const name = requiredString(manifest, "name", relativePath);
  const scope = requiredString(manifest, "scope", relativePath);
  const version = requiredString(manifest, "version", relativePath);

  if (!["all", "named"].includes(scope)) {
    throw new Error(`${relativePath}: scope must be either "all" or "named".`);
  }
  if (
    !Array.isArray(manifest.audience) ||
    !manifest.audience.every((item) => typeof item === "string")
  ) {
    throw new Error(`${relativePath}: audience must be an array of strings.`);
  }
  if (typeof manifest.has_migration !== "boolean") {
    throw new Error(`${relativePath}: has_migration must be a boolean.`);
  }
  if (seenKeys.has(featureKey)) {
    throw new Error(`Duplicate feature key "${featureKey}" found on ${sourceBranch}.`);
  }

  seenKeys.add(featureKey);
  rows.push({
    feature_key: featureKey,
    name,
    description:
      typeof manifest.description === "string" && manifest.description.trim()
        ? manifest.description.trim()
        : name,
    version,
    scope,
    audience: manifest.audience,
    has_migration: manifest.has_migration,
    source_branch: sourceBranch,
    published_at: new Date().toISOString(),
  });
}

if (rows.length === 0) {
  console.log(`No feature.json files found on ${sourceBranch}; nothing to publish.`);
  process.exit(0);
}

const endpoint = `${controlPlaneUrl.replace(/\/$/, "")}/rest/v1/catalogue?on_conflict=feature_key`;
const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    Prefer: "resolution=merge-duplicates,return=minimal",
  },
  body: JSON.stringify(rows),
});

if (!response.ok) {
  const detail = await response.text();
  throw new Error(
    `Catalogue publish failed (${response.status} ${response.statusText}): ${detail}`,
  );
}

console.log(
  `Published ${rows.length} feature${rows.length === 1 ? "" : "s"} from ${sourceBranch}:`,
);
for (const row of rows) {
  const audience = row.audience.length > 0 ? row.audience.join(", ") : "all tenants";
  console.log(`- ${row.feature_key} (${row.scope}; ${audience})`);
}

if (process.env.GITHUB_STEP_SUMMARY) {
  const escapeCell = (value) => String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
  const summaryRows = rows
    .map((row) => {
      const audience = row.audience.length > 0 ? row.audience.join(", ") : "All tenants";
      return `| ${escapeCell(row.feature_key)} | ${escapeCell(row.scope)} | ${escapeCell(audience)} | ${escapeCell(sourceBranch)} |`;
    })
    .join("\n");
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `${summaryRows}\n`);
}
