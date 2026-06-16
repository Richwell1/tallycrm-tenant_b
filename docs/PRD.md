# Simple CRM — Product Requirements Document

**Ref:** ASM-CRM-001 · **Version:** 2.0 · **Status:** Draft · **Currency default:** GHS
**Product:** Simple CRM + Tally Landing Page · **Owner:** The Architect
**Backend standard:** Supabase (Postgres · Auth · Row Level Security · Edge Functions)
**Auth standard:** Email/password **+ mandatory 2FA/MFA for every CRM user**

---

## 1. Purpose & Scope

Simple CRM is a lightweight, purpose-built Customer Relationship Management application designed to capture inbound interest in **Tally** accounting software and guide each prospect from first contact to a finalised deal. The system has two integrated parts:

- A public **Landing Page** (built in Lovable) marketing Tally and hosting a lead-capture form. No login required.
- A private **CRM web application** (built in Lovable, hardened in Claude Code) where the sales team manages leads, contacts, companies, deals, activities, tasks, and pipeline reporting. Every route is protected and requires an authenticated, MFA-verified session.

The MVP delivers a complete end-to-end flow: a visitor submits the landing-page form → the lead is written into Supabase by an Edge Function → a confirmation email is sent → the lead surfaces on the CRM dashboard in seconds → it is qualified, converted to a deal, progressed through the pipeline, and closed Won or Lost.

**Out of scope (v1):** payment processing, Tally licence provisioning, in-app user-to-user messaging, native mobile apps, multi-product catalogue.

---

## 2. Toolchain & Workflow

| Tool                  | Role                                                                                                | Integration point                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Lovable**           | Rapid build of landing page + CRM front-end and initial Supabase wiring                             | Syncs source to GitHub on publish; hosts the public landing page URL |
| **Supabase**          | Backend of record — Postgres database, Auth (with MFA), Row Level Security, Edge Functions, storage | All data, auth, and server logic live here                           |
| **GitHub**            | Version control and single source of truth                                                          | Lovable pushes here; Claude Code pulls and pushes                    |
| **Claude Code**       | Agentic refactor / test / harden / extend                                                           | Clones repo, improves code, runs tests, pushes reviewed PRs          |
| **Resend / SendGrid** | Transactional email (confirmation + internal notify)                                                | Called only from the Supabase Edge Function — never from the browser |

**Deployment chain:** Lovable (build) → GitHub (push) → Claude Code (refactor/test/extend) → GitHub (final) → Production hosting.

---

## 3. Glossary of Terms

