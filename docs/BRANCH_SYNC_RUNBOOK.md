# Branch Sync Runbook

This runbook is for the first LAN/offline milestone:

```text
local branch Supabase <-> staging/cloud Supabase
```

The first sync script now syncs the core CRM tables by default:

```text
companies, contacts, deals, leads, tasks, activities
```

It also supports append-only side-effect tables when explicitly requested:

```text
notifications, deal_stage_history, deal_value_history, lead_status_history,
automation_runs, audit_log
```

## Local Vs Production

- The linked Supabase project in `supabase/config.toml` is the online production project.
- The branch/offline Supabase instance is a separate local Docker stack started with the Supabase CLI.
- `supabase status` only reports the local stack after `supabase start` has been run on your machine.
- The local stack gets its own local API URL, anon key, and service role key. It does not reuse the cloud database.

## Prerequisites

- Branch-local Supabase is running.
- Staging Supabase exists and has the same migrations.
- `.env.branch` exists and is filled from `.env.branch.example`.
- `BRANCH_SYNC_NODE_ID` and `CLOUD_SYNC_NODE_ID` are stable UUIDs.
- `SUPABASE_URL` points to local Supabase.
- `.env.production` contains the production cloud Supabase public values.
- `.env` can provide cloud server-only secrets such as `SUPABASE_SERVICE_ROLE_KEY`.
- `CLOUD_SUPABASE_URL` can be left blank in `.env.branch`; scripts will use `.env.production` as the default cloud sync target.
- Actual sync writes still require a production `SUPABASE_SERVICE_ROLE_KEY` from `.env`/`.env.production` or explicit `CLOUD_SUPABASE_SERVICE_ROLE_KEY`.

## Validate Config

Create a branch env from production cloud settings:

```bash
npm run branch:init
```

This creates `.env.branch` from `.env.branch.example`, copies production cloud Supabase values into `CLOUD_*`, uses `.env` for server-only cloud secrets when present, generates stable node IDs, and leaves branch-local Supabase values for you to fill.

```bash
npm run branch:check
```

For a full readout while the local stack is starting or after it is up:

```bash
npm run branch:doctor
```

## Start Local Supabase

On the machine that will host the branch server:

```bash
supabase start
supabase status
```

To populate `.env.local` from the live local stack:

```bash
npm run local:env
```

To mirror those same local values into the branch runtime files as well:

```bash
npm run local:env -- --mirror=.env.branch --mirror=deploy/branch/.env
```

If the branch app should be reachable from other devices on the LAN, pass the
host's LAN URL for the browser-facing Supabase endpoint:

```bash
npm run local:env -- --public-url=http://192.168.1.50:54321 --mirror=.env.branch --mirror=deploy/branch/.env
```

Then apply the migrations to the local stack:

```bash
supabase db reset
```

If you already have the local stack running and only want to reapply schema changes, `supabase db reset`
is the cleanest path for the first milestone.

## Manual Handoff

If the assistant cannot inspect your Docker socket from this environment, paste the output of:

```bash
supabase status
```

Then also paste:

```bash
supabase db reset
npm run branch:doctor -- --json
```

The key facts needed from your machine are:

- local Supabase API URL
- local Supabase anon key
- local Supabase service-role key
- whether migrations applied cleanly
- whether `branch:doctor` reports local and cloud connectivity as healthy

## Validate Schema And Connectivity

Use this before a branch server is handed to users:

```bash
npm run branch:smoke
```

This checks that the local branch Supabase and cloud/staging Supabase both have:

- `leads`
- `sync_nodes`
- `sync_checkpoints`
- `sync_conflicts`
- `sync_runs`
- required lead sync columns

To also validate writes to `sync_nodes`:

```bash
npm run branch:smoke -- --write
```

## Dry Run

```bash
npm run sync:once -- --dry-run
```

## Branch Auth Provisioning

Create users in the online CRM only. Do not manually create the same user in
both online and branch-local Supabase.

CRM data sync pulls profiles and roles into the branch database, but Supabase
Auth login accounts live in the internal `auth` schema. The branch server must
therefore provision matching local Auth accounts before users can sign in while
offline.

The sync watcher runs Auth provisioning automatically after each successful sync:

```bash
npm run sync:watch
```

You can also run it manually:

```bash
npm run branch:provision-auth
```

Existing local branch passwords are kept unchanged by default. Newly provisioned
users get the configured branch temporary password:

```text
BRANCH_TEST_PASSWORD=...
```

If `BRANCH_TEST_PASSWORD` is not set, the script uses its built-in temporary
branch password. To intentionally reset all mirrored local passwords, run:

```bash
npm run branch:provision-auth -- --reset-passwords
```

To disable automatic Auth provisioning in the watcher:

```bash
SYNC_PROVISION_AUTH_AFTER_SYNC=false npm run sync:watch
```

or:

```bash
npm run sync:watch -- --no-provision-auth
```

## One-Time Sync

```bash
npm run sync:once
```

Optional direction:

```bash
npm run sync:once -- --direction=push
npm run sync:once -- --direction=pull
```

Optional table scope:

```bash
npm run sync:once -- --tables=leads
npm run sync:once -- --tables=core
npm run sync:once -- --tables=all
```

Force a full scan instead of using saved checkpoints:

```bash
npm run sync:once -- --direction=pull --tables=core --full
```

Use this after a branch reseed, a failed first migration, or a sync policy fix.

## Watch Mode

```bash
npm run sync:watch
```

The interval is controlled by:

```text
SYNC_INTERVAL_SECONDS=300
```

You can also override the interval without editing the env file:

```bash
npm run sync:watch -- --interval=60
```

The watcher runs continuously and retries on the next interval if a sync attempt fails. In the
Docker branch deployment, the `sync-worker` service starts this watcher automatically.

## Back Up The Branch Database

Before handing a branch server to users, configure a host backup location:

```text
BRANCH_BACKUP_DIR=/var/backups/tally-crm/branch
```

Run a manual backup:

```bash
npm run branch:backup
```

By default this writes two timestamped files under `BRANCH_BACKUP_DIR`:

- `*-schema.sql`
- `*-data.sql`

Internally it uses:

```bash
supabase db dump --local
supabase db dump --local --data-only --use-copy
```

If the branch server uses a direct Postgres connection instead of the local Supabase CLI context, set `BRANCH_DB_URL` or pass:

```bash
npm run branch:backup -- --db-url=postgresql://...
```

Useful variants:

```bash
npm run branch:backup -- --data-only
npm run branch:backup -- --schema-only
npm run branch:backup -- --schema=public,auth,storage
npm run branch:backup -- --file=/var/backups/tally-crm/branch/manual.sql
```

When `--file` is used without `--data-only` or `--schema-only`, the script writes `manual-schema.sql` and `manual-data.sql`.

## First Test Scenario

1. Create a lead in the local branch CRM.
2. Run `npm run sync:once -- --direction=push --tables=leads`.
3. Confirm the lead appears in staging Supabase.
4. Create a lead in staging Supabase.
5. Run `npm run sync:once -- --direction=pull --tables=leads`.
6. Confirm the lead appears locally.
7. Repeat the same push/pull check for a contact, company, deal, task, and activity before handing the branch server to users.

## Conflict Policy In The First Script

- If one side is missing the row, the row is inserted.
- If both sides changed, the newer `updated_at` wins.
- Append-only side-effect tables insert missing rows and keep existing rows unchanged.
- Conflicts are logged to `sync_conflicts`.

This is intentionally simple for the first milestone.
