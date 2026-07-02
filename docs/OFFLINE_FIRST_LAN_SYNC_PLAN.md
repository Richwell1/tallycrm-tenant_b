# Offline-First LAN Deployment And Sync Implementation Plan

**Project:** Tally CRM + TallyPrime Landing Page
**Target:** Offline-first CRM for a local network, with cloud sync when internet is available
**Date:** 2026-07-01
**Status:** Planning document
**Decision update:** For the current requirement, the recommended default is a local branch server running self-hosted Supabase/Postgres plus the CRM app. PowerSync remains an optional future layer for per-device offline use.

---

## 1. Executive Summary

The goal is to make the CRM usable when there is no internet connection while preserving the current backend stack as much as possible. The clarified requirement is that the application should be deployable on a local network so multiple users can access the CRM from their devices even when the internet is unavailable.

For this requirement, the recommended architecture is a **local branch server**:

```text
LAN users' browsers
        |
        | http://crm.local or local server IP
        v
Local CRM app server
        |
        | local Supabase URL/key
        v
Local self-hosted Supabase
  - Postgres
  - Auth
  - RLS
  - RPCs/triggers
  - Storage where needed
        |
        | sync job when internet is available
        v
Cloud Supabase
```

This is different from the browser/device offline model. In the LAN model, users do not each run their own local database. They all connect to the same local server. The local server becomes the operational system while offline. The cloud database becomes the remote/shared backup and aggregation point when connectivity returns.

This is the better fit when:

- Multiple users are in the same office/branch.
- They can reach a local Wi-Fi/LAN server.
- The office may lose internet but still needs full CRM access.
- We want local Auth, RLS, RPCs, triggers, and Postgres behavior to keep working.
- We want to avoid rewriting the app's data hooks to a new local SQLite API.

PowerSync remains useful for a different requirement: each individual device must continue working when away from the LAN server. That is not the primary architecture for this clarified requirement.

References:

- Supabase self-hosting docs: https://supabase.com/docs/guides/self-hosting
- PowerSync + Supabase guide: https://docs.powersync.com/integrations/supabase/guide
- PowerSync JavaScript SDK docs: https://docs.powersync.com/client-sdk-references/javascript-web
- Supabase RLS docs: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase local development docs: https://supabase.com/docs/guides/local-development

---

## 2. Current Architecture Summary

The current app is a TanStack Start / React application with direct Supabase integration.

Important existing files:

- `src/integrations/supabase/client.ts`
  - Browser Supabase client.
  - Also contains the current local preview fallback.
- `src/integrations/supabase/client.server.ts`
  - Service-role Supabase client for trusted server operations.
- `src/integrations/supabase/auth-middleware.ts`
  - Server function middleware that verifies Supabase bearer tokens.
- `src/lib/auth-context.tsx`
  - Hydrates the current user from Supabase Auth, profiles, and roles.
- `src/routes/_authenticated/route.tsx`
  - Enforces auth and MFA before CRM routes load.
- `src/lib/*-data.ts`
  - Most CRUD hooks call `supabase.from(...)` directly.
- `src/lib/lead-capture.server.ts`
  - Public lead capture server route; writes through Supabase RPC/service role.
- `supabase/migrations/*`
  - Schema, RLS, triggers, automation tables, RPCs, audit log, email queue.
- `supabase/functions/send-automation-email/index.ts`
  - Edge Function for Resend email dispatch.

Current backend behaviors:

- Supabase Auth handles sign-in, password reset, sessions, MFA.
- Supabase Postgres stores all CRM data.
- RLS enforces role and ownership boundaries.
- Postgres triggers/RPCs handle important automation side effects.
- Supabase Edge Functions/Resend handle outbound email.
- React Query fetches CRM data via direct Supabase client calls.

---

## 3. Target Architecture

### 3.1 High-Level System

```text
                 Local network, works without internet

      User A browser       User B browser       User C browser
            |                    |                    |
            +--------------------+--------------------+
                                 |
                                 v
                       +-------------------+
                       | Local CRM server  |
                       | TanStack app      |
                       +---------+---------+
                                 |
                                 v
                       +-------------------+
                       | Local Supabase    |
                       | Postgres/Auth/RLS |
                       | RPCs/triggers     |
                       +---------+---------+
                                 |
                    internet available only sometimes
                                 |
                                 v
                       +-------------------+
                       | Cloud Supabase    |
                       | shared/remote DB  |
                       +-------------------+
```

### 3.2 What Changes

The application keeps the Supabase API shape. Instead of replacing reads/writes with PowerSync local SQLite queries, the app points to a local Supabase instance while deployed in offline LAN mode.

Main changes:

- Add an offline/LAN deployment profile.
- Run self-hosted Supabase on the local server.
- Run the CRM app server on the same local server.
- Point `SUPABASE_URL`, `VITE_SUPABASE_URL`, and related keys to the local Supabase instance.
- Apply the existing `supabase/migrations` to the local database.
- Seed/mirror users, roles, settings, pipeline stages, and core lookup data locally.
- Add a custom sync service to move changes between local Supabase and cloud Supabase when internet is available.

### 3.3 What Does Not Change

We should not rewrite the backend into a different platform.

The following should remain:

- Supabase Auth as the source of truth for users and sessions.
- Supabase Postgres as the source of truth for shared data in each deployment.
- Existing tables where possible.
- Existing RLS policies where possible.
- Existing migrations as the backend schema source of truth.
- Existing Edge Function/email flow for online/cloud dispatch.

### 3.4 Local Supabase Versus PowerSync

Use local Supabase as the default when users are on the same LAN:

- Better backend parity.
- Minimal frontend data-layer rewrite.
- Local Auth/RLS/RPCs/triggers continue to work.
- Multiple users share one local database.

Use PowerSync only if individual devices must work without reaching the branch server:

