// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { resolvePreset } from "./scripts/deploy-target.mjs";

// Which platform this build targets is decided by branch name (or DEPLOY_TARGET).
// See scripts/deploy-target.mjs and docs/DEPLOYMENT_TARGETS.md.
// `null` means "leave the platform default alone" — that is what Lovable's
// sandbox needs, since it forces its own preset and output directory.
const preset = resolvePreset();

export default defineConfig({
  vite: {
    server: {
      allowedHosts: ["localhost", "127.0.0.1", "crm.local", "crm.giftedsms.com"],
    },
  },
  nitro: preset ? { preset } : true,
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
