// Types for deploy-target.mjs, which vite.config.ts imports to pick the Nitro
// preset. The script itself stays plain ESM so the GitHub workflows and
// `npm run deploy:which` can run it without a build step.

export type DeployTarget = "cloudflare" | "vercel" | "lovable" | "none";

export interface DeployTargetConfig {
  /** Nitro preset, or null to leave the platform default alone. */
  preset: string | null;
  outputDir: string;
  buildCommand: string;
  deployCommand: string;
  description: string;
}

export declare const BRANCH_TARGETS: Array<{ branch: string; target: DeployTarget }>;
export declare const TARGETS: Record<DeployTarget, DeployTargetConfig>;

export declare function currentBranch(): string;
export declare function resolveTarget(branch?: string): DeployTarget;
export declare function resolvePreset(branch?: string): string | null;