- Stronger per-device offline behavior.
- Requires frontend read/write refactor.
- Local SQLite does not run Postgres RLS/RPCs/triggers.
- Better for mobile/field users than for an office LAN server.

---

## 4. Core Offline-First Rules

### 4.1 Local First

All normal CRM screens should read from the local Supabase database in LAN deployment mode. The UI should not depend on a live internet request for normal CRM browsing.

Examples:

- Leads list
- Lead detail
- Contacts
- Companies
- Deals
- Pipeline
- Activities
- Tasks
- Dashboard metrics
- Most analytics

### 4.2 Cloud Authoritative

Supabase remains authoritative for:

- Authentication
- MFA enrollment/verification
- User creation/invites/password resets
- Final RLS enforcement
- Cross-user shared state
- Email sending
- File storage
- Server-side automation triggers

### 4.3 Offline Writes Are Local-Authoritative

When the branch is offline from the internet, writes should be accepted by the local Supabase database as normal committed database writes. They are not merely browser-side optimistic writes. They are authoritative inside that branch until cloud sync runs.

Examples:

- Create lead
- Update lead status
- Add contact
- Update deal stage
- Complete task
- Add activity

The local UI should show the result immediately because the write has been committed locally. The sync service later uploads the change to cloud Supabase. If the cloud sync rejects the write because of validation, conflict, or cloud-side policy, the app must surface that sync error.

### 4.4 Local Authentication Works On LAN

In LAN deployment mode, authentication is handled by local Supabase Auth. Users can sign in while the internet is unavailable as long as their user exists in the local Supabase Auth database.

First-time provisioning of users should still be controlled carefully. The safest Phase 1 rule is:

- Users are created/provisioned while the branch is online or during initial local setup.
- Offline invite acceptance, password reset, and email-based flows are disabled or handled by an admin locally.
- Cloud and local user IDs must remain aligned for sync.

---

## 5. Authentication Plan

### 5.1 Online Authentication

Authentication continues to use Supabase Auth, but the active Auth service depends on deployment mode:

- Cloud deployment: cloud Supabase Auth.
- LAN/offline deployment: local self-hosted Supabase Auth.

Supported online/cloud flows:

- Email/password sign-in.
- Supabase session management.
- MFA/AAL2 check for `/app/*`.
- Password reset.
- MFA enrollment.
- MFA reset/admin flows.

Existing files remain central:

- `src/routes/auth.tsx`
- `src/routes/mfa.tsx`
- `src/routes/reset-password.tsx`
- `src/routes/_authenticated/route.tsx`
- `src/lib/auth-context.tsx`

### 5.2 LAN Offline Session Access

When the local server is running, users access the app through the LAN and authenticate against local Supabase Auth.

Offline LAN access should be allowed only if all of these are true:

- The local Supabase stack is running.
- The user exists in local `auth.users`.
- The user has a local `profiles` row and `user_roles` row.
- Local Auth/MFA requirements are satisfied.
- The user status is not inactive.

Recommended local cache fields:

```ts
type OfflineSessionSnapshot = {
  userId: string;
  email: string;
  fullName: string | null;
  role: "admin" | "manager" | "rep";
  aal: "aal1" | "aal2";
  lastVerifiedAt: string;
  expiresAt: string;
};
```

Recommended provisioning approach:

- Cloud creates/manages official users.
- Local branch setup mirrors those users into local Supabase using the same user IDs where possible.
- Local `profiles` and `user_roles` mirror cloud values.
- Local admin can deactivate users locally if needed.
- On reconnect, user/profile/role changes sync from cloud to local, with cloud as the default winner for security-related fields.

### 5.3 Optional Local Unlock

For stronger offline security, add a local unlock step after the first online login:

- Local PIN.
- Device password/passkey where available.
- Short offline timeout, for example 8-24 hours.

This does not replace Supabase Auth. It only gates access to already-synced local data.

### 5.4 Offline Auth Limitations

These features should be online-only:

- Email-delivered password reset.
- Email invite acceptance.
- OAuth sign-in.
- Cross-branch user provisioning.

These features can be local-admin-only in LAN mode:

- Temporary password creation.
- Local user activation/deactivation.
- Local password change.
- Local role assignment, if the business accepts that local role changes later sync to cloud.

These features need careful testing before offline support:

- MFA enrollment.
- MFA reset.
- Role changes that must immediately revoke local access.

When offline, the UI should clearly show these actions as unavailable.

---

## 6. RLS And Authorization Plan

### 6.1 Online RLS

Supabase RLS remains the authoritative security layer for the online database.

All uploaded writes must still pass Supabase RLS and constraints.

Existing RLS policies in `supabase/migrations` should stay in force.

### 6.2 Offline RLS Equivalent

In LAN deployment mode, Postgres RLS runs inside the local Supabase database. This is one of the main reasons local Supabase is the right default for this requirement.

Offline authorization is handled by:

- Local Supabase Auth.
- Local `profiles` and `user_roles`.
- Local Postgres RLS policies.
- Existing app route guards.
- Existing UI role guards.

The cloud database will also enforce RLS when data syncs to the cloud.

Example intent:

- Admin: sync all CRM records.
- Manager: sync team/global CRM records according to current RLS rules.
- Rep: sync only assigned/owned records plus shared lookup tables.

### 6.3 Revocation Caveat

If a user's access is revoked while they are offline, already-synced local data remains on that device until it reconnects and receives a purge/change.

Mitigation:

- Keep local user/role data synced from cloud.
- Add local session expiry if required.
- On reconnect, refresh profile/role before allowing sync or writes.
- If role/status is inactive, block local login and/or deactivate the local user.
- Keep branch server physically and network-secured.
- Use backups and disk encryption for the branch server.

---

## 7. Data Model Requirements

### 7.1 Required For Sync-Friendly Tables

Every table that participates in offline sync should have:

- Stable primary key generated before upload, preferably UUID.
- `created_at`.
- `updated_at`.
- `deleted_at` for soft deletes.
- Enough ownership/assignment columns for sync stream filtering.