| Term                   | Definition                                                                                                                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Simple CRM**         | The web application being built — a lightweight CRM tailored for Tally software sales and follow-up.                                                                                           |
| **Tally**              | A popular accounting & ERP product. The CRM exists to capture, nurture, and close leads interested in Tally.                                                                                   |
| **Landing Page**       | Public marketing page (Lovable) presenting Tally's value proposition; contains the lead-capture form; no login.                                                                                |
| **Lead**               | A prospect who submitted the landing-page form (or was entered manually). Has expressed interest but is not yet qualified. Tagged `source = "Tally Landing Page"` when captured from the form. |
| **Contact**            | A person record inside the CRM. Each lead becomes or links to a Contact. Stores name, email, phone, title, company.                                                                            |
| **Company**            | An organisation record. Many Contacts belong to one Company. Full CRUD.                                                                                                                        |
| **Deal**               | A sales opportunity linked to a Contact (and optionally a Company). Tracks stage, value, currency, and expected close date.                                                                    |
| **Pipeline**           | The ordered set of Deal stages from first contact to Closed-Won/Lost, visualised as a Kanban board.                                                                                            |
| **Lead Capture Flow**  | The automated sequence on form submit: data → Edge Function → DB insert → confirmation email → dashboard appearance.                                                                           |
| **Confirmation Email** | Automated email to the lead immediately after a successful save, confirming receipt and next steps.                                                                                            |
| **Activity / Note**    | A timestamped record of an action or communication logged against a Contact and/or Deal (call, email, meeting, demo, proposal, note).                                                          |
| **Task / Reminder**    | A simple to-do with a due date, optionally linked to a Contact or Deal, with an optional reminder alert.                                                                                       |
| **Dashboard**          | CRM home screen surfacing key metrics: new leads, open deals, pipeline value, recent activity, conversion KPIs.                                                                                |
| **Lead-to-Deal**       | The action of converting a qualified Lead into a Deal, creating or linking the associated Contact and Company.                                                                                 |
| **Closed-Won**         | Deal stage: the sale completed and the customer committed to purchasing Tally.                                                                                                                 |
| **Closed-Lost**        | Deal stage: the opportunity did not convert; reason-for-loss is recorded for analytics.                                                                                                        |
| **Role**               | A permission level (Admin, Sales Manager, Sales Rep) controlling which screens, actions, and records a user may access.                                                                        |
| **Admin**              | CRM role with unrestricted access — manages users, settings, all data, all CRUD.                                                                                                               |
| **Sales Manager**      | Non-admin role; works **all** CRM records but cannot manage users or system settings.                                                                                                          |
| **Sales Rep**          | Non-admin role; works **own/assigned** records only; cannot delete records or access admin areas.                                                                                              |
| **RLS**                | Row Level Security — Supabase Postgres policies that enforce per-role/per-owner data access at the database layer.                                                                             |
| **MFA / 2FA**          | Multi-factor / two-factor authentication. Mandatory second sign-in factor (TOTP authenticator app, or email OTP) for every CRM user.                                                           |
| **Edge Function**      | A Supabase serverless function holding secrets and performing privileged server logic (form insert + email send).                                                                              |
| **CRUD**               | Create, Read, Update, Delete — the four data operations on CRM entities.                                                                                                                       |
| **Kanban Board**       | Visual board where Deal cards sit in stage columns and can be dragged between stages.                                                                                                          |

---

## 4. User Roles, Permissions & 2FA

The CRM implements role-based access control (RBAC) enforced **server-side via Supabase Row Level Security**, never by UI hiding alone. The system ships with **three seeded users: one Admin and two non-admins (one Sales Manager, one Sales Rep)**. Every user must complete 2FA to sign in.

### 4.1 Roles

- **Admin (1)** — full access; manages users, settings, and all records.
- **Sales Manager (non-admin)** — works all CRM records but cannot manage users or system settings.
- **Sales Rep (non-admin)** — works their own/assigned records; limited visibility; no delete and no admin rights.

### 4.2 Permissions Matrix

| Capability                          | Admin | Sales Manager |      Sales Rep      |
| ----------------------------------- | :---: | :-----------: | :-----------------: |
| View all contacts, deals, companies |  Yes  |      Yes      | Own + assigned only |
| Create / edit records               |  Yes  |      Yes      |      Yes (own)      |
| Delete records                      |  Yes  |      Yes      |         No          |
| View leads from landing page        |  Yes  |      Yes      |    Assigned only    |
| Manage users & roles                |  Yes  |      No       |         No          |
| System / app settings               |  Yes  |      No       |         No          |
| View dashboard & reports            |  Yes  |      Yes      |      Own data       |

_(A read-only Viewer role is reserved for a future version and is not active in v1.)_

### 4.3 Two-Factor Authentication (mandatory)

- 2FA is **required for every CRM user**. Supported factors: **TOTP** via an authenticator app (Google Authenticator, Authy) or **email OTP**, both supported by Supabase MFA.
- **Enrollment is enforced on first login** and verification is required on every subsequent login. Until a user is enrolled and verified, **all CRM data access is blocked**.
- Permissions and data scoping are enforced **server-side with Row Level Security** — not just hidden in the UI.
- Admin can revoke any user session immediately. Sessions expire after 8 hours of inactivity.
- Password reset is via an emailed magic link / reset link (no security questions).

### 4.4 Authentication Flow (detailed)

