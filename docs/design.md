# design.md — Tally CRM · Google Stitch UI Generation Prompt

**Project:** Simple CRM for TallyPrime software sales · **Ref:** ASM-CRM-001 v2.0
**Audience:** Tally partner sales teams (Admin · Sales Manager · Sales Rep)
**Brand:** TallyPrime identity (blue + teal + gold, navy sidebar)
**Stack the UI must suit:** React + Vite · Tailwind + shadcn/ui · Supabase (Auth + RLS + Edge Functions)

> **How to use this file in Stitch:** Generate feature by feature in the order given. Build the shared design system and component library (Feature 0) once, then reuse everywhere. Do not move to the next feature until the current one covers every screen and every state (empty, loading, filled, error). Auth screens (Feature 9) include **mandatory 2FA** — do not omit the enrollment and verification steps.

---

## 1. Design System Foundation

### 1.1 Colour tokens (use CSS variables only — no hardcoded hex)
```
/* PRIMARY */            /* ACCENT */                /* SEMANTIC */
--color-primary:#0057B8  --color-accent:#F5A623      --color-success:#1A9E4A / -light:#E6F6ED
--color-primary-dark:#003F8A  --color-accent-dark:#D4891A   --color-warning:#E07B00 / -light:#FFF3E0
--color-primary-light:#E8F0FB  --color-accent-light:#FEF3DC   --color-danger:#D32F2F / -light:#FDECEA
--color-primary-mid:#2E7DD1                                 --color-info:#0288D1 / -light:#E1F5FE

/* NEUTRALS */                                  /* SIDEBAR */
--color-bg:#F4F6FA  --color-surface:#FFFFFF      --color-sidebar-bg:#0A1628
--color-surface-hover:#F0F4FF                    --color-sidebar-item:#8BA3C7
--color-border:#E2E8F0  --color-border-strong:#CBD5E1   --color-sidebar-active:#FFFFFF
--color-text-primary:#1A202C  --color-text-secondary:#4A5568   --color-sidebar-active-bg:#0057B8
--color-text-muted:#94A3B8  --color-text-inverse:#FFFFFF       --color-sidebar-section:#4A6080
```
Dark mode: every token has a dark variant; sidebar stays navy; card surface `#1E2A3A`, hover `#263347`, text `#E2E8F0`; charts use brighter accents. Toggle persists.

### 1.2 Typography
Font: `Inter, "Segoe UI", system-ui, sans-serif`. Scale: xs 11 · sm 13 · base 14 · md 15 · lg 18 · xl 22 · 2xl 28 · 3xl 36 (px). Weights 400/500/600/700.

### 1.3 Spacing & radius
4px base scale (4/8/12/16/20/24/32/40/48/64). Radius: sm 4 · md 8 · lg 12 · xl 16 · full 9999. Shadows: card `0 1px 4px rgba(0,0,0,.06), 0 0 0 1px rgba(226,232,240,.8)`; md `0 4px 16px rgba(0,87,184,.10)`; lg `0 8px 32px rgba(0,87,184,.15)`.

### 1.4 Component grammar
- **Primary CTA ("Add" actions):** high-visibility red `#E53E3E`, white text, radius-sm, icon left. All *other* interactive elements use `--color-primary` blue.
- **Cards:** white, card shadow, radius-md, 16px padding; 40px avatar; 3-dot menu; tag pills; assigned avatar.
- **Form inputs:** 38px height, radius-sm, label above (sm semibold secondary), focus ring primary 2px.
- **Badges/tags:** radius-full, 5×10 padding, xs semibold; status → semantic colour.
- **Data table:** zebra rows, header bg `--color-primary-light`, 48px rows, sortable arrows, checkbox select, bulk bar.
- **Modals:** standard 480 / wide 720, backdrop `rgba(0,0,0,.4)`, header+scroll body+sticky footer (Cancel ghost / Confirm primary).
- **Empty states:** simple SVG illustration (Tally-blue toned, no stock photos), heading, subtext, CTA.
- **Loading:** skeleton shimmer (primary-light pulse) matching final shape — never bare spinners.
- Icons: one library throughout (Lucide). Micro-interactions: card hover lift `translateY(-2px)`; KPI count-up; drag card `opacity:.7` with dashed placeholder; toasts slide in bottom-right.