Most current core tables already use UUIDs and timestamps. We need to audit all synced tables for soft-delete consistency.

### 7.2 Tables To Sync In Phase 1

Core offline CRM tables:

- `profiles`
- `user_roles`
- `pipeline_stages`
- `loss_reasons`
- `app_settings`
- `companies`
- `contacts`
- `leads`
- `deals`
- `activities`
- `tasks`
- `deal_stage_history`
- `deal_value_history`
- `lead_status_history`
- `notifications`
- `automation_rules`
- `automation_runs`
- `audit_log`

### 7.3 Tables To Treat Carefully

`email_queue`

- Offline writes may create rows that eventually need email dispatch.
- To avoid duplicate emails, each email queue row needs an idempotency key or stable UUID.
- Email should only be sent by cloud/online workers.

`user_invites`

- Admin view can sync read-only.
- Creating invites should be online-only for Phase 1.

`lead_assignment_queue`

- Settings can sync.
- Actual assignment behavior needs explicit rules.

Storage objects/company logos:

- File upload should be online-only in Phase 1 or queued separately.
- Local previews can use temporary object URLs until upload succeeds.

### 7.4 Soft Deletes

Offline sync systems need soft deletes so clients can learn that a row was deleted after they reconnect.

Existing app behavior already uses `deleted_at` on many CRM tables. We need to ensure all synced mutable tables either:

- use `deleted_at`, or
- are append-only and never deleted, or
- are lookup tables where deletes are rare and can be handled online-only.

Hard deletes should be avoided for synced tables.

---

## 8. Sync Scope By Role

The local branch database should contain the data that the branch is allowed to operate on. Inside that local database, normal Supabase Auth/RLS controls what each user can see.

### 8.1 Admin

Admin should have local access to:

- All active and soft-deleted CRM records needed for admin views.
- All lookup/settings tables.
- Audit log.
- Automation tables.
- User/profile/role data.

### 8.2 Manager

Manager should have local access to:

- All records visible under the current manager/team RLS policy.
- Shared lookup tables.
- Profiles needed for assignment/display.
- Notifications for themselves.
- Limited audit/automation data if current UI exposes it.

### 8.3 Rep

Rep should have local access to:

- Records assigned to the rep or owned by the rep.
- Lookup tables needed for forms.
- Profiles needed for display/assignment if allowed.
- Their own notifications.
- Their own tasks/activities.

Rep should not sync:

- Admin settings that are not needed.
- All users' audit logs.
- Other reps' private records.

---

## 9. Feature Behavior Matrix

| Feature | Offline Behavior | Online Sync Behavior | Notes |
| --- | --- | --- | --- |
| Sign in | Cached session only | Supabase Auth | First sign-in online-only |
| MFA | Last verified state only | Supabase MFA | Enrollment/reset online-only |
| Leads CRUD | Full offline | Upload queued changes | Needs local reads/writes |
| Lead assignment | Offline for permitted users | Upload and trigger cloud notifications | Conflict-prone; log conflicts |
| Lead capture public form | Local only if same app/device | Normal server route online | Public internet capture needs internet |
| Contacts CRUD | Full offline | Upload queued changes | Good fit |
| Companies CRUD | Full offline except logo upload | Upload queued changes | Logo upload phase 2 |
| Deals/pipeline | Full offline | Upload queued changes | Stage triggers run after upload |
| Activities | Full offline | Upload queued changes | Good fit |
| Tasks | Full offline | Upload queued changes | Good fit |
| Dashboard | Offline from local data | Refresh after sync | Some numbers may be partial |
| Analytics | Offline from synced data | Refresh after sync | Role-based sync affects totals |
| Notifications | Local list works | Realtime resumes online | Push/realtime online-only |
| Email | Queue/skip offline | Send from cloud when synced | Must prevent duplicate sends |
| Invites | Online-only | Supabase admin APIs | Do not support offline v1 |
| Password reset | Online-only | Supabase Auth | Cannot work offline |
| User deletion/status | Online-only v1 | Supabase admin APIs | Avoid local-only security changes |
| Settings | Read offline; limited write offline | Upload settings updates | Admin only |
| Audit log | Append locally for offline actions | Upload append-only rows | Prefer append-only |
| Automations | Limited local behavior | Full DB triggers after upload | Decide per automation |

---

## 10. Automation Strategy

The current app uses Postgres triggers and functions for important automation:

- Lead stage change tasks.
- Deal stage change tasks.
- Deal value history.
- Notifications.
- Audit logging.
- Email queueing.
- Scheduled cron jobs.

With local Supabase, the default strategy is much stronger because Postgres triggers/RPCs run locally.

### 10.1 Phase 1 Strategy: Local Automations First, Cloud Reconciliation Later

In Phase 1, keep automations in Supabase/Postgres and run them locally on the branch server.

When the user changes a lead/deal/task offline:

1. Local Supabase commits the write.
2. Local Postgres triggers/RPCs run immediately.
3. Local tasks, notifications, histories, and audit rows are created immediately.
4. Sync pushes both the original row changes and related side-effect rows to cloud later.
5. Cloud sync must avoid creating duplicate side effects.

Pros:

- Minimal backend rewrite.
- Existing trigger logic remains authoritative and works offline.
- Lower risk.

Cons:

- Sync must be idempotent so cloud does not duplicate local automation side effects.
- Some cloud-only scheduled jobs/email dispatch still wait for internet.

### 10.2 Phase 2 Strategy: Cloud-Only Jobs And Queued Effects

Some effects should still remain cloud-only or queued:

- Outbound email via Resend.
- Cross-branch notification fanout.
- Cloud reporting rollups.
- Scheduled jobs that depend on global/cloud data.

Important rule:

All automation side effects that sync to cloud must be idempotent.

Possible mitigation:

- Use deterministic IDs for automation-created rows.
- Include `origin_event_id`.
- Add unique constraints in Supabase.

Recommendation:

Start with local Postgres automations for CRM data integrity. Keep email dispatch cloud-side until a local SMTP/email strategy is deliberately added.

---

## 11. Conflict Handling

### 11.1 Conflict Types

Likely CRM conflicts:

- Same lead edited by two users offline.
- Lead assigned to different reps by different managers.
- Deal moved to different stages offline by different users.
- Task completed offline while another user edits due date.
- Company/contact dedupe conflicts.
- Settings changed by two admins.

### 11.2 Phase 1 Conflict Policy

Use simple, explicit rules:

- Append-only tables: never overwrite.
- Lookup/settings tables: cloud latest wins; log conflict.
- CRM mutable rows: last-write-wins by `updated_at`, but log conflict.
- Ownership/assignment fields: cloud latest wins; show conflict notification if local assignment is overwritten.
- Closed-won/closed-lost deal transitions: cloud validation wins.

### 11.3 Conflict Logging

Add a table:

```sql
create table if not exists public.sync_conflicts (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  row_id uuid not null,
  local_node_id text,
  conflict_type text not null,
  local_payload jsonb,
  remote_payload jsonb,
  resolution text not null,
  created_at timestamptz not null default now()
);
```

This table should be admin/manager visible.

### 11.4 Future Conflict UI

Phase 1 can log conflicts only. Later, add a Settings/Admin view:

- Sync status.
- Failed uploads.
- Conflict log.
- Retry action.
- Manual resolution for selected records.

---

## 12. Local Branch Server Sync Plan

This is the primary implementation path for the clarified LAN/offline requirement.

### 12.1 Deployment Shape

Each offline-capable branch gets one local server:

```text
branch-server
  - reverse proxy / LAN hostname
  - CRM app server
  - self-hosted Supabase stack
  - local Postgres volume
  - local storage volume
  - sync worker
  - backup job
```

Users access:

```text
http://crm.local
```

or:

```text
http://192.168.x.x
```

The app talks to local Supabase, not cloud Supabase, while deployed in the branch.

### 12.2 Why This Fits The Requirement

This model preserves the current stack:

- Current React app can keep using `supabase.from(...)`.
- Local Auth can work without internet.
- Local RLS can work without internet.
- Local Postgres triggers/RPCs can work without internet.
- Multiple users can collaborate on the same local database while offline.
- Email and external integrations can queue until internet returns.

This is better than PowerSync for an office LAN because we do not need to refactor the frontend into a local SQLite-first architecture.

### 12.3 Local Supabase Runtime

For development, Supabase CLI/local dev is acceptable.

For an actual branch deployment, prefer self-hosted Supabase via Docker Compose rather than treating `supabase start` as production infrastructure. Supabase's self-hosting docs explicitly position Docker as the recommended self-hosting path and note that CLI local development is intended for development/testing.

Local services needed:

- Postgres.
- Auth.
- REST/PostgREST.
- Realtime if notifications need realtime updates.
- Storage if company logos/files are used locally.
- Edge Functions if local function behavior is needed.
- Studio only for admin/debug access, not required for normal users.

### 12.4 Local App Configuration

Add a LAN deployment env profile:

```text
SUPABASE_URL=http://localhost:8000
SUPABASE_PUBLISHABLE_KEY=<local-publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<local-service-role-key>
VITE_SUPABASE_URL=http://crm.local:8000
VITE_SUPABASE_PUBLISHABLE_KEY=<local-publishable-key>
EMAIL_ENABLED=false
APP_URL=http://crm.local
```

The exact URL/port depends on the local reverse proxy setup.

### 12.5 Local Database Setup

The local branch database should be created from the same repo migrations:

```text
supabase/migrations/*
```

Initial setup should:

1. Start self-hosted Supabase.
2. Apply migrations.
3. Seed required lookup data.
4. Create/mirror users.
5. Assign roles.
6. Configure app settings.
7. Start the CRM app server.
8. Start the sync worker.

### 12.6 Sync Service

The sync service is a custom Node process, cron job, or background worker running on the branch server.

Responsibilities:

- Detect internet/cloud availability.
- Push local changes to cloud Supabase.
- Pull cloud changes to local Supabase.
- Maintain sync checkpoints.
- Retry safely.
- Log conflicts and failures.
- Avoid duplicate emails, tasks, audit rows, and automation side effects.

Suggested command shape:

```bash
npm run sync:once
npm run sync:watch
```

Suggested files:

```text
scripts/sync-once.mjs
scripts/sync-watch.mjs
src/lib/sync/tables.ts
src/lib/sync/push.ts
src/lib/sync/pull.ts
src/lib/sync/conflicts.ts
src/lib/sync/checkpoints.ts
```

### 12.7 Sync Metadata

Add metadata tables to both local and cloud databases:

```sql
create table if not exists public.sync_nodes (
  id uuid primary key,
  name text not null,
  kind text not null check (kind in ('cloud', 'branch')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create table if not exists public.sync_checkpoints (
  id uuid primary key default gen_random_uuid(),
  local_node_id uuid not null,
  remote_node_id uuid not null,
  table_name text not null,
  last_pushed_at timestamptz,
  last_pulled_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (local_node_id, remote_node_id, table_name)
);

create table if not exists public.sync_conflicts (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  row_id uuid not null,
  local_node_id uuid,
  remote_node_id uuid,
  conflict_type text not null,
  local_payload jsonb,
  remote_payload jsonb,
  resolution text not null,
  created_at timestamptz not null default now()
);
```

### 12.8 Sync Strategy

For Phase 1, use table-level incremental sync based on:

- `id`
- `updated_at`
- `deleted_at`
- `origin_node_id`
- `last_modified_by`

Recommended extra columns on mutable synced tables:

```sql
alter table public.leads
  add column if not exists origin_node_id uuid,
  add column if not exists last_modified_by uuid;
```

