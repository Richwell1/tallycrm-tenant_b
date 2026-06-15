# plan.md — Tally CRM Build Plan (Lovable)

**Ref:** ASM-CRM-001 v2.0. Build the CRM + public Tally landing page. Stack: **React+Vite · Tailwind+shadcn/ui · Supabase (Postgres/Auth/RLS/Edge Functions) · Resend**. Use the screens generated from `design.md`. Read PRD.md for full requirements. Keep changes small and reviewable.

**Non-negotiables:** mandatory 2FA for every CRM user · RLS enforces all access server-side · secrets only in Edge Functions · landing page is public + write-only · soft deletes (`deleted_at`).

---

## 0. Setup
- Init Vite + React + TS + Tailwind + shadcn/ui. Connect Supabase project. Add `.env.example` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, server-only `RESEND_API_KEY`, `SERVICE_ROLE_KEY`).
- Routing: public `/` (landing), `/login`, `/2fa`, `/onboarding`; protected `/app/*` behind auth+MFA guard.

## 1. Database schema (Postgres)
Tables (all with `id uuid pk default gen_random_uuid()`, `created_at`, `updated_at`, `deleted_at`, `owner_id` where ownable):
- `profiles` (id→auth.users, full_name, avatar_url, role enum `admin|manager|rep`, status, last_login)
- `companies` (name unique, industry, email, phone, website, linkedin, address, city, country, rating int, notes, account_manager_id)
- `contacts` (first_name, last_name, email unique, phone, job_title, company_id→companies, source, tags text[], assigned_to)
- `leads` (first_name, last_name, email, phone, company_name, message, source default 'Tally Landing Page', status enum, ip_country, email_status, qualified bool, disqualify_reason, converted_deal_id, assigned_to)
- `deals` (name, primary_contact_id→contacts, company_id→companies, value numeric, currency default 'GHS', stage_id→pipeline_stages, probability int, expected_close_date, actual_close_date, actual_value, description, tags[], assigned_to, lost_reason)
- `pipeline_stages` (name, position int, color, sla_days, is_closed bool) — seed 7: New Lead, Contacted, Qualified, Demo/Proposal, Negotiation, Closed-Won, Closed-Lost
- `activities` (type enum call|email|meeting|demo|proposal|note, title, contact_id, deal_id, due_at, duration, outcome, notes, owner_id, locked_at)
- `tasks` (title, type, due_at, status enum, priority enum, contact_id, deal_id, assigned_to, reminder_at)
- `deal_stage_history` (deal_id, from_stage, to_stage, changed_by, changed_at)
- `deal_value_history` (deal_id, old_value, new_value, reason, changed_by, changed_at)
- `loss_reasons` (label, position) — seed: Price too high, Chose competitor, No budget, Timing, Unresponsive
- `audit_log` (actor_id, action, entity, entity_id, entity_name, ip, created_at)
- `automation_rules` (key, trigger_type, enabled bool, config jsonb {delays, sla_days, probability, target_task, escalation_role}) — seed defaults from PRD §14.2
- `notifications` (user_id, type, title, body, entity, entity_id, read bool, created_at)

## 2. RLS policies (enable on every table)
- **profiles:** user reads/updates own; admin all.
- **Ownable tables (contacts/deals/leads/tasks):**
  - `admin` + `manager` → full select/insert/update; **delete** allowed.
  - `rep` → select/insert/update WHERE `assigned_to = auth.uid()` (or `owner_id`); **no delete**.
- **companies/pipeline_stages/loss_reasons:** admin/manager full; rep select only (+ insert/update companies if allowed).
- **leads insert (public):** allow INSERT from the Edge Function service role only; **no public select**.
- **settings tables & user management:** admin only.
- Helper: SQL function `auth_role()` returns the caller's role from `profiles` for use in policies.
- Test: a `rep` selecting another user's deal returns 0 rows; delete returns error.

## 3. Auth + mandatory 2FA
- Supabase Auth email/password. Enable **MFA (TOTP)**; support **email OTP** fallback.
- Route guard: session must be **AAL2** (MFA-verified) to enter `/app/*`. If authenticated but no MFA factor → force `/2fa` enrollment (screen 9B), cannot skip. If factor exists but session is AAL1 → `/2fa` verification (9C).
- First login → onboarding wizard (9E) after MFA. Session expiry 8h. Admin can revoke sessions.
- Seed 3 users: 1 `admin`, 1 `manager`, 1 `rep`, each must enroll 2FA on first login.

## 4. Edge Function `leads-capture` (public, write-only)
```
POST /functions/v1/leads-capture
1. Validate body (first_name, last_name, email required; email/phone format). Honeypot field check.
2. Dedupe: find contact by email → reuse; else create contact.
3. Insert lead (source='Tally Landing Page', status='New Lead', round-robin assigned_to).
4. On success → Resend confirmation email to submitter; log email_status.
5. Insert audit_log + system activity. Return {ok, leadId} or {error, code}.
```
Use service role inside the function only. Never call Resend or expose keys from the browser.