---

## 2. Global Shell (build first, reuse everywhere)

**Layout:** fixed Topbar (60px) + fixed Sidebar (260px, collapsible to 64px) + scrollable main (24px padding) with PageHeader + content body.

**Sidebar (navy `#0A1628`):** "Tally CRM" wordmark (CRM in accent gold). Sections — DASHBOARD · Contacts · Companies · Leads · Deals · Pipeline · Activities · Tasks · Analytics · Settings (Admin only). Active item = blue pill, white text. Bottom: user avatar + name + **role label** + collapse arrow. Footer mark: "Powered by TallyPrime" (muted white).

**Topbar:** left = page title + breadcrumb; right = global search (⌘K) → theme toggle → grid/list toggle → notifications (bell + red badge) → user avatar (green online dot). Navigation and visible items adapt to role (Settings hidden for non-admins).

---

## Feature 0 — Shared Component Library (build before any page)
EntityCard (contact/company) · KanbanColumn · KanbanCard · DataTable · Modal (standard+wide) · StatusBadge (New Lead=blue, Contacted=amber, Qualified=purple, Demo/Proposal=teal, Negotiation=orange, Won=green, Lost=red) · AvatarStack · SearchBar · FilterPanel · PageHeader · EmptyState · ToastNotification · ConfirmDialog · ActivityItem · PipelineFunnelChart · **RoleBadge** (Admin/Manager/Rep) · **OTPInput** (6-digit segmented, for 2FA).
**Checkpoint:** all render in isolation, with hover/focus/active/disabled, dark-mode tokens, responsive below 768px.

---

## Feature 1 — Dashboard (role-aware)
- **KPI row (4):** New Leads (today/week toggle), Open Deals (count + value), Closed-Won this month (count + revenue), Conversion Rate. Count-up animation.
- **Charts:** Pipeline Funnel (60%) + Lead Source Donut — Tally Landing Page / Manual / Referral (40%).
- **Split:** Recent Activity feed (ActivityItem) + My Tasks/Reminders (overdue in red).
- **Mini pipeline** preview (full width) with "View Full Pipeline".
- **Greeting:** "Good morning, [Name] 👋 — You have N new leads from TallyPrime.com".
- **Scope by role:** Rep = own data only; Manager = whole team + per-rep performance table + lead-volume + win/loss charts; Admin = same as Manager plus admin shortcuts.
- States: empty ("Import your first leads" / "Connect landing page"), loading skeleton matching layout.
**Checkpoint:** all KPIs, both charts, feed, tasks, mini-pipeline, manager/admin panels, empty, loading.

---

## Feature 2 — Contacts
Grid view (4-col → EntityCard) + table view + Add/Edit modal (wide, 2-col fields incl. Company searchable w/ create-new, Country, Tags, Notes, Assigned To) + Contact detail page (30/70, tabs: Overview, Deals, Activities, Notes, Lead Origin) + delete confirm (type-name) + empty state + bulk action bar (Assign / Tag / Export / Delete / Email). Delete/bulk-delete hidden for Sales Rep.
**Checkpoint:** grid, table, add, edit, detail (5 tabs), delete confirm, empty, bulk bar.

---

## Feature 3 — Companies
Grid (cards with star rating, gold) + table + Add/Edit modal (Name, Industry, Email, Phone, Website, LinkedIn, Address, City, Country, Account Manager, Tags, Notes, logo drag-drop) + detail page (tabs: Overview, Contacts, Deals, Activities, Notes) + empty + delete confirm.
**Checkpoint:** grid w/ ratings, table, add/edit w/ logo, detail (5 tabs), empty, delete.