Repeat for:

- `companies`
- `contacts`
- `leads`
- `deals`
- `activities`
- `tasks`
- settings tables that can be edited locally

### 12.9 Push Flow

Local to cloud:

1. Read local rows changed since the last push checkpoint.
2. Exclude rows whose latest origin is already cloud if unchanged locally.
3. For each row, compare cloud row by `id`.
4. If cloud row is missing, insert.
5. If cloud row exists and local `updated_at` is newer, update.
6. If both changed since last sync, apply conflict policy.
7. Save checkpoint.
8. Log result.

### 12.10 Pull Flow

Cloud to local:

1. Read cloud rows changed since the last pull checkpoint.
2. Compare local row by `id`.
3. If local row is missing, insert.
4. If cloud row is newer, update local.
5. If both changed since last sync, apply conflict policy.
6. Save checkpoint.
7. Log result.

### 12.11 First Version Conflict Policy

Recommended v1:

- Branch-created CRM records sync to cloud.
- Cloud-created CRM records sync to branch.
- For normal mutable CRM fields, latest `updated_at` wins.
- For security fields, cloud wins.
- For user roles/status, cloud wins by default.
- For audit/history/automation rows, append only.
- For email queue, cloud sends and local does not send.
- Conflicts are logged in `sync_conflicts`.

### 12.12 Email And External Services

Email should not send locally while offline.

Recommended behavior:

- Local app writes email queue rows.
- Local dispatcher is disabled by default.
- Sync pushes pending queue rows to cloud.
- Cloud Edge Function/Resend sends them.
- Queue rows need stable IDs/idempotency to prevent duplicate sends.

### 12.13 Backups

Branch server must have local backups because it becomes operationally important.

Minimum:

- Nightly Postgres dump to external drive or NAS.
- Retain at least 7-30 days.
- Document restore procedure.
- Test restore before rollout.

---

## 13. Optional PowerSync Per-Device Plan

This section is optional for a future mode where each device must work even when it cannot reach the branch LAN server.

### 13.1 New Modules

Add a PowerSync integration folder:

```text
src/integrations/powersync/
  client.ts
  schema.ts
  connector.ts
  auth.ts
  queries.ts
  mutations.ts
  status.ts
```

Suggested responsibilities:

- `client.ts`
  - Initialize PowerSync database.
  - Export singleton client.
- `schema.ts`
  - Define local SQLite schema expected by PowerSync.
- `connector.ts`
  - Connect PowerSync uploads to Supabase.
  - Translate queued writes into Supabase operations/RPCs.
- `auth.ts`
  - Provide current Supabase token/user details to PowerSync.
  - Handle offline cached session behavior.
- `queries.ts`
  - Shared query helpers for local reads.
- `mutations.ts`
  - Shared mutation helpers for local writes.
- `status.ts`
  - Sync status, last synced time, pending upload count.

### 13.2 Keep Supabase Client

Do not remove `src/integrations/supabase/client.ts`.

Supabase is still needed for:

- Auth.
- Online-only admin operations.
- Upload connector.
- Edge/server routes.
- Storage.
- RPCs where needed.

### 13.3 Data Access Boundary

Introduce a data access boundary so components/hooks do not know whether data comes from Supabase or PowerSync.

Suggested folder:

```text
src/lib/data/
  leads.repository.ts
  contacts.repository.ts
  companies.repository.ts
  deals.repository.ts
  tasks.repository.ts
  activities.repository.ts
  settings.repository.ts
  analytics.repository.ts
```

Then refactor existing hooks in `src/lib/*-data.ts` gradually.

Example direction:

Current:

```ts
const { data, error } = await supabase
  .from("leads")
  .select("*")
  .is("deleted_at", null)
  .order("created_at", { ascending: false });
```

Target:

```ts
return leadsRepository.listLeads();
```

PowerSync implementation:

```ts
return powerSyncDb.getAll<LeadRow>(
  "select * from leads where deleted_at is null order by created_at desc",
);
```

### 13.4 Upload Connector

Writes should be captured by PowerSync and uploaded to Supabase when online.

The upload connector must:

- Read pending local changes.
- Call Supabase insert/update/upsert/delete or RPCs.
- Use the current Supabase session token.
- Respect RLS.
- Report upload errors.
- Avoid duplicate operations.

Some writes may need to call RPCs instead of plain table updates.

Examples:

- `set_user_role` should stay online-only.
- `capture_landing_lead` server route stays online-only for public internet lead capture.
- Deal value update may need `update_deal_value` if reason is required.

---

## 14. Supabase Configuration For PowerSync

PowerSync with Supabase requires changes on the Supabase side.

Expected setup items:

1. Create a PowerSync database user/role with replication permissions.
2. Grant required `SELECT` privileges to the PowerSync role.
3. Create a Postgres publication for the synced tables.
4. Configure PowerSync service with Supabase connection details.
5. Configure PowerSync Auth to use Supabase Auth/JWTs.
6. Define sync streams for admin, manager, and rep scopes.

The PowerSync guide shows a simple publication:

```sql
create publication powersync for all tables;
```

For this CRM, avoid `for all tables` in production. Use an explicit table list to reduce replication load and prevent syncing sensitive/irrelevant data.

Example direction:

```sql
create publication powersync for table
  public.profiles,
  public.user_roles,
  public.pipeline_stages,
  public.loss_reasons,
  public.app_settings,
  public.companies,
  public.contacts,
  public.leads,
  public.deals,
  public.activities,
  public.tasks,
  public.deal_stage_history,
  public.deal_value_history,
  public.lead_status_history,
  public.notifications,
  public.automation_rules,
  public.automation_runs,
  public.audit_log;
```

Final table list must be confirmed after schema audit.

---

## 15. Sync Stream Design

PowerSync sync streams define what data each client receives.

This is security-critical because local SQLite does not run Supabase RLS.

