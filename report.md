# Offline/Online CRM Sync Final Report

## Executive Summary

The CRM now supports a practical offline/online operating model for branch offices. The selected approach is a **branch-local Supabase server** running on the local network, with a sync worker that exchanges data with the online Supabase project whenever internet access is available.

This is the best fit for the business because it preserves the existing CRM architecture while adding offline resilience. The application already depends on Supabase Auth, Postgres, Row Level Security, RPCs, triggers, and the Supabase JavaScript client. Rather than rewriting the CRM around a new local database layer, the branch deployment runs the same Supabase shape locally. Users continue using the same CRM experience, but during an outage the browser talks to the local branch server instead of the cloud.

The result is a lower-risk implementation that keeps the team productive during internet downtime and keeps the online platform as the central source of truth once connectivity returns.

## Business Problem

The branch office needs to keep working even when internet access is unreliable. Sales users still need to log in, view customers, manage leads, update deals, and complete tasks on the local network. At the same time, the business still needs online visibility when the connection comes back.

The core challenge is therefore not just "offline storage." The real requirement is:

- multiple users working together in the same office,
- shared data consistency on the LAN,
- familiar CRM login and permissions,
- safe reconnection to the online database,
- minimal disruption to the existing production application.

## Recommended Architecture

```text
LAN users
  -> local CRM app server
  -> local Supabase Auth/Postgres/RLS
  -> sync worker
  -> online Supabase
```

In this model, the branch server becomes the local operational system. All users in the office connect to the same branch server over the LAN. The cloud system remains the online source of truth and receives branch changes when internet access is available.

## Why This Is The Best Approach

### 1. It preserves the existing technology investment

The CRM already uses Supabase deeply. Auth, profiles, roles, row-level security, lead capture, automations, triggers, and many data hooks are built around Supabase. Running Supabase locally lets the application keep the same API and database behavior in offline mode.

This avoids a costly rewrite and reduces the chance of breaking existing CRM features.

### 2. It supports real multi-user branch work

A browser-only offline database would isolate each user's data on their own device. That is not ideal for a sales office where managers, admins, and reps need to see shared updates.

The branch-local server gives the office one shared database while offline. Everyone on the LAN works from the same local source, so the branch remains coordinated even without internet.

### 3. It keeps security rules consistent

Supabase Row Level Security and role rules still apply locally. Admin, manager, and rep permissions remain enforced by the database, not only by the UI.

This is important because offline mode should not become a weaker security mode. The same access-control model applies in both environments.

### 4. It removes the double-user-creation bottleneck

Users are created online once. The branch watcher automatically provisions matching local Auth users before each sync, then mirrors profile and role data locally.

That means administrators do not need to manually create the same person online and offline. The branch server prepares local login accounts from the online user list.

### 5. It handles connectivity realistically

The sync worker runs continuously on an interval. The current interval is 30 seconds, which keeps the branch sync under one minute. When the internet is available, it synchronizes branch and cloud data. When the internet is unavailable, branch users continue working locally, and the worker retries on the next interval.

This is simple to operate and easy to reason about.

## Implemented Capabilities

- LAN access from another PC using the branch server IP.
- Stable branch access through `http://crm.local:3000` so users do not depend on a changing LAN IP.
- Browser-safe Supabase URL handling so remote PCs do not call their own `127.0.0.1`.
- Runtime rewrite of loopback/private LAN Supabase hosts to the current app hostname for branch browsers.
- Local Supabase Auth redirect allowlist for `crm.local`, localhost, and common private LAN origins.
- Docker branch app and sync worker access to host-run Supabase through `host.docker.internal`.
- React Query configured to keep running queries and mutations against branch-local Supabase while the internet is offline.
- Local Supabase Auth with MFA/TOTP enabled.
- Local Auth provisioning from online users.
- Cloud-to-local role mirroring so an admin remains an admin locally.
- Core CRM bidirectional sync for operational tables.
- Pull-only sync for identity/configuration tables where the cloud should remain authoritative.
- Natural-key handling for lookup tables such as pipeline stages and loss reasons.
- Stage ID mapping for deals when local and cloud lookup UUIDs differ.
- Sync watcher with interval-based automatic retry.
- Full-scan sync mode for migration repair or checkpoint reset.
- Branch diagnostics, smoke checks, backup commands, and deployment docs.

## Sync Scope

The following operational CRM tables are synchronized bidirectionally:

- companies
- contacts
- deals
- leads
- tasks
- activities

The following cloud-controlled tables are pulled into the branch:

- profiles
- user_roles
- pipeline_stages
- loss_reasons
- app_settings
- automation_rules

This split is intentional. Operational CRM activity can originate in either environment, but identity, roles, and configuration should be governed centrally to avoid branch servers overwriting cloud policy.

## Auth And User Management

Supabase Auth users are not ordinary public CRM rows. They live in Supabase's internal Auth schema. Because of that, the CRM sync cannot simply treat them like leads or contacts.

The implemented solution is:

1. Create the user online.
2. The branch watcher provisions the matching local Auth user before sync.
3. The branch sync pulls the profile and role.
4. The user can log in both online and locally.

Passwords cannot be copied from cloud Supabase because Supabase does not expose password hashes through the Auth API. That is correct security behavior. For branch access, newly provisioned local users receive a temporary branch password and can change it after first login.

The current verified admin account works both online and locally:

```text
Email: adjeteyjuliussowah@gmail.com
Role: admin
Cloud login: verified
Local login: verified
```

## Operational Commands

Start the continuous sync worker:

```bash
npm run sync:watch
```

Run a one-time sync:

```bash
npm run sync:once
```

Force a cloud-to-branch full scan:

```bash
npm run sync:once -- --direction=pull --tables=core --full
```

Provision branch Auth users manually:

```bash
npm run branch:provision-auth
```

Run diagnostics:

```bash
npm run branch:doctor
npm run branch:smoke
```

Run a local branch backup:

```bash
npm run branch:backup
```

## Verification Summary

The implementation has been verified through:

- successful production build,
- lint and security checks,
- local-to-cloud sync checks,
- cloud-to-local sync checks,
- duplicate pipeline-stage collision fix,
- branch Auth provisioning before profile sync,
- online and local login verification for a new admin account,
- role mirroring validation so local roles match cloud roles.
- branch/LAN configuration stabilized for changing LAN IPs and Dockerized app/sync-worker access.

## Risk Controls

The design includes practical controls for the major risks:

- **Duplicate lookup data:** pipeline stages and loss reasons match by natural keys.
- **Broken deal stage references:** stage IDs are mapped between local and cloud.
- **Wrong local roles:** branch provisioning now mirrors cloud roles.
- **Changing LAN IPs:** users can open the app through `crm.local`, and browser Supabase URLs rewrite to the app hostname at runtime.
- **Container-to-host networking:** branch Docker services use `host.docker.internal` to reach the host Supabase stack.
- **Manual sync dependency:** `sync:watch` runs continuously on an interval.
- **Local database loss:** branch backup command is available for scheduled host backups.
- **Accidental local state commits:** local Supabase branch state and env files are ignored.

## Conclusion

This approach gives the business offline continuity without sacrificing the existing CRM architecture. It is reliable because the branch office has a real local database and Auth service. It is maintainable because the application still uses the same Supabase patterns. It is secure because RLS and roles remain active locally. It is operationally simple because users are created online once and the branch server prepares local access automatically.

The recommended deployment model is therefore:

```text
Online CRM remains the central system.
Branch CRM keeps the office productive during outages.
The sync worker reconciles both sides when internet is available.
```

This is the strongest option for the current requirement because it balances resilience, cost, delivery speed, and long-term maintainability.
