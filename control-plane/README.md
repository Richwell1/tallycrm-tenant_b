# Prymage marketplace control plane

This directory defines the central data store for the Prymage feature marketplace. It records the known tenants, the feature catalogue, and each tenant's installation state.

The control plane is a separate Supabase project. No tenant application connects to it directly, and its schema must never be copied into `supabase/migrations/`, because that directory is applied to every tenant database.

## Apply the schema

Copy the control-plane project's direct Postgres connection string from **Supabase Dashboard → Connect**. Then apply the file with `psql`:

```bash
export CONTROL_PLANE_DB_URL='postgresql://postgres:<DATABASE_PASSWORD>@db.<CONTROL_PLANE_PROJECT_REF>.supabase.co:5432/postgres'
psql "$CONTROL_PLANE_DB_URL" -v ON_ERROR_STOP=1 -f control-plane/schema.sql
unset CONTROL_PLANE_DB_URL
```

Use the **Session pooler** connection string from the same dialog instead if the machine running `psql` cannot reach the direct project's IPv6 endpoint. The SQL is idempotent and can be run again safely. It creates the tables, view, triggers, access policies, and initial tenant records.

## Repository secrets

The catalogue publishing workflow needs these GitHub Actions repository secrets:

- `CONTROL_PLANE_URL`: the Project URL shown under **Supabase Dashboard → Project Settings → API** for the dedicated control-plane project.
- `CONTROL_PLANE_SERVICE_KEY`: the `service_role` secret shown on the same API settings page. This key bypasses row-level security and must never be exposed to a browser, tenant application, or committed file.

These secrets belong to the central repository's workflow environment, not to tenant deployments.
