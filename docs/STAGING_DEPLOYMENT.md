# Staging Deployment

This project must use a separate staging cloud deployment for offline/LAN sync work.
Do not point staging at production Supabase.

## Environment Split

```text
Production
  Cloudflare Worker: crm-core-components
  Supabase project: production
  Domain: production domain

Staging
  Cloudflare Worker: crm-core-components-staging
  Supabase project: staging
  Domain: staging domain or workers.dev URL
```

## Required Setup

1. Create a separate Supabase project for staging.
2. Apply the repo migrations to staging.
3. Copy `.env.staging.example` to `.env.staging`.
4. Fill all Supabase values with staging values only.
5. Configure Cloudflare secrets for the `staging` Wrangler environment.
6. Deploy with:

```bash
npm run secrets:staging
npm run deploy:staging
```

## Cloudflare Configuration

Staging uses a separate Worker config:

```text
wrangler.staging.jsonc
name = crm-core-components-staging
```

Production deploy remains:

```bash
npm run deploy
```

Staging deploy is:

```bash
npm run deploy:staging
```

Staging secrets are pushed from `.env.staging` to the staging Worker:

```bash
npm run secrets:staging
```

The secret push script refuses to run if `.env.staging` points to the same Supabase project as `.env.production`.

## Secret Rules

Never reuse production secrets in staging:

- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `AUTOMATION_DISPATCH_SECRET`

The public `VITE_SUPABASE_*` values are safe to expose, but they must still point to the staging Supabase project for staging builds.

## Validation Checklist

- The staging app opens on the staging Worker URL.
- `VITE_SUPABASE_URL` points to the staging project.
- Lead capture writes to staging.
- Auth users are staging users.
- No production leads/contacts/deals appear in staging.
- Email is disabled or uses a staging-safe sender.

## Branch Sync Validation

Use staging as the first cloud target for any new branch server. The branch
server should point `SUPABASE_URL` at local Supabase and point
`CLOUD_SUPABASE_URL`/`CLOUD_SUPABASE_SERVICE_ROLE_KEY` at staging until the
branch smoke checks and sync checks pass.

Recommended branch validation sequence:

```bash
npm run branch:check -- deploy/branch/.env
npm run branch:smoke -- --env-file=deploy/branch/.env
npm run sync:once -- --env-file=deploy/branch/.env --dry-run
```

Only switch `CLOUD_*` values to production after staging confirms local Auth
provisioning, role mirroring, bidirectional core CRM sync, and no unexpected
production data exposure.
