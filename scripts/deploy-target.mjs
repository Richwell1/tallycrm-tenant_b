// Single source of truth for "which branch deploys where".
//
// The deploy target is chosen by branch name so pushing a branch picks the
// platform. DEPLOY_TARGET overrides it for one-off builds and for CI jobs that
// already know where they are going.
//
// Imported by vite.config.ts (to pick the Nitro preset) and run directly by the
// GitHub workflows and by `npm run deploy:which`.

import { execFileSync } from "node:child_process";
import process from "node:process";

/** branch name (or glob-free prefix) → deploy target */
export const BRANCH_TARGETS = [
  { branch: "main", target: "cloudflare" },
  { branch: "master", target: "cloudflare" },
  { branch: "deploy/vercel", target: "vercel" },
  { branch: "deploy/cloudflare", target: "cloudflare" },
  { branch: "lovable-implementation", target: "lovable" },
];

export const TARGETS = {
  cloudflare: {
    // The Lovable vite config already defaults to cloudflare-module; naming it
    // explicitly keeps the build identical whether or not that default moves.
    preset: "cloudflare-module",
    outputDir: ".output",
    buildCommand: "npm run build:cloudflare",
    deployCommand: "npm run deploy:cloudflare",
    description: "Cloudflare Workers via wrangler",
  },
  vercel: {
    preset: "vercel",
    outputDir: ".vercel/output",
    buildCommand: "npm run build:vercel",
    deployCommand: "vercel deploy --prebuilt --prod",
    description: "Vercel Build Output API v3",
  },
  lovable: {
    // Lovable builds inside its own sandbox, which forces its own preset and
    // output directory. Nothing here should override that.
    preset: null,
    outputDir: "dist",
    buildCommand: "npm run build",
    deployCommand: "(published from the Lovable app)",
    description: "Lovable hosting",
  },
  none: {
    preset: null,
    outputDir: ".output",
    buildCommand: "npm run build",
    deployCommand: "(no deploy — CI only)",
    description: "CI only, no deployment",
  },
};

export function currentBranch() {
  // CI checkouts are detached, so trust the CI-provided ref first.
  const fromEnv =
    process.env.DEPLOY_BRANCH ||
    process.env.GITHUB_REF_NAME ||
    process.env.VERCEL_GIT_COMMIT_REF ||
    process.env.CF_PAGES_BRANCH;
  if (fromEnv) return fromEnv;

  try {
    return execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

export function resolveTarget(branch = currentBranch()) {
  const override = process.env.DEPLOY_TARGET?.trim();
  if (override) {
    if (!TARGETS[override]) {
      throw new Error(
        `Unknown DEPLOY_TARGET "${override}". Expected one of: ${Object.keys(TARGETS).join(", ")}`,
      );
    }
    return override;
  }

  const match = BRANCH_TARGETS.find((entry) => entry.branch === branch);
  return match ? match.target : "none";
}

export function resolvePreset(branch = currentBranch()) {
  return TARGETS[resolveTarget(branch)].preset;
}

// ── CLI ───────────────────────────────────────────────────────────────────────
// node scripts/deploy-target.mjs            → human-readable summary
// node scripts/deploy-target.mjs --print=target|preset|build|deploy|outputDir
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  const branch = currentBranch();
  const target = resolveTarget(branch);
  const config = TARGETS[target];
  const printArg = process.argv.find((arg) => arg.startsWith("--print="))?.split("=")[1];

  if (printArg) {
    const values = {
      target,
      preset: config.preset ?? "",
      build: config.buildCommand,
      deploy: config.deployCommand,
      outputDir: config.outputDir,
      branch,
    };
    if (!(printArg in values)) {
      console.error(`Unknown --print value "${printArg}"`);
      process.exit(1);
    }
    console.log(values[printArg]);
  } else {
    console.log(`Branch:    ${branch || "(unknown)"}`);
    console.log(`Target:    ${target} — ${config.description}`);
    console.log(`Preset:    ${config.preset ?? "(platform default)"}`);
    console.log(`Build:     ${config.buildCommand}`);
    console.log(`Deploy:    ${config.deployCommand}`);
    console.log(`Output:    ${config.outputDir}`);
    if (target === "none") {
      console.log(
        "\nThis branch is not mapped to a deploy target. Set DEPLOY_TARGET=<cloudflare|vercel|lovable>",
      );
      console.log("to force one, or merge into a mapped branch:");
      for (const entry of BRANCH_TARGETS) console.log(`  ${entry.branch} → ${entry.target}`);
    }
  }
}