1. User opens the CRM → unauthenticated requests redirect to `/login`.
2. User submits email + password (Supabase Auth, bcrypt-hashed).
3. On valid credentials, the server checks MFA status:
   - **Not enrolled** → redirect to the **2FA enrollment wizard** (show QR/secret for TOTP or trigger email OTP) → user verifies a first code → factor is registered.
   - **Enrolled** → prompt for the current 2FA code.
4. On successful 2FA verification, an MFA-elevated session (AAL2) is issued. RLS policies key off the verified session and the user's role.
5. The landing page remains fully public; only write-only lead inserts flow through the Edge Function, which uses a service role and never exposes secrets to the browser.

---

## 5. Use Cases

| ID    | Actor               | Goal                     | Trigger                         | Expected outcome                                                           |
| ----- | ------------------- | ------------------------ | ------------------------------- | -------------------------------------------------------------------------- |
| UC-01 | Visitor / Prospect  | Submit interest in Tally | Visits landing page, fills form | Lead created in CRM; confirmation email sent                               |
| UC-02 | CRM System          | Auto-capture lead        | Form submitted                  | Contact + Lead appear on dashboard within seconds                          |
| UC-03 | Sales Rep / Manager | View new leads           | Login after submission          | Dashboard shows new lead; user opens and reviews it                        |
| UC-04 | Sales Rep / Manager | Qualify a lead           | Lead in pipeline                | Stage moved to Contacted/Qualified, or disqualified with reason            |
| UC-05 | Sales Rep / Manager | Convert lead to deal     | Lead qualified                  | Deal created, linked to Contact + Company                                  |
| UC-06 | Sales Rep / Manager | Progress deal            | Deal created                    | Card dragged across Kanban stages; each move logged                        |
| UC-07 | Sales Rep / Manager | Log activity / note      | Any interaction                 | Timestamped note saved on Contact and Deal                                 |
| UC-08 | Sales Rep / Manager | Close a deal             | Negotiation complete            | Deal marked Won or Lost; reason captured for Lost                          |
| UC-09 | Admin               | Create / manage users    | New team member                 | Admin creates user, assigns role; user receives invite and must enroll 2FA |
| UC-10 | Admin               | Configure pipeline       | Process change                  | Admin edits stage names, order, SLA thresholds                             |
| UC-11 | Admin / Manager     | View reports             | Period review                   | Conversion rates, pipeline value, rep performance shown                    |
| UC-12 | Admin / Manager     | Manage companies         | New org identified              | Company created; Contacts and Deals linked                                 |
| UC-13 | Any CRM user        | Manage tasks/reminders   | Follow-up needed                | Task created with due date, linked to contact/deal; reminder fires         |
| UC-14 | Any CRM user        | Enroll & pass 2FA        | First/subsequent login          | MFA factor registered/verified before any data access                      |

---

## 6. End-to-End Lead Lifecycle Flow

### 6.1 Phase 1 — Lead Emergence (Landing Page → CRM)

1. **Visitor arrives** on the public Tally landing page (Lovable-hosted). Sees value prop, features, pricing teaser, social proof, and a prominent form.
2. **Form submission** — fields: First Name*, Last Name*, Email*, Phone, Company Name, Message (*required). Client-side validation runs (required fields, email/phone format). On valid submit, data is POSTed over HTTPS to a **Supabase Edge Function** (not directly to the browser-side client).
3. **Lead record creation (automated)** — the Edge Function validates server-side, runs a **deduplication check** (existing Contact by email → link new Lead rather than duplicate Contact), then inserts a Lead with `status = New Lead`, timestamp, and `source = "Tally Landing Page"`. Lead is auto-assigned by round-robin (or left unassigned per Admin config). A system Activity entry is logged.
4. **Confirmation email** — only after a successful save, the Edge Function calls Resend/SendGrid to email the submitter: personalised greeting, acknowledgement of interest, expected response time. Delivery status (sent/failed) is logged against the Lead. Optionally an internal sales inbox is notified.
5. **Dashboard appearance** — within seconds, the new lead surfaces on the dashboard and the New Lead Kanban column; the "New Leads" widget increments.