---

## Feature 4 — Leads
Kanban (columns: New Lead=blue, Contacted=amber, Qualified=purple, Closed/Lost handled via convert/disqualify) with drag-to-change-status + table view + Add Lead modal (wide) + Lead detail (tabs: Timeline, Convert to Deal, Notes, Email History) + **Lead Capture panel** (read-only payload: Source = "Tally Landing Page", submitted timestamp, IP country, confirmation email Delivered/Failed, form data) + **3-step Convert flow** (Confirm Contact → Link/Create Company → Create Deal, progress dots) + disqualify flow (reason dropdown + note) + empty state. Reps see only assigned leads.
**Checkpoint:** kanban + DnD, table, add, detail (4 tabs), capture panel, 3-step convert, disqualify, empty.

---

## Feature 5 — Deals & Pipeline
Kanban with the **7 canonical stages** (New Lead → Contacted → Qualified → Demo/Proposal → Negotiation → Closed-Won → Closed-Lost), horizontal scroll, coloured left borders, per-card probability badge (<30 red / 30–70 amber / >70 green), priority bar. Table view. Add Deal modal (wide): Name (auto-suggest "[Company] – Tally [Edition]"), Primary Contact*, Company, Value* + Currency (GHS/USD/NGN/KES), visual stage selector, probability (auto by stage), expected close date*, Assigned To, Description, Tags. Deal detail (30/70, tabs: Timeline w/ stage milestones, Activities, Proposals, Contacts, Value History). Close flow: **Won → confirm actual value + date → gold/blue confetti**; **Lost → required reason + competitor + note**. Separate Pipeline funnel page (click stage → expand deals; time filter). Empty state.
**Checkpoint:** kanban (7 cols), probability badges, table, add modal w/ stage selector, detail (5 tabs), Won confetti + Lost reason, pipeline funnel page, empty.

---

## Feature 6 — Activities
Table (Title, Type badge [Meeting blue / Call green / Email amber / Task orange], Due Date, Owner, Created, Actions) + filter tabs (All/Calls/Emails/Tasks/Meetings) + slide-over detail panel (400px) + Add Activity modal (Title, Type segmented, Due date+time, Duration, Owner, link Contact, link Deal, Description, Reminder toggle, Outcome) + status lifecycle (Pending → In Progress → Completed w/ outcome) + overdue red row + empty + bulk.
**Checkpoint:** table + badges, filter tabs, slide-over, add modal + reminder, lifecycle, overdue styling, empty.

---

## Feature 7 — Tasks & Reminders
List grouped by date (Recent / Yesterday / dated headers). Row: drag handle, checkbox, star, title (strike when done), type badge, status badge, tags, date, assigned avatar, 3-dot. Left accent bar by status. Add Task modal (Title, Type, Due Date, Assigned To, Status, Tags, Priority radio, link Contact/Deal, Description). Quick-complete (checkbox → strikethrough + toast). Empty state.
**Checkpoint:** grouped list, all row elements, accent bars, add modal, quick-complete, empty.

---

## Feature 8 — Analytics (Admin + Manager)
Period selector. Sections: Pipeline Health (4 KPIs) · Revenue line chart (Target vs Actual) · Conversion Funnel (Leads→Contacted→Qualified→Demo→Proposal→Won w/ drop-off %) · Rep Leaderboard (rank, avatar, leads, closed, revenue, win rate, trend; top rep gold crown) · Lead Source Breakdown bar · Win/Loss donut + top-5 loss reasons. Click rep → individual rep report.
**Checkpoint:** KPIs + period selector, revenue chart, funnel, leaderboard w/ crown, source chart, win/loss, rep report.

---

## Feature 9 — Authentication (MANDATORY 2FA — do not omit)

