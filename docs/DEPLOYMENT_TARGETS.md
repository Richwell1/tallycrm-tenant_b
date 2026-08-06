# Deployment targets

One codebase, three hosting platforms. **The branch you push decides where it
deploys** — there is no per-deploy flag to remember and no way to accidentally
ship a Cloudflare build to Vercel.

| Branch                   | Target             | How it ships                                              |
| ------------------------ | ------------------ | --------------------------------------------------------- |
| `main`                   | Cloudflare Workers | `.github/workflows/deploy-cloudflare.yml` → `wrangler deploy` |
| `deploy/cloudflare`      | Cloudflare Workers | same workflow (use when `main` should stay undeployed)     |
| `deploy/vercel`          | Vercel             | `.github/workflows/deploy-vercel.yml` → `vercel deploy --prebuilt` |
| `lovable-implementation` | Lovable            | published from the Lovable app, no workflow                |
| anything else            | none               | CI only (`ci.yml`: lint + security tests + build)          |

## How the target is chosen

`scripts/deploy-target.mjs` is the single source of truth. It maps the current
branch to a target, and each target to a Nitro preset:

| Target       | Nitro preset         | Build output    |
| ------------ | -------------------- | --------------- |
| `cloudflare` | `cloudflare-module`  | `.output/`      |
| `vercel`     | `vercel`             | `.vercel/output/` (Build Output API v3) |
| `lovable`    | platform default     | `dist/`         |

`vite.config.ts` calls `resolvePreset()` from that script, so a plain
`vite build` on `deploy/vercel` already produces a Vercel bundle.

Check what the current branch would do:

```bash
npm run deploy:which
```

Force a target for a one-off build (overrides the branch):

```bash
DEPLOY_TARGET=vercel npm run build      # or cloudflare / lovable
```

The branch is read from `DEPLOY_BRANCH`, then the CI-provided ref
(`GITHUB_REF_NAME`, `VERCEL_GIT_COMMIT_REF`, `CF_PAGES_BRANCH`), then
`git rev-parse` — so detached-HEAD CI checkouts still resolve correctly.

## Shipping a change

Develop on a feature branch (CI only), then merge into the branch for the
platform you want:

```bash
# Cloudflare
git checkout main && git merge feature/my-work && git push

# Vercel
git checkout deploy/vercel && git merge main && git push

# Lovable
git checkout lovable-implementation && git merge main && git push
```

A branch can be pushed to several targets — merge into each one. Nothing in the
source is platform-specific; only the preset changes.

### Creating the deploy branches (first time)

```bash
git checkout -b deploy/vercel main && git push -u origin deploy/vercel
```

## Required secrets

Set these as GitHub Actions secrets. If you want deploys scoped per platform or
gated behind a reviewer, create `cloudflare` / `vercel` GitHub Environments and
uncomment the `environment:` line in each workflow — the secrets then live on
the environment instead of the repository.

**Both targets**

| Secret                          | Why                                      |
| ------------------------------- | ---------------------------------------- |
| `VITE_SUPABASE_URL`             | baked into the client bundle at build time |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | the anon/publishable key, likewise         |

**Cloudflare**

| Secret                   | Where to get it                                    |
| ------------------------ | -------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`   | Cloudflare dashboard → API Tokens (Edit Workers)   |
| `CLOUDFLARE_ACCOUNT_ID`  | Cloudflare dashboard → Workers overview            |

Runtime secrets (service-role keys, dispatch secrets) are pushed separately with
`npm run secrets:staging` / `wrangler secret put`, not through the workflow.

**Vercel**

| Secret              | Where to get it                                     |
| ------------------- | --------------------------------------------------- |
| `VERCEL_TOKEN`      | Vercel → Account Settings → Tokens                  |
| `VERCEL_ORG_ID`     | `.vercel/project.json` after `vercel link`, or project settings |
| `VERCEL_PROJECT_ID` | same                                                |

Server-side env vars (anything not prefixed `VITE_`) are set in the Vercel
project's Environment Variables, not in the workflow.

## Why the build runs in CI, not on the platform

Both deploy workflows build on GitHub runners and upload a finished bundle
(`wrangler deploy` against `.output/server/wrangler.json`, `vercel deploy
--prebuilt` against `.vercel/output`). That keeps one behaviour across targets:
the same Node version, the same `npm ci`, and the same lint + security-test
gates run before anything reaches a host.

`vercel.json` disables Vercel's own Git integration for `main`, `master`, and
`lovable-implementation` so a connected Vercel project cannot double-deploy a
branch that belongs to another platform.

## Lovable

Lovable builds inside its own sandbox, which forces its own preset and output
directory. `resolvePreset()` returns `null` for that target precisely so nothing
here overrides it — keep `lovable-implementation` free of platform-specific
config and let the Lovable app publish it.

## Adding a target or remapping a branch

Edit `BRANCH_TARGETS` / `TARGETS` in `scripts/deploy-target.mjs` and add the
matching workflow. `vite.config.ts`, `npm run deploy:which`, and both workflows
read from that one place, so they cannot drift apart.