### 6.2 Phase 2 — Lead Qualification

6. **Rep reviews lead** — in-app (and optional email) notification. Opens lead detail: form data, metadata (source, timestamp, IP country), email delivery status. Adds initial note.
7. **First outreach (Contacted)** — rep calls/emails/messages, logs an Activity, moves the lead New Lead → Contacted. Stage change is timestamped in the audit log.
8. **Qualification (BANT)** — rep assesses Budget, Authority, Need, Timeline. Sets `qualified = true/false`. If disqualified: status `Disqualified`, reason logged, record archived (not deleted). If qualified: proceed.

### 6.3 Phase 3 — Lead-to-Deal Conversion

9. **Convert** — rep clicks Convert Lead; system prompts to confirm/create the Contact (pre-filled), Company (link or create, recommended), and Deal (name, value + currency, expected close date, stage defaults to Qualified). All three records are created/linked atomically. The Lead is marked Converted and linked to the Deal. Dashboard updates (lead count down, open deal count up).

### 6.4 Phase 4 — Pipeline Progression

10. **Demo / Proposal** — rep conducts a Tally demo and/or sends a proposal (logged as Activities); card moved to Demo / Proposal.
11. **Negotiation** — touchpoints logged; deal value updated if pricing changes; **all value changes are version-tracked, never overwritten**; card moved to Negotiation.

### 6.5 Phase 5 — Finalisation

12. **Close Won** — rep sets stage Closed-Won; system prompts for actual value and close date; Activity logged; Closed-Won KPIs update; optional congrats notification to Admin.
13. **Close Lost** — from any stage after Qualified; rep selects a required Reason for Loss (configurable: Price too high, Chose competitor, No budget, Timing, Unresponsive); deal archived; Contact remains active; reason feeds win/loss analytics.

### 6.6 Phase 6 — Post-Deal / Maintenance

- Closed-Won contacts remain as active customers. Reps/Admin create follow-up tasks (renewal, upsell). New Deals can be opened on existing Contacts/Companies without a new form submission. Closed-Lost contacts can be re-engaged.

---

## 7. Component & Entity Relationships

| Parent         | Child / related    | Relationship rule                                                                                    |
| -------------- | ------------------ | ---------------------------------------------------------------------------------------------------- |
| Landing Page   | Lead               | 1 submission → 1 Lead. Landing page is external; calls the Edge Function on submit.                  |
| Lead           | Contact            | 1 Lead → exactly 1 Contact. A Contact can originate from multiple Leads over time (dedupe required). |
| Contact        | Company            | Many Contacts → 1 Company (a Contact may start with no Company).                                     |
| Contact        | Deal               | 1 Contact → many Deals; each Deal must have ≥1 primary Contact.                                      |
| Company        | Deal               | 1 Company → many Deals; link optional but recommended.                                               |
| Deal           | Pipeline Stage     | A Deal occupies exactly 1 stage; stage changes are append-only logged.                               |
| Contact / Deal | Activity / Note    | Polymorphic: attached to a Contact and/or Deal; immutable after a 15-minute grace window.            |
| Contact / Deal | Task               | A Task optionally links to a Contact and/or Deal; has a due date and owner.                          |
| CRM User       | Lead / Deal / Task | Ownership: each has an assigned user. Admin/Manager can reassign.                                    |

**Entity hierarchy (independent → dependent):** Company → Contact → Lead → Deal → Activity/Note & Task; Pipeline Stage is a configuration entity referenced by Deals and managed by Admin.

---

## 8. Pipeline Stages

Seven default stages. Admin may rename/reorder from Settings but cannot drop below three (entry, one mid-stage, ≥1 close stage).

