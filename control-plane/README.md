# Prymage marketplace control plane

This directory defines the central data store for the Prymage feature marketplace. It records the known tenants, the feature catalogue, and each tenant's installation state in the dedicated `control_plane` Postgres schema.

Because the available Supabase free-tier project allowance is exhausted, the control plane currently shares tenant_a's Supabase project (`hqtzdoeuifgeszpkkfmh`). This is a temporary infrastructure compromise: the `control_plane` schema contains Prymage platform data, not tenant_a application data, and tenant application tables remain in `public`. Move the schema to its own Supabase project as soon as one is available.

This schema must never be copied into `supabase/migrations/`, because that directory is applied to every tenant database. Apply this file only to the one project hosting the control plane.

## Apply the schema

Copy tenant_a's direct Postgres connection string from **Supabase Dashboard → Connect**. Then apply the file with `psql`:

```bash
export CONTROL_PLANE_DB_URL='postgresql://postgres:<TENANT_A_DATABASE_PASSWORD>@db.hqtzdoeuifgeszpkkfmh.supabase.co:5432/postgres'
psql "$CONTROL_PLANE_DB_URL" -v ON_ERROR_STOP=1 -f control-plane/schema.sql
unset CONTROL_PLANE_DB_URL
```

Use the **Session pooler** connection string from the same dialog instead if the machine running `psql` cannot reach the direct project's IPv6 endpoint. The SQL is idempotent and can be run again safely. It creates the tables, view, triggers, access policies, and initial tenant records.

In **Supabase Dashboard → Project Settings → API → Exposed schemas**, add `control_plane`. The catalogue publisher cannot access a custom schema through the Data API until it is exposed.

## Repository secrets

The catalogue publishing workflow needs these GitHub Actions repository secrets:

- `CONTROL_PLANE_URL`: `https://hqtzdoeuifgeszpkkfmh.supabase.co`, tenant_a's Project URL.
- `CONTROL_PLANE_SERVICE_KEY`: tenant_a's `service_role` secret shown under **Supabase Dashboard → Project Settings → API**. This key bypasses row-level security and must never be exposed to a browser, tenant application, or committed file.

These secrets belong to the central repository's workflow environment, not to tenant deployments.

## Move to a dedicated project later

Postgres cannot move a schema directly between databases. Export the schema and its data as SQL, then restore that SQL into the new control-plane project:

```bash
export CURRENT_CONTROL_PLANE_DB_URL='<TENANT_A_DIRECT_OR_SESSION_CONNECTION_STRING>'
export NEW_CONTROL_PLANE_DB_URL='<DEDICATED_PROJECT_DIRECT_OR_SESSION_CONNECTION_STRING>'

pg_dump "$CURRENT_CONTROL_PLANE_DB_URL" \
  --schema=control_plane \
  --format=plain \
  --no-owner \
  --file=/tmp/control-plane-move.sql

psql "$NEW_CONTROL_PLANE_DB_URL" \
  -v ON_ERROR_STOP=1 \
  -f /tmp/control-plane-move.sql
```

Add `control_plane` to the new project's exposed schemas, update the two repository secrets, run the catalogue publisher, and verify the restored tables and rows. Only after that verification, remove the old copy from tenant_a by running this SQL against tenant_a:

```sql
begin;
drop schema control_plane cascade;
commit;
```
