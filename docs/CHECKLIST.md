# CHECKLIST.md — Tally CRM Full-Feature Implementation Checklist

**Ref:** ASM-CRM-001 v2.0. Work top to bottom. An item is "done" only when it works end-to-end with every state (empty / loading / error) and is enforced server-side where security applies.

---

## 0. Project setup

- [x] Vite + React + TS + Tailwind + shadcn/ui scaffolded
- [ ] Supabase project connected; `.env.example` committed; no secrets in repo
- [ ] Public routes (`/`, `/login`, `/2fa`, `/onboarding`) and protected `/app/*` guard in place
- [ ] Lovable → GitHub sync working; clean clone builds via README

## 1. Authentication & mandatory 2FA

- [ ] Email/password login (Supabase Auth, bcrypt)
- [ ] 2FA **enrollment forced on first login** — cannot skip
- [ ] TOTP (QR + secret) **and** email-OTP options both work
- [ ] 2FA **verification required on every subsequent login** (AAL2)
- [ ] CRM data blocked until MFA verified (AAL1 → redirected to `/2fa`)
- [ ] Forgot-password + reset (magic link) works
- [ ] First-login onboarding wizard (profile, webhook for admin, invite team)
- [ ] Session expires after 8h inactivity; Admin can revoke sessions
- [ ] 3 seeded users exist: 1 Admin, 1 Sales Manager, 1 Sales Rep

## 2. Security & RLS (server-side, not UI-only)

- [ ] RLS enabled on **every** table
- [ ] Rep sees only own/assigned records (others return 0 rows / 403)
- [ ] Rep cannot delete any record
- [ ] Manager sees all records, can delete, but cannot manage users/settings
- [ ] Admin unrestricted
- [ ] Landing page can **insert** leads but **cannot read** CRM data
- [ ] Secrets (Resend, service role) only in Edge Functions
- [ ] Soft deletes (`deleted_at`) everywhere; audit integrity preserved
- [ ] HTTPS enforced; CSRF protection

## 3. Landing page (public)

- [ ] Hero, key benefits, features, pricing teaser, social proof
- [ ] Contact form: First*, Last*, Email\*, Phone, Company, Message
- [ ] Client-side validation (required, email/phone format)
- [ ] Honeypot / bot protection
- [ ] Submit → POST to `leads-capture` Edge Function over HTTPS
- [ ] Thank-you success state + graceful error state
- [ ] Responsive; loads < 3s on 4G

## 4. Lead-capture flow (headline integration)