## 4b. Automation engine (PRD §14)
Rule model: trigger → conditions → actions, driven by `automation_rules` (data-driven, not hardcoded).

**Synchronous (Postgres triggers/functions) — transactional with the record write:**
- On `deals`/`leads` stage change → write `*_stage_history`, set probability to stage default, and INSERT the configured auto-task to the owner. Matrix:
  - Lead captured → task "Make first contact" +4h + notify + round-robin assign
  - Lead→Contacted → "Qualify lead (BANT)" +2d
  - Lead→Qualified → "Prepare demo / convert" +1d
  - Convert→Deal → "Schedule Tally demo" +2d
  - Deal→Demo/Proposal → "Send proposal" +1d + reminder "Follow up" +3d (prob 50%)
  - Deal→Negotiation → "Follow up on terms" +2d (prob 75%)
  - Closed-Won → "Send welcome & next steps" +1d, "Renewal check-in" +11mo, notify mgr/admin (prob 100%)
  - Closed-Lost → require reason, re-engagement task +90d (prob 0%)
- On value change in Negotiation → write `deal_value_history`; notify manager if drop > threshold.
- Every automated action → INSERT `audit_log` (actor = 'system').

**Scheduled (pg_cron → SQL fn or Edge Function):**
- Hourly **SLA monitor**: flag leads/deals past stage SLA → overdue/stale + escalate to Manager (notification).
- **Reminder dispatch**: fire task reminders at due window.
- **Daily digest** (morning): per-user email/in-app summary (today's tasks, overdue, new leads) via Edge Function + Resend.
- **Re-engagement sweep**: surface disqualified/Closed-Lost past cooldown.

**Email-fail handling:** if `leads-capture` email send fails → set `email_status='failed'` and INSERT task "Manually contact lead — email failed" to assignee.

**Notifications:** write to `notifications` table; topbar bell reads unread; optional email mirror per Settings toggles.


Order — finish each before next:
1. **Shell + components** — sidebar (role-aware nav, Settings admin-only), topbar, shared components.
2. **Landing page** — hero/features/pricing/social proof + form → POST to `leads-capture`; thank-you + error states.
3. **Auth** — login, 2FA enroll/verify, forgot/reset, onboarding.
4. **Dashboard** — KPIs, funnel, source donut, activity feed, tasks, mini-pipeline; scope by role (rep=own, manager/admin=all).
5. **Leads** — kanban + table + detail + capture panel + 3-step convert + disqualify.
6. **Contacts** — grid/table/detail(5 tabs)/add/edit/delete(confirm)/bulk.
7. **Companies** — grid/table/detail/add/edit/logo upload.
8. **Deals & Pipeline** — 7-stage kanban (DnD logs stage_history), probability badges, add modal, detail(5 tabs incl. value_history), Close Won (confetti)/Lost (reason), pipeline funnel page.
9. **Activities** — table + filters + slide-over + add + lifecycle + overdue; lock after 15min.
10. **Tasks** — grouped list + add + quick-complete + reminders.
11. **Analytics** (admin/manager) — KPIs, revenue, funnel, leaderboard, source, win/loss.
12. **Settings** (admin) — 8 tabs incl. Users&Roles (3 roles + 2FA status), Landing Page Integration (endpoint/key/test), Pipeline config (name/colour/**SLA days**), Loss reasons, Audit log export, **Automations** (toggle each rule, edit delays/SLA/probability/target task/escalation).
13. **Notifications** — topbar bell + dropdown reading `notifications`; mark-read; in-app reminders/escalations/digests surfaced here.

Every list: search/filter/sort within permitted scope. Every screen: empty/loading(skeleton)/error states. Kanban: optimistic move, revert + toast on failure. Destructive actions: confirm dialog (hidden for rep).

## 6. Acceptance gate (must all pass)
1. Form submit → lead in CRM (source='Tally Landing Page') ≤10s + confirmation email ≤60s.
2. 3 seeded users with correct matrix permissions.
3. 2FA enforced for all; no data access pre-verification.
4. Lead → deal conversion creates linked contact+company atomically.
5. Deal moves through all stages; each change logged.
6. Close Won/Lost works; Lost requires reason.
7. RLS verified: rep cannot see/delete others' records.
8. Tasks, dashboard metrics, search/filter work.
10. **Automations fire:** new-lead assignment + "make first contact" task; each stage change auto-creates its task and sets probability; SLA breach escalates to Manager; Closed-Won/Lost create their follow-up/re-engagement tasks; every automated action hits the audit log.
9. Clean clone builds via README; CI green; no secrets in repo.

## 7. Then → GitHub → Claude Code
Push via Lovable GitHub sync. In Claude Code: harden capture (server validation, spam/captcha, retries, email-fail handling), refactor to shared/typed components, add tests (incl. "submit creates lead + triggers email"), re-audit RLS + 2FA-cannot-bypass, add CONTRIBUTING + CI (lint+tests on PR). Merge via reviewed PRs.

*End of plan.md · v2.0*