### 15.1 Shared Lookup Stream

All authenticated users likely need:

```sql
select * from pipeline_stages;
select * from loss_reasons;
select * from automation_rules where enabled = true;
```

### 15.2 Current User Stream

```sql
select * from profiles where id = auth.user_id();
select * from user_roles where user_id = auth.user_id();
select * from notifications where user_id = auth.user_id();
```

### 15.3 Admin Stream

Admins need broad visibility:

```sql
select * from profiles;
select * from user_roles;
select * from companies;
select * from contacts;
select * from leads;
select * from deals;
select * from activities;
select * from tasks;
select * from audit_log;
select * from automation_runs;
```

The actual PowerSync syntax should be validated against the current PowerSync sync streams format.

### 15.4 Manager Stream

Managers currently have team-wide/global visibility according to existing RLS. We need to mirror that.

Possible direction:

```sql
select * from companies;
select * from contacts;
select * from leads;
select * from deals;
select * from activities;
select * from tasks;
```

If manager visibility is narrowed to specific teams later, sync streams must be narrowed too.

### 15.5 Rep Stream

Reps should receive rows where they are assigned/owner or rows required for relationships.

Possible direction:

```sql
select * from leads where assigned_to = auth.user_id();
select * from deals where assigned_to = auth.user_id();
select * from tasks where assigned_to = auth.user_id();
select * from activities where assigned_to = auth.user_id();
select * from contacts
where assigned_to = auth.user_id()
   or id in (select primary_contact_id from deals where assigned_to = auth.user_id());
select * from companies
where account_manager_id = auth.user_id()
   or id in (select company_id from contacts where assigned_to = auth.user_id())
   or id in (select company_id from deals where assigned_to = auth.user_id());
```

This needs to be aligned with the actual schema columns and current RLS policies.

---

## 16. UI/UX Requirements

### 16.1 Global Sync Indicator

Add a small sync status indicator to the app shell/topbar.

States:

- Online, synced.
- Online, syncing.
- Offline, local mode.
- Pending changes.
- Sync error.

Suggested display:

```text
Offline - 4 pending changes
Syncing...
Synced 2m ago
Sync error - Review
```

### 16.2 Pending State On Mutated Records

Records modified offline should show a subtle pending state.

Examples:

- Lead row badge: `Pending sync`.
- Task completed offline: show completed state plus sync indicator.
- Deal moved offline: show new stage immediately plus pending marker.

### 16.3 Sync Error Surface

Add a sync health panel eventually:

- Pending uploads.
- Failed uploads.
- Last sync time.
- Conflict log.
- Retry button.
- Clear local data/sign out.

Phase 1 can start with toast + topbar status.

### 16.4 Online-Only Disabled States

When offline, disable or explain:

- Invite user.
- Password reset.
- MFA reset.
- Company logo upload.
- Email test.
- Send test lead to public endpoint.
- OAuth-related flows.

---

## 17. Implementation Phases

### Phase 0: Deployment Decisions And Schema Audit

Goal: confirm the branch-server deployment shape and sync scope before writing sync code.

Tasks:

- Decide target local server OS and hardware profile.
- Decide LAN hostname/IP pattern, for example `crm.local`.
- Decide whether the branch server runs HTTP only on trusted LAN or HTTPS with a local certificate.
- Decide backup location and retention.
- Audit all tables used by `src/lib/*-data.ts`.
- Classify tables as:
  - branch-local read/write,
  - branch-local read-only,
  - cloud-authoritative,
  - online-only,
  - append-only,
  - excluded.
- Confirm which tables have `updated_at` and `deleted_at`.
- Identify hard deletes and convert to soft deletes where needed.
- Identify RPC-based writes.
- Identify trigger side effects that must sync without duplication.
- Define conflict rules per table.
- Decide whether branch-local role/user changes are allowed.

Deliverables:

- Table sync matrix.
- Required migration list.
- Branch deployment checklist.
- Final LAN/offline feature matrix.

### Phase 1: Local Self-Hosted Supabase Setup

Goal: run the current backend stack on a local server.

Tasks:

- Create Docker Compose/self-hosted Supabase deployment files.
- Configure local Auth, REST, Storage, Realtime, and Functions as needed.
- Apply existing `supabase/migrations`.
- Add local seed/provisioning scripts.
- Create local app settings and pipeline lookup data.
- Create local test users and roles.
- Verify RLS locally for admin, manager, and rep.
- Verify triggers/RPCs locally.
- Verify the app can use local Supabase with LAN env vars.

Deliverables:

- Local Supabase running on branch server.
- Local database initialized from repo migrations.
- Local users can sign in and access CRM over LAN.
- Local app can run without internet.

### Phase 2: Local App Deployment Profile

Goal: make the TanStack app deploy cleanly against local Supabase.

Tasks:

- Add `.env.branch.example`.
- Add scripts for branch build/start.
- Configure app URL and public Supabase URL for LAN clients.
- Confirm service-role env vars stay server-only.
- Add deployment docs for branch server.
- Add sync status hook.
- Add topbar sync indicator.
- Add offline detection hook.

Deliverables:

- Branch app starts on LAN.
- App points to local Supabase.
- UI shows internet/cloud sync status.

### Phase 3: Sync Metadata And Migrations

Goal: make both local and cloud databases track sync state safely.

Tasks:

- Add `sync_nodes`.
- Add `sync_checkpoints`.
- Add `sync_conflicts`.
- Add `origin_node_id` and `last_modified_by` where needed.
- Add missing `updated_at`/`deleted_at` columns.
- Add idempotency fields for email/automation queue if needed.
- Add unique constraints to prevent duplicate synced side effects.

Deliverables:

- Sync-ready schema.
- Migration applies cleanly to local and cloud.

### Phase 4: One-Way Local-To-Cloud Sync

Goal: prove branch-created data reaches cloud.

Recommended order:

1. Leads.
2. Contacts.
3. Companies.
4. Deals.
5. Tasks.
6. Activities.
7. History/audit tables.
8. Notifications.
9. Email queue.

Tasks:

- Add `scripts/sync-once.mjs`.
- Connect to local Supabase/Postgres and cloud Supabase/Postgres.
- Push local changed rows by table.
- Upsert rows by stable UUID.
- Save push checkpoints.
- Log failures.
- Add dry-run mode.

Deliverables:

- Local lead created offline syncs to cloud.
- Local CRM changes sync to cloud without duplicates.
- Failed sync attempts are visible.

### Phase 5: Cloud-To-Local Pull Sync

Goal: keep branch data updated with cloud changes when internet returns.

Tasks:

- Pull cloud changes by table.
- Apply cloud-created rows locally.
- Apply security-sensitive changes such as user status and roles.
- Apply conflict policy.
- Save pull checkpoints.
- Log conflicts to `sync_conflicts`.

Deliverables:

- Cloud-created CRM rows can appear locally.
- Cloud user/role changes reach branch.
- Conflicts are logged.

### Phase 6: Auth, Email, Storage, And Edge Cases

Goal: make non-CRUD behavior predictable in LAN mode.

Tasks:

- Confirm local Auth sign-in without internet.
- Define user provisioning process.
- Disable or adapt email invite/password reset flows offline.
- Keep email dispatch cloud-side by default.
- Sync email queue safely.
- Queue or disable file uploads.
- Decide whether local Storage objects sync to cloud in v1.
- Prevent duplicate automation-created rows.
- Add conflict logging UI for admins/managers.

Deliverables:

- Auth behavior is documented and tested.
- Email behavior is predictable.
- Emails do not duplicate.
- File/storage limitations are clear.

### Phase 7: Testing And Rollout

Goal: prove branch-server behavior under real scenarios.

Test scenarios:

- Start local branch server.
- Connect multiple devices over LAN.
- Disconnect internet but keep LAN running.
- Sign in against local Supabase.
- Create lead offline and verify local visibility.
- Move deal stage offline and verify local trigger side effects.
- Complete task offline.
- Restore internet.
- Run sync and verify cloud state.
- Change a user role/status in cloud and verify branch receives it.
- Create conflicting edits and verify conflict log.
- Email queue does not duplicate.
- Branch backup and restore works.

Deliverables:

- Manual QA checklist.
- Automated tests where feasible.
- Pilot release for one branch server with one admin + one manager + one rep.

---

## 18. Repository Work Breakdown

### 18.1 New Files

Expected new files:

```text
deploy/branch/docker-compose.yml
deploy/branch/.env.example
deploy/branch/README.md

scripts/branch-setup.mjs
scripts/sync-once.mjs
scripts/sync-watch.mjs
scripts/backup-branch-db.mjs

src/lib/sync/tables.ts
src/lib/sync/push.ts
src/lib/sync/pull.ts
src/lib/sync/conflicts.ts
src/lib/sync/checkpoints.ts
src/lib/sync/db.ts

src/hooks/use-sync-status.ts
src/components/layout/SyncStatusIndicator.tsx

supabase/migrations/YYYYMMDDHHMMSS_branch_sync_metadata.sql
supabase/migrations/YYYYMMDDHHMMSS_sync_conflicts.sql
```

### 18.2 Files To Refactor

Likely high-touch files:

```text
src/lib/notifications-data.ts
src/lib/settings-data.ts
src/lib/auth-context.tsx
src/routes/_authenticated/route.tsx
src/components/layout/Topbar.tsx
.env.example
package.json
supabase/config.toml
```

### 18.3 Files That Should Mostly Stay Supabase-Backed

These should remain online/server/Supabase oriented:

```text
src/integrations/supabase/client.ts
src/integrations/supabase/client.server.ts
src/integrations/supabase/auth-middleware.ts
src/lib/lead-capture.server.ts
src/lib/mfa-admin.functions.ts
supabase/functions/send-automation-email/index.ts
```

Most CRUD files can stay close to their current shape because they already talk to Supabase. In branch mode, the Supabase URL points to the local branch server.

---

## 19. App Refactor Strategy

In branch-server mode, avoid a large data-layer rewrite. The existing hooks already use Supabase, and that is exactly what the local branch server provides.

### 19.1 Step 1: Keep Supabase Data Hooks

Most files like `src/lib/leads-data.ts`, `src/lib/deals-data.ts`, and `src/lib/tasks-data.ts` should keep using:

```ts
supabase.from("leads").select("*")
```

The difference is environment configuration:

```text
cloud mode  -> VITE_SUPABASE_URL=https://project.supabase.co
branch mode -> VITE_SUPABASE_URL=http://crm.local:8000
```

### 19.2 Step 2: Add Deployment-Aware Config

Add clear env profiles:

- `.env.cloud.example`
- `.env.branch.example`
- branch deployment docs

The app should be able to build/start against either cloud Supabase or local Supabase.

### 19.3 Step 3: Add Sync Status UI

Add UI for:

- Local server online.
- Internet unavailable.
- Cloud sync pending.
- Cloud sync successful.
- Cloud sync failed.

### 19.4 Step 4: Optional Repository Boundary Later

A repository boundary can still be useful later, especially if we add PowerSync per-device mode. It is not required for the first LAN deployment milestone.

---

## 20. Backend Migration Expectations

This is not a new backend, but it does require backend migrations.

Expected Supabase migrations:

- Branch sync metadata tables.
- Optional publication setup if we later use logical replication.
- Missing soft-delete columns.
- Missing timestamp columns.
- Conflict log table.
- Possible unique/idempotency constraints for automation/email queue.
- Possible helper functions for branch sync.

Do not remove existing RLS. Do not weaken RLS to make sync easier.

---

## 21. Security Considerations

### 21.1 Branch Server Data Risk