| #   | Stage           | Definition                           | Exit criteria                              |
| --- | --------------- | ------------------------------------ | ------------------------------------------ |
| 1   | New Lead        | Form submitted; no human contact yet | Rep acknowledges/assigns                   |
| 2   | Contacted       | First outreach logged                | Lead responds or next touchpoint scheduled |
| 3   | Qualified       | BANT assessed; lead viable           | Converted to Deal; Company linked          |
| 4   | Demo / Proposal | Demo conducted or proposal sent      | Prospect requests pricing / counters       |
| 5   | Negotiation     | Terms/pricing being negotiated       | Both parties agree                         |
| 6   | Closed-Won      | Sale completed                       | PO / contract / payment received           |
| 7   | Closed-Lost     | Did not convert                      | Reason captured; deal archived             |

---

## 9. Functional Requirements

### 9.1 Landing Page

- FR-LP-01 Display Tally value prop, features, pricing teaser, social proof.
- FR-LP-02 Lead-capture form: First Name*, Last Name*, Email\*, Phone, Company, Message.
- FR-LP-03 Client-side validation (required, email/phone format).
- FR-LP-04 On submit, POST over HTTPS to the Supabase Edge Function.
- FR-LP-05 Show a thank-you confirmation state on success.
- FR-LP-06 Graceful error state if the backend is unreachable.
- FR-LP-07 Fully responsive; loads under 3 s on 4G.
- FR-LP-08 Public; no login.

### 9.2 Lead Capture & Management

- FR-LC-01 Edge Function inserts a Lead within 500 ms (p95).
- FR-LC-02 Deduplicate by email — link, don't duplicate.
- FR-LC-03 Auto-assign by round-robin or leave unassigned per Admin config.
- FR-LC-04 Trigger confirmation email only after a successful insert.
- FR-LC-05 Dashboard reflects new leads within 10 s.
- FR-LC-06 Lead list: searchable, filterable (status, assignee, date), sortable.
- FR-LC-07 Lead detail: form data, metadata, assignee, stage, activities, conversion status, email delivery status.
- FR-LC-08 Manual lead creation inside the CRM (walk-in / cold call).
- FR-LC-09 Spam/bot protection on the form (honeypot or captcha) — hardened in Claude Code phase.

### 9.3 Contacts

- FR-CO-01 Full CRUD (Admin/Manager all; Rep own/assigned).
- FR-CO-02 Fields: First/Last Name, Email (unique), Phone, Job Title, Company, Source, Created Date, Assigned Rep, Tags.
- FR-CO-03 Detail shows linked Deals, Activities, Lead origin.
- FR-CO-04 Full-text search on name, email, company.
- FR-CO-05 Admin can merge duplicate Contacts.

### 9.4 Companies

- FR-CM-01 Full CRUD.
- FR-CM-02 Fields: Name (unique), Industry, Address, Website, Phone, LinkedIn URL, Notes.
- FR-CM-03 Detail shows linked Contacts and Deals.
- FR-CM-04 Search by name and industry.

### 9.5 Deals & Pipeline

- FR-DE-01 Full CRUD.
- FR-DE-02 Fields: Name, Primary Contact (required), Company (optional), Value + Currency, Stage, Expected Close Date, Assigned Rep, Description, Tags.
- FR-DE-03 Kanban view: one column per stage; cards show name, value, contact, days-in-stage.
- FR-DE-04 Drag-and-drop between stages; each move logged to audit trail.
- FR-DE-05 Detail: all fields, activities, stage history, value-change history.
- FR-DE-06 Closing prompts for actual close date and final value.
- FR-DE-07 Closing Lost requires a reason.
- FR-DE-08 List view with filters (stage, rep, date, value range).

### 9.6 Activities & Notes

- FR-AN-01 Log against Contact and/or Deal: type, date/time, duration, outcome, notes.
- FR-AN-02 Reverse-chron timeline on Contact and Deal detail.
- FR-AN-03 Immutable after a 15-minute grace edit window.
- FR-AN-04 Optional follow-up reminder per activity.

### 9.7 Tasks & Reminders (light extra)

- FR-TK-01 CRUD for tasks: title, type, due date, status, priority, owner.
- FR-TK-02 Optional link to a Contact and/or Deal.
- FR-TK-03 Optional reminder alert (date/time).
- FR-TK-04 Quick-complete with status toggle.

