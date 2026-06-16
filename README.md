# Tally CRM + TallyPrime Landing Page

**Ref:** ASM-CRM-001 v2.0

A sales CRM for a TallyPrime authorized partner's sales team, paired with a public marketing
landing page that captures demo-request leads directly into the CRM. The CRM (leads, contacts,
companies, deals/pipeline, activities, tasks, analytics, automations) lives behind authenticated,
role-scoped routes; the landing page is public and talks to the CRM only through a single
write-only capture path. Full product/requirements specs are in [`docs/`](docs) (`PRD.md`,
`URD.md`, `design.md`, `plan.md`, `CHECKLIST.md`).

---

## Table of contents

1. [Key features](#key-features)
2. [Tech stack](#tech-stack)
3. [Architecture](#architecture)
4. [User roles & permissions](#user-roles--permissions)
5. [Prerequisites](#prerequisites)
6. [Getting started](#getting-started)
7. [Environment variables](#environment-variables)
8. [Database & Supabase setup](#database--supabase-setup)
9. [Available scripts](#available-scripts)
10. [Project structure](#project-structure)
11. [Lead-capture & email flow](#lead-capture--email-flow)
12. [Security notes](#security-notes)
13. [Deployment](#deployment)
14. [Acceptance criteria](#acceptance-criteria)
15. [Known limitations](#known-limitations)
16. [License & credits](#license--credits)

---

## Key features

**Landing page & lead capture**
- Public marketing page (hero, features, editions, industries, FAQ, testimonials) at `/`.
- Demo-request form with client-side validation and a honeypot field, posting to a server route
  that validates again and writes through a Postgres RPC (no direct table access from the public
  internet).
- Auto-assignment (round-robin among reps), a "Make first contact" task, an audit-log entry, and
  a queued confirmation email are created in the same transaction as the lead.

**Auth & 2FA**
- Supabase Auth (email/password) plus mandatory TOTP/email-OTP MFA. The `_authenticated` route
  guard checks the session's Authenticator Assurance Level (AAL) on every load and redirects to
  `/mfa` until AAL2 is satisfied — CRM data is not reachable on an AAL1-only session.
- *Planned* (tracked open in `docs/CHECKLIST.md` §1): forced enrollment on first login with no
  skip path, 8h inactivity session expiry, admin session revocation, and a first-login onboarding
  wizard.

**Contacts** — grid + table views, detail page with Overview/Deals/Activities/Notes/Lead-Origin
tabs, bulk action bar, soft delete (delete hidden for Sales Rep).

**Companies** — grid (with rating) + table views, detail page with linked contacts/deals, soft
delete.

**Leads** — Kanban (New Lead / Contacted / Qualified) with drag-to-change-status, Add Lead modal,
3-step Convert-to-Deal flow, Disqualify flow (reason + note), read-only lead-capture payload panel
(source, timestamp, IP country, email status).

**Deals & pipeline** — 7-stage Kanban, probability/priority badges, Add Deal modal, deal detail
with stage/value history, Close Won (with confetti) and Close Lost (reason required) flows.

**Activities** — table with type filters, slide-over detail panel, lifecycle states
(Pending → In Progress → Completed).

**Tasks** — grouped-by-date list, Add Task modal, quick-complete. *Planned*: reminder dispatch to
in-app/email (the cron job exists in the DB — see [Database & Supabase setup](#database--supabase-setup)
— but is not yet wired to a notification channel end-to-end).

**Dashboard** — pipeline funnel, lead-source donut, recent activity feed, my-tasks list.
*Planned*: the 4 headline KPI count-up cards and role-based dashboard scoping (§12).

**Analytics** (Admin/Manager) — period selector, pipeline-health KPIs, revenue chart, conversion
funnel, rep leaderboard, lead-source/win-loss breakdowns, per-rep report.

**Settings/Admin** — General, Pipeline config, Users & Roles, Lead assignment, Automations,
Email & notifications, Loss reasons, Audit log, Landing-page integration panel. Hidden from
Manager/Rep.

**Automation engine** — implemented as Postgres triggers + `pg_cron` jobs (not a separate worker
service): lead/deal stage-change tasks, SLA monitor, daily digest, re-engagement sweep, and an
Edge Function that drains a queue table and sends the actual emails via Resend. See
[Lead-capture & email flow](#lead-capture--email-flow).

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | [TanStack Start](https://tanstack.com/start) `^1.167` (file-based routing via `@tanstack/react-router`, SSR via Nitro) |
| UI | React `^19.2`, TypeScript `^5.8` |
| Build | Vite `^7.3` |
| Styling | Tailwind CSS `^4.2` + [shadcn/ui](https://ui.shadcn.com) (Radix UI primitives) |
| Data fetching | `@tanstack/react-query` `^5.83` |
| Forms/validation | `react-hook-form` + `zod` |
| Backend | [Supabase](https://supabase.com) — Postgres, Auth (incl. MFA), Row-Level Security, Edge Functions (Deno) |
| Outbound email | [Resend](https://resend.com) |
| CI | GitHub Actions (lint → security checks → build) |

Exact dependency versions are in [`package.json`](package.json).

---

## Architecture

The CRM app and the public landing page are **one deployed app** (same TanStack Start project,
same routes file tree), but they only share a single, narrow, write-only integration surface: the
lead-capture path. The landing page never reads CRM data, and the CRM's authenticated routes are
walled off by the `_authenticated` route guard + Postgres RLS — not by the landing page being a
separate deployment.

```
 Visitor                 TanStack Start server route        Postgres (Supabase)
 ┌────────┐  POST JSON   ┌───────────────────────────┐      ┌─────────────────────────┐
 │ Landing │ ───────────▶│ /api/public/leads-capture  │      │ RPC capture_landing_lead │
 │  page   │              │  (lead-capture.server.ts) │─────▶│  • dedupe by email       │
 │  form   │              │  • zod validation          │      │  • round-robin assign   │
 └────────┘              │  • origin/CSRF/size checks │      │  • insert lead           │
                          └─────────────┬───────────────┘     │  • insert task           │
                                        │ fire-and-forget      │  • queue confirmation    │
                                        ▼                      │    email (email_queue)   │
                          ┌───────────────────────────┐      │  • write audit_log       │
                          │ Edge Function:             │      └────────────┬────────────┘
                          │ send-automation-email      │                   │
                          │  • dispatch-secret auth     │◀──────────────────┘ trigger fires,
                          │  • pulls email_queue rows   │                     row appears on
                          │  • sends via Resend         │                     CRM dashboard
                          └───────────────────────────┘
```

Key points:
- **RLS is the authorization boundary for everything authenticated.** The React app does not
  itself decide what a Rep can see — every table has Row-Level Security policies that scope rows
  by `assigned_to`/ownership and role (see migration `20260616120000_feature_2_security_rls_hardening.sql`).
- **The public path is insert-only.** The `anon` role has all privileges revoked repo-wide and is
  granted back only `INSERT` on a specific column subset of `leads`, plus `EXECUTE` on the
  `capture_landing_lead` RPC. The landing page cannot read CRM data through any path.
- **Automations are database-native.** Stage-change side effects (auto-tasks, notifications,
  probability resets, audit logging) are Postgres trigger functions, not application code. SLA
  monitoring, reminder dispatch, the daily digest, and the re-engagement sweep are `pg_cron` jobs
  calling those same SQL functions on a schedule.
- **Only one piece runs outside Postgres/the app server:** `supabase/functions/send-automation-email`,
  a Deno Edge Function that reads the `email_queue` table and calls the Resend API — this is the
  only place `RESEND_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are used.
- **Deviation from `docs/design.md`:** the spec describes lead capture as
  `POST {SUPABASE_URL}/functions/v1/leads-capture` (a Supabase Edge Function). The shipped
  implementation instead uses a TanStack Start server route (`/api/public/leads-capture`) calling
  a Postgres RPC. Functionally equivalent (validated, public, write-only, same DB result), but if
  you're wiring an external form to this CRM, use the TanStack route, not a Supabase Functions URL.

---

## User roles & permissions

Three roles, defined in the `app_role` enum and assigned via `user_roles`:

| Capability | Sales Rep | Sales Manager | Admin |
|---|---|---|---|
| View own/assigned leads, contacts, companies, deals | ✅ | ✅ | ✅ |
| View **all** records (team-wide) | ❌ | ✅ | ✅ |
| Create/edit own records | ✅ | ✅ | ✅ |
| Delete any record | ❌ | ✅ | ✅ |
| Manage users, roles, invites | ❌ | ❌ | ✅ |
| Settings (pipeline, automations, email, audit log, landing-page integration) | ❌ | ❌ | ✅ |
| Mandatory MFA to access `/app/*` | ✅ | ✅ | ✅ |

All three roles require MFA verification (AAL2) before any `/app/*` route resolves — there is no
role that can bypass it. See [Auth & 2FA](#key-features) above for current enforcement scope.

---

## Prerequisites

- **Node.js 22** (matches the version pinned in `.github/workflows/ci.yml`; no `.nvmrc` is
  committed, so install 22.x explicitly)
- **npm** (ships with Node)
- A **Supabase project** (free tier is enough for development) — you'll need its URL, publishable
  key, and service role key
- A **Resend account** — needed for the confirmation/automation emails to actually send; the app
  runs without it (emails just stay queued, see [`EMAIL_ENABLED`](#environment-variables))

---

## Getting started

```bash
# 1. Clone and enter the repo
git clone <this-repo-url>
cd crm-core-components-main

# 2. Install dependencies
npm install

# 3. Create your local env file
cp .env.example .env

# 4. Fill in the values — see the Environment variables table below.
#    At minimum you need a Supabase project's URL + keys to do anything useful.

# 5. Set up the database (see "Database & Supabase setup" below) — link the
#    Supabase CLI to your project and push the migrations in supabase/migrations.
supabase link --project-ref <your-project-ref>
supabase db push

# 6. Deploy the email Edge Function and set its secrets (see below), then start the app
npm run dev
```

The dev server runs at `http://localhost:3000` by default (Vite's default unless overridden).
The landing page is at `/`; the CRM login is at `/auth`.

---

## Environment variables

Every variable below is read somewhere in the code (verified against `src/`,
`src/lib/lead-capture.server.ts`, and `supabase/functions/send-automation-email/index.ts`). Copy
`.env.example` to `.env` and fill these in — **never commit `.env`** (it's gitignored; only
`.env.example` should be tracked).

| Variable | Required? | Where to get it | Example |
|---|---|---|---|
| `SUPABASE_URL` | Yes (server) | Supabase dashboard → Project Settings → API | `https://xxxx.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Yes (server) | Supabase dashboard → Project Settings → API → Project API keys (`publishable`/`anon` key) | `sb_publishable_...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (server-only secret) | Supabase dashboard → Project Settings → API → `service_role` key. **Never expose client-side.** | `sb_secret_...` |
| `VITE_SUPABASE_URL` | Yes (client) | Same as `SUPABASE_URL`; exposed to the browser bundle | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes (client) | Same as `SUPABASE_PUBLISHABLE_KEY`; safe to expose | `sb_publishable_...` |
| `VITE_SUPABASE_PROJECT_ID` | Optional | Supabase dashboard → Project Settings → General | `xxxx` |
| `SUPABASE_PROJECT_ID` | Optional | Same as above, server-side copy | `xxxx` |
| `AUTOMATION_DISPATCH_SECRET` | Yes (server + Edge Function secret) | Generate your own (e.g. `openssl rand -hex 32`). Must be set to the **same value** in the app server env and as a Supabase Edge Function secret. | `8f2a1c...` |
| `RESEND_API_KEY` | Yes, to actually send email (server/Edge Function secret) | [resend.com](https://resend.com) → API Keys | `re_...` |
| `LANDING_FROM_EMAIL` | Recommended | A verified sender on your Resend domain | `demo@yourdomain.com` |
| `AUTOMATION_FROM_EMAIL` | Optional (fallback if `LANDING_FROM_EMAIL` unset) | Same as above | `automations@yourdomain.com` |
| `PARTNER_NAME` | Optional | Free text, used in the confirmation email | `Acme Tally Partners` |
| `PARTNER_PHONE` | Optional | Free text | `+233 000 000 000` |
| `PARTNER_EMAIL` | Optional | Free text | `hello@yourdomain.com` |
| `SALES_NOTIFY_BCC` | Optional | An internal inbox to BCC on outbound automation emails | `sales@yourdomain.com` |
| `EMAIL_ENABLED` | Optional (default `true` in `.env.example`) | Safe-launch flag — see [Lead-capture & email flow](#lead-capture--email-flow) | `true` |
| `LEAD_CAPTURE_ALLOWED_ORIGINS` | Optional | Comma-separated origins, only needed if the landing page is ever served from a **different** origin than this app | `https://landing.example.com` |
| `PUBLIC_SITE_ORIGINS` | Optional | Same purpose/format as above (fallback name) | `https://landing.example.com` |

**Secrets — `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `AUTOMATION_DISPATCH_SECRET` — are
server-side/Edge-Function-only.** Never add them to a `VITE_`-prefixed variable, never log them,
and never commit a real `.env`. `scripts/security-check.mjs` (run in CI) checks that no real
`.env*` file is tracked in git.

---

## Database & Supabase setup

1. **Install the Supabase CLI** (`npm install -g supabase` or see Supabase docs) and log in.
2. **Link to your project:**
   ```bash
   supabase link --project-ref <your-project-ref>
   ```
3. **Push the migrations** in [`supabase/migrations/`](supabase/migrations) (applied in filename
   order — they're timestamp-prefixed):
   ```bash
   supabase db push
   ```
   This creates all CRM tables (`profiles`, `companies`, `contacts`, `leads`, `deals`,
   `activities`, `tasks`, `email_queue`, `automation_rules`, `audit_log`, etc.), enables RLS on
   every table, seeds pipeline stages / loss reasons / default automation rules, creates the
   `capture_landing_lead` RPC, and schedules the four `pg_cron` jobs (SLA monitor, reminder
   dispatch, daily digest, re-engagement sweep). The `pg_cron` and `pg_net` extensions are enabled
   by the migrations — make sure they're available on your Supabase plan (enabled by default on
   Supabase's hosted Postgres).
4. **Seed the 3 roles' worth of users.** There's no seed script in the repo — sign up 3 users
   through `/auth`, then assign roles directly in the `user_roles` table (first user gets `rep`
   automatically via the `handle_new_user()` trigger; promote the others to `manager`/`admin`
   manually, e.g. via the Supabase SQL editor, or have an existing admin use Settings → Users &
   Roles once one exists).
5. **Deploy the Edge Function:**
   ```bash
   supabase functions deploy send-automation-email
   ```
6. **Set the Edge Function's secrets** (these are separate from your app's `.env` — Supabase
   Edge Functions read their own secret store):
   ```bash
   supabase secrets set \
     AUTOMATION_DISPATCH_SECRET=<same value as your app's .env> \
     RESEND_API_KEY=<your Resend key> \
     SUPABASE_SERVICE_ROLE_KEY=<your service role key> \
     LANDING_FROM_EMAIL=<verified sender>
   ```
7. Confirm RLS is on for every table — the migrations enable it, but if you add tables later,
   RLS does not apply by default; you must `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and write
   policies yourself.

---

## Available scripts

From [`package.json`](package.json):

| Script | Command | Purpose |
|---|---|---|
| `npm run dev` | `vite dev` | Start the dev server (CRM + landing page) |
| `npm run build` | `vite build` | Production build |
| `npm run build:dev` | `vite build --mode development` | Development-mode build |
| `npm run preview` | `vite preview` | Preview a production build locally |
| `npm run lint` | `eslint .` | Lint the codebase |
| `npm run test` | `node scripts/security-check.mjs` | Security regression checks (see note below) |
| `npm run test:ci` | `npm run test` | Alias used by CI |
| `npm run ci` | `npm run lint && npm run test && npm run build` | Runs the full CI gate locally |
| `npm run format` | `prettier --write .` | Format the codebase |

**Note:** there is no unit/integration test framework installed (no Jest/Vitest). `npm run test`
runs `scripts/security-check.mjs`, which is a static regression check (no `.env` tracked,
CI/`.gitignore` wired correctly, the lead-capture endpoint and email dispatcher still contain
specific hardening code) — not a behavioral test suite. Treat "tests" in CI as a security
linter, not proof of functional correctness.

---

## Project structure

```
.
├── .github/
│   ├── workflows/ci.yml         # lint → test (security-check.mjs) → build, on PR + push to main
│   └── dependabot.yml           # weekly npm + GitHub Actions dependency PRs
├── docs/                        # PRD, URD, design spec, build plan, checklist (source of truth for scope)
├── supabase/
│   ├── config.toml
│   ├── migrations/              # 9 timestamped SQL migrations — schema, RLS, automations, RPCs
│   └── functions/
│       └── send-automation-email/index.ts   # the only Edge Function: drains email_queue via Resend
├── scripts/
│   └── security-check.mjs       # CI security regression checks (see "Available scripts")
├── src/
│   ├── routes/
│   │   ├── index.tsx             # public TallyPrime landing page
│   │   ├── auth.tsx, mfa.tsx, reset-password.tsx
│   │   ├── api.public.leads-capture.tsx       # public lead-capture endpoint
│   │   └── _authenticated/       # MFA + auth-gated CRM: app.leads, app.deals, app.contacts,
│   │                              # app.companies, app.activities, app.tasks, app.analytics,
│   │                              # app.settings, app.index (dashboard), app.pipeline
│   ├── components/               # leads/, deals/, contacts/, companies/, activities/, tasks/,
│   │                              # dashboard/, layout/, ui/ (shadcn primitives), common/
│   ├── integrations/
│   │   ├── supabase/             # client.ts (browser), client.server.ts (service role),
│   │   │                          # auth-middleware.ts, auth-attacher.ts, types.ts (generated)
│   │   └── lovable/               # Lovable Cloud auth/error-reporting glue
│   ├── lib/
│   │   ├── lead-capture.server.ts   # public capture endpoint logic (validation, CORS, RPC call)
│   │   ├── *-data.ts                # one data-access module per entity (leads, deals, contacts, ...)
│   │   ├── auth-context.tsx         # React auth/role context
│   │   └── config.server.ts, format.ts, utils.ts, error-*.ts
│   ├── types/index.ts            # shared TS types (Role, CurrentUser, ...)
│   ├── router.tsx, server.ts, start.ts, routeTree.gen.ts (generated, do not edit)
│   └── styles.css
├── .env.example                  # template — copy to .env, fill in, never commit the filled copy
├── package.json
└── README.md
```

---

## Lead-capture & email flow

1. A visitor submits the form on `/` (`ContactForm` in `src/routes/index.tsx`). A hidden honeypot
   field (`website`) silently no-ops the submission if filled, without telling a bot it failed.
2. The browser `POST`s JSON to `/api/public/leads-capture`, handled by
   `src/lib/lead-capture.server.ts`. This route, on every request:
   - rejects non-`POST` methods, non-JSON content types, and bodies declared larger than 16KB
   - requires HTTPS in production
   - validates the request's Origin against same-origin or an explicit allow-list
     (`LEAD_CAPTURE_ALLOWED_ORIGINS`/`PUBLIC_SITE_ORIGINS`) — only needed if the landing page is
     ever hosted on a different origin than this app
   - validates the payload shape with `zod` (name/email required, length caps, optional phone/
     company/message)
3. On success it calls the `capture_landing_lead` Postgres RPC, which: dedupes by email against
   existing contacts, round-robin assigns to the rep with the fewest open leads, inserts the lead
   (`status = 'new'`, `source = 'Tally Landing Page'`), creates a "Make first contact" task due in
   4 hours, queues a `landing_lead_confirmation` row in `email_queue`, and writes an `audit_log`
   entry — all in one DB call.
4. The lead now exists and is immediately visible on the CRM Kanban/dashboard (no polling delay —
   it's a normal DB row).
5. The server route then fires (and awaits) a call to the `send-automation-email` Edge Function,
   authenticated with `AUTOMATION_DISPATCH_SECRET` (constant-time compared) plus the Supabase
   anon key, which pulls the just-queued row (and any other pending rows) and sends it via the
   Resend API, marking it `sent` or `failed` (retried up to 5 attempts).
6. **`EMAIL_ENABLED` is a safe-launch flag** — `.env.example` defaults it to `true`, but the email
   send only actually happens if `RESEND_API_KEY` and `AUTOMATION_DISPATCH_SECRET` are both
   configured; if either is missing, the lead still saves successfully (the visitor still sees a
   success state) and the email simply stays queued/unsent, logged via `console.warn` server-side
   — there is no user-facing failure for a missing email configuration.

---

## Security notes

- **RLS is the real authorization boundary.** Every table has Row-Level Security enabled; the
  `anon` (public/unauthenticated) role has all default grants revoked and is only re-granted
  `INSERT` on a specific column subset of `leads` plus `EXECUTE` on `capture_landing_lead`. The
  landing page genuinely cannot read CRM data — there's no client-side check standing in for this.
- **Mandatory MFA** is enforced at the `_authenticated` route boundary by checking the session's
  Authenticator Assurance Level on every load (`supabase.auth.mfa.getAuthenticatorAssuranceLevel()`)
  and redirecting to `/mfa` if AAL2 isn't satisfied.
- **No secrets reach the client.** `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, and
  `AUTOMATION_DISPATCH_SECRET` are only ever read server-side (`*.server.ts` files) or inside the
  Deno Edge Function — never via a `VITE_`-prefixed variable.
- **Spam/abuse protection on the public form:** a honeypot field, request-size cap, content-type
  enforcement, and origin validation, all server-side (client-side validation alone is never
  trusted).
- **Email templating escapes user input.** Lead-supplied `first_name`/`company_name`/`message`
  are HTML-escaped before being interpolated into the confirmation email template.
- **Logging is redacted.** Both the lead-capture route and the email Edge Function run log
  values through a sanitizer that redacts long token-like substrings before writing to logs.
- `.env` and `.env.*.local` are gitignored; only `.env.example` (placeholders only) is tracked.
  `scripts/security-check.mjs` enforces this in CI.

---

## Deployment

The CRM and the landing page are **one app and deploy together** (they're the same TanStack Start
build — see [Architecture](#architecture)); there is no separate landing-page deployment to
coordinate. To deploy:

1. Build with `npm run build` (Vite + Nitro SSR output).
2. Deploy the resulting server build to whatever Node-compatible host you use; ensure all server
   env vars from the [table above](#environment-variables) are set in that host's environment
   (not just locally).
3. Deploy/keep the Supabase project's migrations current (`supabase db push`) and the
   `send-automation-email` Edge Function deployed with its own secrets set (see
   [Database & Supabase setup](#database--supabase-setup)) — these are deployed independently of
   the app server, against your Supabase project directly.
4. **CI** (`.github/workflows/ci.yml`) runs on every PR and every push to `main`: checkout → Node
   22 → `npm ci` → `npm run lint` → `npm run test` (security checks) → `npm run build`. There is
   no automatic deploy step in the committed workflow — wire one up for your hosting target if you
   want push-to-deploy.

---

## Acceptance criteria

Restated from `docs/CHECKLIST.md` §21 ("Final acceptance"), checked against the current repo
state. **Met** = implemented and traceable in code/migrations. **Partial** = some of the
requirement is built. **Planned** = tracked in `docs/CHECKLIST.md` but not yet implemented.

| Criterion | Status |
|---|---|
| Visitor form → lead on dashboard ≤10s + email ≤60s | **Partial** — lead save is synchronous/instant; email send depends on Resend/Edge Function config being present (see [Lead-capture & email flow](#lead-capture--email-flow)); no automated latency test exists |
| 3 users with correct matrix permissions | **Partial** — role model + RLS policies for Admin/Manager/Rep are implemented and enforced server-side; no seed script creates the 3 users automatically (manual setup, see [Database & Supabase setup](#database--supabase-setup)) |
| 2FA enforced for all | **Partial** — AAL2 gate blocks `/app/*` until MFA is verified; forced first-login enrollment with no skip path, 8h session expiry, and admin session revocation are still open per `CHECKLIST.md` §1 |
| Lead→deal conversion creates linked contact+company atomically | **Met** — 3-step convert flow + `convert_lead_to_deal` RPC |
| Deal moves through all stages, each logged | **Met** — `deal_stage_history` trigger logs every transition |
| Close Won/Lost works; Lost requires reason | **Met** |
| Automations fire end-to-end and are audited | **Met** — trigger-based stage automations + `pg_cron` SLA/digest/re-engagement jobs, all writing to `audit_log` |
| Light extras (tasks, dashboard, search/filter) work | **Partial** — tasks and dashboard widgets work; task reminder *dispatch* (notifying someone) and the 4 dashboard KPI count-up cards are open per `CHECKLIST.md` §10/§12 |
| App deploys from `main` without errors | **Met** — CI builds on every push to `main`; no committed automated deploy step (see [Deployment](#deployment)) |

For the full, granular section-by-section checklist (21 sections), see
[`docs/CHECKLIST.md`](docs/CHECKLIST.md) directly — it's the maintained source of truth and is
more current than any snapshot in this README.

---

## Known limitations

- No automated test suite (Jest/Vitest) — `npm run test` is a static security regression check,
  not behavioral coverage. The acceptance tests listed in `CHECKLIST.md` §20 (lead→email,
  RLS-blocks-rep, 2FA-cannot-be-bypassed, stage-change-creates-task) are not yet automated.
- No seed script for the 3 demo users/roles — set up manually per
  [Database & Supabase setup](#database--supabase-setup).
- Task reminder dispatch, the 4 KPI dashboard cards, role-scoped dashboard data, and several
  table/detail views noted as `[ ]` in `docs/CHECKLIST.md` are not yet built — see that file for
  the authoritative, itemized list.
- Lead capture is implemented as a TanStack Start server route + Postgres RPC, not a Supabase
  Edge Function as literally described in `docs/design.md` (see the architecture note above) —
  functionally equivalent, but don't point an external integration at a Supabase Functions URL.
- `EMAIL_ENABLED` exists in `.env.example` as a documented safe-launch flag, but actual email
  sending is gated by `RESEND_API_KEY`/`AUTOMATION_DISPATCH_SECRET` presence rather than this
  flag being read directly in the email path — treat configuring those two secrets as the real
  on/off switch for outbound email today.

---

## License & credits

No `LICENSE` file or `license` field is currently committed to this repository — treat the code
as proprietary to this engagement unless/until a license is added.

TallyPrime™ is a product of Tally Solutions Pvt. Ltd. This repository is an independent partner
build (CRM + marketing site) for an authorized TallyPrime reseller and is not affiliated with or
endorsed by Tally Solutions.