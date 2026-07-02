# Branch/LAN Deployment

The branch deployment lets local network users keep using the CRM when the internet is unavailable.

Target shape:

```text
LAN users -> local CRM app -> local self-hosted Supabase -> sync worker -> cloud Supabase
```

## What Runs Locally

- CRM app server.
- Self-hosted Supabase stack.
- Local Postgres database.
- Local Auth/RLS/RPCs/triggers.
- Sync worker.
- Host-side backup command.

## Environment

Copy the root `.env.branch.example` into the branch deployment environment and fill:

- local Supabase URL and keys,
- cloud Supabase URL and service role key,
- stable branch/cloud node IDs,
- sync interval.

Use staging cloud Supabase first. Do not sync a new branch server directly to production until staging sync has been tested.

## First Milestone

The first milestone is intentionally narrow:

1. Run local Supabase.
2. Run the CRM app against local Supabase.
3. Open the CRM from another device on the LAN.
4. Create and update leads while internet is unavailable.
5. Restore internet.
6. Run `npm run sync:once`.
7. Verify leads arrive in staging Supabase.

## Notes

## App/Synchronizer Compose

This folder includes a compose file for the CRM app and sync worker:

```bash
npm run branch:init -- --output=deploy/branch/.env --template=deploy/branch/.env.example
npm run branch:check -- deploy/branch/.env
npm run branch:smoke -- --env-file=deploy/branch/.env
docker compose --env-file deploy/branch/.env -f deploy/branch/docker-compose.yml up --build
```

The compose file assumes Supabase is already running and reachable through the URLs in `deploy/branch/.env`.
Do not pass root `.env.production` directly to Docker Compose, because its `SUPABASE_URL`
is the cloud Supabase URL. The branch app must use the local Supabase URL for `SUPABASE_URL`
and the production cloud URL only through `CLOUD_SUPABASE_URL`.

`branch:init` reads `.env.production` for production public values and `.env` for
server-only cloud secrets such as `SUPABASE_SERVICE_ROLE_KEY`.

## Supabase Compose

Do not treat this folder's compose file as the full Supabase self-hosting stack. Use Supabase's official self-hosting Docker setup for the local Supabase services, then point this app at that local Supabase URL.

The first implementation milestone is:

- local Supabase running separately,
- app and sync worker running from this folder's compose file,
- sync tested against staging Supabase before production.

## Backups

Run database backups from the host that can access the local Supabase CLI context:

```bash
npm run branch:backup
```

Set `BRANCH_BACKUP_DIR` to a durable location such as `/var/backups/tally-crm/branch`.
The command writes separate schema and data SQL files. It uses `supabase db dump --local`
unless `BRANCH_DB_URL` or `--db-url` is provided.
Schedule it with the host's normal scheduler and keep backup files outside this repo.