### 9.8 Dashboard

- FR-DB-01 KPI cards: New Leads (today/week), Open Deals (count + value), Closed-Won (month count + value), Conversion Rate.
- FR-DB-02 Recent activity feed (last 10 visible events).
- FR-DB-03 Pipeline funnel (count + value per stage).
- FR-DB-04 Tasks/reminders widget for the logged-in user.
- FR-DB-05 Admin/Manager dashboards add per-rep performance, total pipeline value, lead-source breakdown.

### 9.9 Users, Auth & Settings

- FR-US-01 Admin can create, edit, deactivate, delete users.
- FR-US-02 Admin can assign/change roles.
- FR-US-03 Admin can configure pipeline stages (name, order, SLA).
- FR-US-04 Admin can configure lead-assignment rules.
- FR-US-05 Admin can configure reason-for-loss options.
- FR-US-06 Admin can view the full audit log.
- FR-AU-01 Email/password auth via Supabase Auth.
- FR-AU-02 **Mandatory 2FA** (TOTP or email OTP); enrollment enforced on first login; data blocked until enrolled.
- FR-AU-03 RLS enforces role + ownership scoping at the database layer.
- FR-AU-04 Public, write-only lead inserts via the Edge Function; landing page cannot read CRM data.
- FR-AU-05 Session expiry after 8 h inactivity; Admin can revoke sessions.

---

## 10. Non-Functional Requirements

| Category       | Requirement               | Target                                                                                  |
| -------------- | ------------------------- | --------------------------------------------------------------------------------------- |
| Performance    | Lead capture API response | < 500 ms (p95)                                                                          |
| Performance    | Dashboard load            | < 2 s on broadband                                                                      |
| Reliability    | Uptime                    | 99.5% monthly (excl. planned maintenance)                                               |
| Security       | Auth                      | Supabase Auth + mandatory MFA; HTTPS everywhere; CSRF protection                        |
| Security       | Role enforcement          | Server-side via RLS; no client-only guards                                              |
| Security       | Secrets                   | Email/provider keys only in Edge Functions; never in the browser; none committed to Git |
| Scalability    | Concurrent users          | 50 simultaneous CRM users (MVP)                                                         |
| Usability      | Responsiveness            | Dashboard + Kanban usable on tablet (768 px+)                                           |
| Data integrity | Dedupe                    | Email-based dedupe on capture; flag rather than silently drop                           |
| Audit          | Logging                   | Stage changes, edits, logins → audit log with timestamp + actor                         |

---

## 11. Technical Architecture

| Layer           | Technology                                               |
| --------------- | -------------------------------------------------------- |
| Framework       | React + Vite (Lovable default)                           |
| Styling         | Tailwind CSS + shadcn/ui                                 |
| Backend / DB    | **Supabase** (Postgres, Auth, Row Level Security)        |
| Auth & access   | Supabase Auth with **MFA/2FA (TOTP / email OTP)** + RBAC |
| Server logic    | Supabase **Edge Function** (form submit + email)         |
| Email           | Resend (or SendGrid) for confirmation + internal notify  |
| State / data    | TanStack Query (or Supabase client hooks)                |
| Version control | GitHub (via Lovable GitHub sync)                         |
| AI tooling      | Claude Code (refactor, tests, enhancements)              |

**Suggested data model (tables):** `users` (profiles + role), `companies`, `contacts`, `leads`, `deals`, `activities`, `tasks`, plus supporting `deal_stage_history`, `deal_value_history`, `audit_log`, `pipeline_stages`, `loss_reasons`.

**API & data principles:** RESTful/Supabase-client access with consistent error shape `{ error, code }`; the lead-capture Edge Function is public and write-only; all other access requires a valid MFA-elevated session; pagination on list queries; soft deletes (`deleted_at`) preferred to preserve audit integrity. **RLS enforces that the landing page can insert leads but cannot read CRM data, and that each role is scoped per the permissions matrix.**

---

## 12. Open Questions & Assumptions