Offline-first LAN deployment means CRM data exists on the branch server. That is an intentional tradeoff.

Mitigations:

- Physically secure the branch server.
- Use disk encryption where feasible.
- Restrict LAN firewall access.
- Run behind a local reverse proxy.
- Back up Postgres regularly.
- Keep service role keys server-side only.
- Do not expose Supabase Studio publicly.

### 21.2 RLS Drift

Local and cloud schemas/RLS policies must stay aligned. If cloud RLS changes but branch migrations are not applied, branch behavior can drift from cloud behavior.

Mitigation:

- Treat RLS changes as security-sensitive.
- Add review checklist for local/cloud migration rollout.
- Prefer shared SQL helper functions/views where possible.

### 21.3 Service Role Keys

Never expose `SUPABASE_SERVICE_ROLE_KEY` in the client. In branch mode there may be both local and cloud service keys; both must remain server-only.

Server-only code remains the only place for service role operations.

---

## 22. Testing Strategy

### 22.1 Unit/Integration Tests

Add tests for:

- Repository query behavior.
- Mutation payload shape.
- Conflict resolution helpers.
- Offline session snapshot validation.
- Sync status helpers.

### 22.2 Manual Offline QA

Manual test checklist:

- Load app online as admin; wait for sync.
- Disable network.
- Reload browser.
- Confirm `/app` still loads.
- Create lead offline.
- Edit lead offline.
- Move deal stage offline.
- Complete task offline.
- Re-enable network.
- Confirm pending changes sync.
- Confirm cloud Supabase has updates.
- Confirm no duplicate emails/tasks.

### 22.3 Role-Based QA

Test each role:

- Admin sees all expected data offline.
- Manager sees manager-scoped data offline.
- Rep only sees assigned/owned data offline.

### 22.4 Failure QA

Test:

- RLS-rejected upload.
- Conflict with another user edit.
- Network drops mid-sync.
- Expired session.
- Revoked user.
- Corrupt local cache.

---

## 23. Acceptance Criteria

Phase 1 offline-first acceptance:

- A local branch server can run without internet.
- Multiple LAN users can open the CRM through the local server.
- Users can sign in against local Supabase Auth.
- Leads, contacts, companies, deals, tasks, and activities can be created/updated while internet is unavailable.
- Local RLS protects local reads/writes.
- Local triggers/RPCs work while offline.
- Local changes sync to cloud Supabase when internet returns.
- Cloud changes can sync back to the branch.
- Rep local access is limited by local RLS to rep-allowed records.
- Email/admin/auth-only features do not break offline; they are disabled or queued.
- Sync errors are visible to the user.

---

## 24. Risks And Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Local/cloud RLS drift | Data exposure | Apply same migrations to branch and cloud |
| Branch server failure | Office outage | Backups, UPS, restore procedure |
| Duplicate automation/email rows | User confusion/email spam | Idempotency keys and unique constraints |
| Local trigger side effects duplicate in cloud | Data duplication | Deterministic IDs/origin event IDs |
| Conflicting edits overwrite data | Data loss | Conflict logging; table-specific policies |
| Local user remains active after cloud revocation | Security risk | Pull cloud user status on reconnect; local admin controls |
| Large datasets sync slowly | Performance | Table checkpoints, batching, branch scoping |
| Self-hosting operations burden | Maintenance risk | Docker deployment docs, monitoring, backups |

---

## 25. Recommended First Milestone

The first practical milestone should be a narrow proof of concept:

**Goal:** One local branch server can run the CRM over LAN and sync leads to cloud.

Scope:

- Run self-hosted Supabase locally.
- Apply current migrations locally.
- Seed one admin, one manager, and one rep.
- Run the CRM app against local Supabase.
- Access the CRM from another device on the LAN.
- Disconnect internet while keeping LAN active.
- Create/update leads offline.
- Restore internet.
- Run `npm run sync:once`.
- Verify leads exist in cloud Supabase.
- Add sync status indicator.

This proves the branch-server architecture before expanding sync to deals, contacts, tasks, activities, analytics, storage, and email.

After the leads proof of concept works, expand table by table.

---

## 26. Open Questions

These need product/engineering decisions before full implementation:

1. What hardware/OS will the branch server use?
2. Should the LAN deployment use HTTP only, local HTTPS, or a VPN-only hostname?
3. Who is allowed to administer local users if the internet is down?
4. Should branch-local role changes sync to cloud, or should cloud always win?
5. Should admins/managers be able to change settings offline?
6. Should file uploads be queued/synced or online-only in v1?
7. Should email be cloud-only or should branch deployments support local SMTP?
8. How should conflicts be surfaced to non-admin users?
9. What is the maximum expected branch dataset size?
10. Is one branch server enough, or will multiple branches need cloud-to-branch data partitioning?

---

## 27. Final Recommendation

Proceed with a **local branch-server architecture**:

```text
LAN users -> local CRM app -> local self-hosted Supabase -> sync worker -> cloud Supabase
```

This is the best fit for the clarified requirement: users on the same local network must keep working when the internet is unavailable.

Do not make PowerSync the default for this requirement. PowerSync is better for per-device offline use when each laptop/mobile device must keep working away from the branch server. It can remain a future optional layer.

Do not migrate to Nhost for offline-first. Nhost is a capable Postgres/Auth/Hasura backend, but it does not remove the need for local deployment and sync.

Implementation should be incremental:

1. Run local self-hosted Supabase.
2. Run the CRM app against local Supabase over LAN.
3. Prove local offline CRM use with leads.
4. Build one-way local-to-cloud sync for leads.
5. Add cloud-to-local pull.
6. Expand sync to the rest of CRM CRUD.
7. Harden auth, email, storage, backups, monitoring, and conflict handling.

This path satisfies the requirement: keep the current backend stack, avoid a full backend rewrite, make the CRM usable by LAN users without internet, and sync with cloud Supabase when internet is available.