- [ ] Edge Function validates server-side
- [ ] Dedupe by email (link, don't duplicate contact)
- [ ] Lead inserted with `source = "Tally Landing Page"`, status New Lead
- [ ] Round-robin auto-assignment (or unassigned per config)
- [ ] Confirmation email sent **only after** successful save (Resend)
- [ ] Email delivery status logged on the lead
- [ ] Lead appears on dashboard/Kanban within 10s
- [ ] Email-fail path creates a "manually contact lead" task

## 5. Leads module

- [x] Kanban (New Lead / Contacted / Qualified ...) with drag-to-change-status
- [ ] Table view (search / filter / sort) scoped by role
- [x] Add Lead modal (manual entry) with validation
- [ ] Lead detail: timeline, notes, email history
- [x] Lead-capture payload panel (source, timestamp, IP country, email status)
- [x] 3-step Convert flow (Contact → Company → Deal)
- [x] Disqualify flow (reason + note → archive)
- [x] Empty / loading / error states

## 6. Contacts module

- [x] Grid + table views
- [ ] Add / Edit modal (all fields, validation)
- [x] Detail page: Overview, Deals, Activities, Notes, Lead Origin tabs
- [ ] Delete with confirm (hidden for Rep) + merge duplicates (Admin)
- [x] Bulk actions bar
- [x] Empty / loading / error states

## 7. Companies module

- [x] Grid (with rating) + table
- [ ] Add / Edit modal + logo upload
- [x] Detail: Overview, Contacts, Deals, Activities, Notes
- [ ] Delete with confirm
- [x] Empty / loading / error states

## 8. Deals & pipeline

- [x] 7-stage Kanban, colour-coded, horizontal scroll
- [x] Probability badge per card; priority bar
- [ ] Drag-and-drop logs `deal_stage_history`; optimistic move + revert on fail
- [x] Add Deal modal (contact*, value+currency, stage selector, close date*)
- [x] Detail: Timeline (stage milestones), Activities, Proposals, Contacts, Value History
- [x] Value changes version-tracked (never overwritten)
- [x] Close Won (actual value/date + confetti)
- [x] Close Lost (required reason)
- [x] Pipeline funnel page (click stage → expand, time filter)
- [x] Empty / loading / error states

## 9. Activities & notes

- [x] Table + filter tabs (calls/emails/tasks/meetings)
- [x] Slide-over detail panel
- [x] Add modal (type, due, owner, link contact/deal, reminder, outcome)
- [x] Lifecycle Pending → In Progress → Completed (outcome required)
- [x] Overdue row styling
- [ ] Immutable after 15-min grace window
- [x] Timeline on contact + deal detail (reverse-chron)

## 10. Tasks & reminders

- [x] Grouped-by-date list with all row elements + status accent bar
- [x] Add Task modal (type, due, assignee, priority, link contact/deal)
- [x] Quick-complete (checkbox → strikethrough + toast)
- [ ] Reminders fire (in-app + optional email)
- [x] Empty / loading / error states

## 11. Automations (PRD §14)

- [x] New lead → auto-assign + "Make first contact" task (+4h) + notify
- [x] Lead → Contacted creates "Qualify (BANT)" task (+2d)
- [x] Lead → Qualified creates "Prepare demo / convert" task (+1d)
- [x] Convert → Deal creates "Schedule Tally demo" task (+2d)
- [x] Deal → Demo/Proposal creates "Send proposal" (+1d) + follow-up reminder (+3d)
- [x] Deal → Negotiation creates "Follow up on terms" (+2d)
- [x] Probability auto-sets to stage default on each stage change
- [x] Closed-Won creates welcome (+1d) + renewal check-in (+11mo) tasks + notifies mgr/admin
- [x] Closed-Lost requires reason + creates re-engagement task (+90d)
- [x] SLA monitor flags overdue/stale + escalates to Manager
- [x] Daily digest delivered per user; reminder dispatch works
- [x] Re-engagement sweep surfaces cold leads/lost deals
- [x] Every automated action logged to audit (actor = System/Automation)
- [x] Admin can toggle/edit each rule in Settings → Automations

## 12. Dashboard

- [ ] 4 KPI cards (new leads, open deals, closed-won, conversion) with count-up
- [x] Pipeline funnel + lead-source donut
- [x] Recent activity feed + my tasks (overdue red)
- [x] Mini pipeline preview + greeting
- [ ] Scope by role: Rep = own; Manager/Admin = team + per-rep performance
- [x] Empty + loading-skeleton states

## 13. Analytics (Admin + Manager)

- [x] Period selector + 4 pipeline-health KPIs
- [x] Revenue chart (target vs actual)
- [x] Conversion funnel with drop-off %
- [x] Rep leaderboard (crown for top)
- [x] Lead-source breakdown + win/loss donut + top loss reasons
- [x] Individual rep report
cod
## 14. Settings (Admin only)

- [x] General (currency=GHS, timezone, date format, logo)
- [x] Pipeline config (reorder, name/colour/SLA, min-3 lock)
- [x] Users & Roles (3 roles, 2FA status, invite flow)
- [x] Lead assignment (round-robin queue)
- [x] Automations (rule toggles/edits)
- [x] Email & notifications (Resend/SMTP + test)
- [x] Loss reasons (edit/reorder)
- [x] Audit log (filter + CSV export)
- [x] Landing-page integration panel (endpoint, key, test lead)
- [x] Manager/Rep have **no** Settings nav

## 15. Notifications

- [x] Topbar bell + unread count
- [x] Dropdown lists reminders, escalations, assignments, digests
- [x] Mark-as-read; optional email mirror per settings

## 16. Cross-cutting states & UX

- [x] Every list: search + filter + sort within permitted scope
- [x] Every entity: empty, loading (skeleton), error states
- [x] Every modal: Cancel + Confirm, Escape closes, keyboard trap
- [x] Every form: required-field + format validation
- [x] Every destructive action: confirm dialog
- [x] Toasts for success/error; optimistic UI with revert

## 17. Design & brand consistency

- [ ] All colours via CSS variables (zero hardcoded hex)
- [ ] Typography scale + 4px spacing grid followed
- [ ] Single icon library throughout (Lucide)
- [x] Hover/focus/active/disabled on all interactive elements
- [ ] "Powered by TallyPrime" mark; login hero; Closed-Won confetti
- [ ] Dark mode across all tokens; toggle persists

## 18. Responsiveness

- [x] Desktop (1280+): full sidebar + multi-column
- [x] Tablet (768–1279): collapsed sidebar + 2-col
- [ ] Mobile (<767): bottom nav + 1-col + full-screen modals + kanban scroll

## 19. Performance (non-functional)

- [ ] Lead capture < 500ms p95
- [ ] Dashboard < 2s
- [x] Skeletons not spinners; lazy avatars; virtualized long tables

## 20. Testing, CI & deployment

- [ ] Test: form submission creates lead + triggers email
- [ ] Test: RLS — rep cannot read/delete others' records
- [ ] Test: 2FA cannot be bypassed
- [ ] Test: stage change creates the correct auto-task
- [ ] Lint clean; CI runs lint + tests on every PR
- [ ] Clean clone builds & runs from README; no secrets committed
- [ ] Final code merged to `main` via reviewed PRs

## 21. Final acceptance (must all pass)

- [ ] Visitor form → lead on dashboard ≤10s + email ≤60s
- [ ] 3 users with correct matrix permissions
- [ ] 2FA enforced for all
- [ ] Lead→deal conversion creates linked contact+company atomically
- [ ] Deal moves through all stages, each logged
- [ ] Close Won/Lost works; Lost requires reason
- [ ] Automations fire end-to-end and are audited
- [ ] Light extras (tasks, dashboard, search/filter) work
- [ ] App deploys from `main` without errors

_End of CHECKLIST.md · v2.0_