**Assumptions:** Landing page built in Lovable first; CRM hardened in Claude Code. Single Tally product in v1. Currency defaults to GHS (Admin-configurable). Confirmation email copy finalised by Product before dev. No Tally licensing-API integration in v1.

**Open questions:** OQ-01 capture UTM parameters? · OQ-02 native mobile app vs responsive web? · OQ-03 Closed-Won → licence provisioning webhook or manual? · OQ-04 fallback assignment if all reps at capacity? · OQ-05 — _resolved: 2FA is now mandatory for all users, not just Admin._

---

## 13. MVP Acceptance Criteria

1. A visitor submits the landing-page form → a Lead (`source = "Tally Landing Page"`) appears on the dashboard within 10 s.
2. A confirmation email reaches the submitter within 60 s of a successful save.
3. Three seeded users exist (Admin + Sales Manager + Sales Rep) with correct permissions per the matrix.
4. **2FA is enforced for every user**; no user can reach CRM data without completing enrollment + verification.
5. A user can log in, view a new lead, add a note, and change its stage.
6. A user can convert a lead to a deal, creating linked Contact and Company in one flow.
7. A deal moves through all pipeline stages on the Kanban with each change logged.
8. A deal can be closed Won or Lost; Lost requires a reason code.
9. Permissions are enforced server-side (RLS): a Sales Rep cannot see or delete others' records (403/empty).
10. Light extras work: tasks/reminders, dashboard metrics, search/filter.
11. The app builds and runs from a clean GitHub clone via the README; CI passes; no secrets committed.
12. Final code merged to `main` via reviewed PRs.

---

## 14. Automation & Workflow Engine

The CRM includes a rule-driven automation engine so that routine follow-up work is created automatically as leads and deals move through the pipeline. The intent: a rep should never have to remember "what's next" — the system creates the task, sets the reminder, updates probability, and escalates when something stalls.

### 14.1 Automation model

Every automation is a rule of the form **Trigger → Conditions → Actions**.

- **Trigger types:** `record_created`, `stage_changed`, `lead_converted`, `activity_logged`, `time_elapsed` (SLA / idle), `task_due_soon`, `email_failed`, `value_changed`, `deal_closed`.
- **Condition examples:** role/owner, source = "Tally Landing Page", current stage, days in stage, value threshold, qualified flag.
- **Action types:** `create_task`, `create_reminder`, `send_notification` (in-app/email), `send_email`, `set_field` (e.g. probability), `assign` / `reassign`, `add_tag`, `mark_overdue` / `mark_stale`, `escalate_to_manager`, `archive`, `log_audit`.

Rules are seeded with sensible defaults (below) and are **Admin-configurable** in Settings (timings, on/off, which task is created). Synchronous rules (e.g. a stage change creating a task) run via Postgres triggers; time-based rules (SLA, stale, digests) run on a schedule; email actions run in Edge Functions.

### 14.2 Auto-task & automation matrix (default rules)