**9A — Login.** Split layout: left 50% navy hero with animated floating stat cards ("125 leads captured", "23 deals closed this month", "₵48,250 pipeline value") + "Powered by TallyPrime" footer. Right 50% white form (max 400px): blue logo, "Welcome back", email + password (show/hide), Remember me + Forgot password, full-width blue "Sign In" (login is **blue, not red**), divider, "Request Access" ghost.

**9B — 2FA Enrollment (first login — REQUIRED, cannot skip).** After valid password, route here if not enrolled. Two options tabbed: **Authenticator app (TOTP)** — show QR code + copyable secret + OTPInput to verify a first code; **Email OTP** — "Send code" → OTPInput. Until verified, a banner states "Two-factor authentication is required to access the CRM." No skip/close.

**9C — 2FA Verification (every subsequent login).** Centered card: "Enter your authentication code", OTPInput (6 digits, auto-advance), "Verify", resend link (email OTP), "Use a different method", "Back to login". Error state on wrong code.

**9D — Forgot password / Reset.** Email → "Send reset link"; reset screen = new password + confirm + strength meter.

**9E — First-login onboarding wizard (after 2FA).** Steps: 1) profile photo + display name, 2) (Admin only) connect landing-page webhook URL — copyable `POST .../functions/v1/leads-capture` endpoint + API key, 3) invite team. Skip allowed for non-critical steps; 2FA itself is never skippable.

**Checkpoint:** login split + animation, 2FA enrollment (TOTP + email OTP), 2FA verification, forgot/reset, onboarding wizard.

---

## Feature 10 — Settings & Admin (Admin only; Manager/Rep see no Settings nav)
Tabs: General (CRM name, default currency = GHS, timezone, date format, logo) · Pipeline Config (drag-reorder stages, name/colour/**SLA days**, min 3 lock) · **Users & Roles** (table: avatar+name, email, **role dropdown — Admin / Sales Manager / Sales Rep**, status toggle, **2FA status: Enrolled/Pending**, last login, actions; "Invite User" modal = email + role + send invite → invitee must enroll 2FA) · Lead Assignment (Manual / Round-Robin, drag queue) · **Automations** (list of rules from PRD §14 — each row: name, trigger, on/off toggle, editable delay/SLA/probability/target-task/escalation; reset-to-default) · Email & Notifications (Resend/SendGrid + SMTP config, masked keys, Test button; notification toggles) · Loss Reasons (editable, reorder) · Audit Log (actor inc. "System/Automation", action, entity, timestamp, IP; filter; export CSV) · **Landing Page Integration** (prominent): copyable Edge Function endpoint `POST {SUPABASE_URL}/functions/v1/leads-capture`, API key reveal/regenerate, JSON payload schema, "Send test lead" button with live response log, numbered "connect your Lovable landing page" guide, last-test timestamp + status.
**Checkpoint:** all 9 tabs, pipeline DnD + SLA, automations toggles/edit, invite flow (with 2FA-pending state), email config + test, landing-page panel, audit log + export.

---

## 3. Brand & quality requirements
Tally moments: sidebar "Powered by TallyPrime", login hero stats, Closed-Won gold/blue confetti, dashboard greeting tying to TallyPrime.com. Mobile: sidebar → bottom tab bar (Home, Leads, Deals, Activities, More); cards 1-col; kanban horizontal-scroll with stage tabs; modals full-screen slide-up. Performance perception: skeletons not spinners, optimistic Kanban with revert-on-fail, lazy avatars, virtualized long tables.

## 4. Build order
`0 Components → 1 Dashboard → 2 Contacts → 3 Companies → 4 Leads → 5 Deals/Pipeline → 6 Activities → 7 Tasks → 8 Analytics → 9 Auth (with mandatory 2FA) → 10 Settings`. Finish each feature's every state before advancing. Session recovery: resume from the last incomplete checkpoint; reuse Feature 0 components; never rebuild prior features.

*End of design.md · v2.0*