| Trigger                               | Conditions                           | Automatic actions                                                                                                                                                             |
| ------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Lead captured** (New Lead)          | source = Tally Landing Page          | Round-robin assign · send confirmation email · create task **"Make first contact"** due +4h to assignee · notify assigned rep · log audit                                     |
| **New Lead idle**                     | not Contacted within 24h             | Mark lead overdue · notify rep **and** Sales Manager · escalate                                                                                                               |
| **Lead → Contacted**                  | —                                    | Clear first-contact SLA · create task **"Qualify lead (BANT) — schedule call"** due +2d                                                                                       |
| **Lead → Qualified**                  | —                                    | Create task **"Prepare demo / convert to deal"** due +1d · surface convert prompt                                                                                             |
| **Lead disqualified**                 | reason set                           | Archive (not delete) · log reason · optionally create **re-engagement** task due +90d                                                                                         |
| **Lead → Deal** (conversion)          | —                                    | Create linked Contact+Company+Deal · deal stage = Qualified · set probability default · create task **"Schedule Tally demo"** due +2d                                         |
| **Deal → Demo / Proposal**            | —                                    | Create task **"Send proposal document"** due +1d · create reminder **"Follow up on proposal"** +3d · set probability default (e.g. 50%)                                       |
| **Deal → Negotiation**                | —                                    | Create task **"Follow up on negotiation terms"** due +2d · set probability default (e.g. 75%)                                                                                 |
| **Deal idle in stage**                | days-in-stage > stage SLA            | Mark deal **stale** · notify owner + Manager · create nudge task                                                                                                              |
| **Deal → Closed-Won**                 | —                                    | Confetti · prompt actual value + close date · set probability 100% · create tasks **"Send welcome & next steps"** +1d and **"Renewal check-in"** +11mo · notify Admin/Manager |
| **Deal → Closed-Lost**                | reason required                      | Set probability 0% · archive · create **re-engagement** task +90d · feed win/loss analytics                                                                                   |
| **Activity logged without next step** | call/meeting completed, no open task | Prompt / auto-suggest a follow-up task                                                                                                                                        |
| **Confirmation email failed**         | email_status = failed                | Create task **"Manually contact lead — email failed"** to assignee · alert                                                                                                    |
| **Task due soon**                     | reminder window reached              | In-app (and optional email) reminder · include in morning digest                                                                                                              |
| **Deal value changed**                | in Negotiation, drop > threshold     | Version-track change · optionally notify Manager                                                                                                                              |

_Probability defaults and all timings (+4h, +2d, SLA days, etc.) are configurable per stage by Admin; the values above are seed defaults._

### 14.3 Scheduled (time-based) automations

- **SLA monitor** — hourly job flags leads/deals exceeding their stage SLA → overdue/stale + escalation.
- **Reminder dispatch** — fires task reminders at their due window.
- **Daily digest** — morning email/in-app summary to each user: today's tasks, overdue items, new assigned leads.
- **Re-engagement sweep** — surfaces disqualified leads / Closed-Lost deals past their cooldown for a fresh outreach task.

### 14.4 Automation functional requirements

- FR-AUT-01 Stage changes on leads/deals trigger their configured automatic task(s) atomically with the stage write and the stage-history log.
- FR-AUT-02 Auto-created tasks are assigned to the record's owner, carry a due date, and appear in that user's task list and dashboard.
- FR-AUT-03 SLA breaches mark records overdue/stale and notify the owner and their Manager.
- FR-AUT-04 Deal probability auto-updates to the stage default on stage change (rep may override).
- FR-AUT-05 Closed-Won and Closed-Lost trigger their respective follow-up/re-engagement tasks and notifications.
- FR-AUT-06 A failed confirmation email creates a manual-outreach task for the assignee.
- FR-AUT-07 Admin can enable/disable each rule and edit its timings, target task, and thresholds in Settings → Automations.
- FR-AUT-08 Every automated action is written to the audit log (actor = "System / Automation").
- FR-AUT-09 Reminders and a daily digest are delivered per user for upcoming and overdue tasks.

### 14.5 Glossary additions

- **Automation Rule** — a Trigger → Conditions → Actions definition that runs automatically.
- **SLA (stage)** — the maximum days a record should sit in a stage before it is flagged overdue/stale.
- **Stale Deal** — a deal with no activity / exceeding stage SLA, flagged for attention.
- **Escalation** — automatic notification to the owner's Sales Manager when an SLA is breached.
- **Auto-Task** — a task created automatically by the engine, owned by the record's assignee.

### 14.6 Technical implementation notes

- **Synchronous rules** (stage change → task + history + probability) via Postgres triggers / functions, so they are transactional with the record write.
- **Scheduled rules** (SLA, stale, digest, re-engagement) via Supabase **pg_cron** invoking SQL functions or an Edge Function.
- **Email/notification actions** via Edge Functions (Resend) — secrets server-side only.
- **Config:** an `automation_rules` table holds enabled/timing/threshold settings; the engine reads it so behaviour is data-driven, not hardcoded.

---

_End of PRD v2.0 · Ref ASM-CRM-001_
