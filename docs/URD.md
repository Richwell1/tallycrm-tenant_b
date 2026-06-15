# Simple CRM — User Requirements Document (URD)

**Ref:** ASM-CRM-001 · **Version:** 2.0 · Companion to PRD v2.0

This URD describes the system from each user's perspective: who they are, what they need, the journeys they perform, and the requirements that must be true for them. Four user types are covered: the public **Visitor/Prospect**, and three authenticated CRM roles — **Admin**, **Sales Manager**, **Sales Rep**. All three CRM roles must complete **mandatory 2FA** before any data access; all access is scoped server-side via Supabase Row Level Security.

---

## U0. Visitor / Prospect (public — no account)

**Profile:** A business owner or decision-maker researching Tally accounting software. Arrives via search, ad, or referral. Not a CRM user; never logs in.

**Goals**
- Understand quickly whether Tally fits their business.
- Express interest with minimal friction.
- Receive reassurance that someone will follow up.

**Needs / Requirements**
- UR-V-01 A fast, responsive landing page (< 3 s on 4G) with clear value prop, features, pricing teaser, social proof.
- UR-V-02 A short, obvious contact form: First Name*, Last Name*, Email*, Phone, Company, Message.
- UR-V-03 Inline validation that explains errors before submitting.
- UR-V-04 A clear thank-you state on success and a friendly error state on failure.
- UR-V-05 A confirmation email within ~60 s acknowledging interest and setting response expectations.
- UR-V-06 No login, no account creation, no data exposed beyond what they typed.

**Journey:** Land → read → fill form → submit → see thank-you → receive confirmation email.

**Success:** Submission reliably creates a lead in the CRM and the prospect feels acknowledged.

---

## U1. Admin

**Profile:** System owner / sales operations lead. Configures the CRM, manages the team, and has unrestricted access to all data and settings.

**Goals**
- Stand up and govern the CRM: users, roles, pipeline, settings.
- See the whole business: every lead, deal, and rep's performance.
- Keep the system secure and auditable.

**Needs / Requirements**
- UR-A-01 Create, edit, deactivate, and delete CRM users; assign and change roles.
- UR-A-02 Enforce mandatory 2FA enrollment for every user; revoke sessions when needed.
- UR-A-03 Full CRUD on all entities (contacts, companies, deals, leads, activities, tasks).
- UR-A-04 Configure pipeline stages (name, order, SLA) — never fewer than three.
- UR-A-05 Configure lead-assignment rules (round-robin / manual).
- UR-A-06 Configure reason-for-loss options.
- UR-A-07 View the full audit log (actor, action, entity, timestamp) and export it.
- UR-A-08 View all dashboards and reports, including per-rep performance and lead-source breakdown.
- UR-A-09 Manage the landing-page integration (endpoint, key, test webhook) and email/SMTP/Resend config.
- UR-A-10 Merge duplicate contacts.

**Journey (setup):** Log in → enroll 2FA → seed/invite users → configure pipeline, loss reasons, assignment → connect landing page → verify a test lead lands and emails send.
**Journey (operate):** Log in → review org-wide dashboard → reassign/triage leads → audit activity → run period reports.

**Permissions:** Everything (per the matrix). No restrictions.

**Success:** The team can work safely within correct guardrails; the Admin can answer "what's our pipeline and who's performing?" at a glance.

---

## U2. Sales Manager (non-admin)

**Profile:** Leads the sales team day-to-day. Works the full book of business but does not own system administration.

**Goals**
- See and act on **all** leads, contacts, companies, and deals.
- Coach the team and rebalance workload.
- Track team performance and forecast.

**Needs / Requirements**
- UR-M-01 View all contacts, deals, and companies (not limited to own records).
- UR-M-02 Create, edit, and **delete** records.
- UR-M-03 View all landing-page leads and reassign them between reps.
- UR-M-04 Convert leads to deals; progress deals across the Kanban; log activities; close Won/Lost.
- UR-M-05 View dashboards and reports across the whole team.
- UR-M-06 Create and assign tasks/reminders to self or reps.
- UR-M-07 Complete mandatory 2FA before any access.

**Explicitly cannot:** manage users/roles; change system or app settings.

**Journey:** Log in → 2FA → team dashboard → triage unassigned/new leads → reassign → review at-risk deals (overdue, stalled) → coach via notes/tasks → report on the period.

**Permissions:** All-record view + create/edit/delete; no user management; no settings.

**Success:** Can run the team's pipeline end-to-end without touching admin configuration.

---

## U3. Sales Rep (non-admin)

**Profile:** Front-line seller who works their own assigned leads and deals.

**Goals**
- Quickly find their assigned leads and act fast.
- Move deals forward and log every touchpoint.
- Stay on top of follow-ups and not miss tasks.

**Needs / Requirements**
- UR-R-01 View only **own + assigned** contacts, deals, companies, and leads.
- UR-R-02 Create and edit own records; **cannot delete** records.
- UR-R-03 See only landing-page leads assigned to them.
- UR-R-04 Move their deals through stages; log activities; convert leads; close Won/Lost on own deals.
- UR-R-05 Create tasks/reminders for themselves linked to contacts/deals.
- UR-R-06 View a dashboard scoped to **their own data** only.
- UR-R-07 Complete mandatory 2FA before any access.

**Explicitly cannot:** view others' records; delete records; manage users; change settings; access org-wide reports.

**Journey:** Log in → 2FA → personal dashboard (my new leads, my open deals, my overdue tasks) → open a new lead → log first call → move to Contacted → qualify → convert → progress deal → close.

**Permissions:** Own/assigned scope only; create/edit (no delete); own-data dashboard.

**Success:** A focused, uncluttered workspace showing exactly the rep's own work, enforced by RLS so they never see another rep's data (attempts return 403/empty).

---

## Cross-cutting user requirements (all CRM roles)

- UR-X-01 Mandatory 2FA: enrollment on first login, verification on every login; no data until verified.
- UR-X-02 Clear empty, loading, and error states on every screen.
- UR-X-03 Fast feedback (toasts, optimistic Kanban moves with revert-on-failure).
- UR-X-04 Search, filter, and sort on all list views within the user's permitted scope.
- UR-X-05 Responsive layout usable on tablet (768 px+).
- UR-X-06 Every destructive action (for those allowed) requires confirmation.
- UR-X-07 Activity/notes immutable after a 15-minute grace window, preserving an honest record.

---

## Automation requirements by role

The automation engine (PRD §14) creates follow-up work and escalations automatically so users act faster and miss nothing.

**Sales Rep**
- UR-R-AUT-01 When a lead is assigned to me, a **"Make first contact"** task is auto-created (due +4h) and I'm notified.
- UR-R-AUT-02 When I move a lead/deal to the next stage, the relevant follow-up task is created for me automatically (qualify → demo → proposal → negotiation), with probability auto-set.
- UR-R-AUT-03 I get reminders for due/overdue tasks and a morning digest of my day.
- UR-R-AUT-04 On Closed-Won I get welcome + renewal-check-in tasks; on Closed-Lost a re-engagement task after cooldown.
- UR-R-AUT-05 If a lead's confirmation email failed, I get a "manually contact lead" task.

**Sales Manager**
- UR-M-AUT-01 I'm **escalated** automatically when any rep's lead/deal breaches its stage SLA (overdue/stale).
- UR-M-AUT-02 I can see stale-deal flags and reassign or nudge.
- UR-M-AUT-03 I'm notified on team Closed-Won and on significant negotiation value drops.

**Admin**
- UR-A-AUT-01 I can **configure every automation rule** in Settings → Automations: enable/disable, edit timings (e.g. first-contact +4h), SLA days per stage, which task is created, probability defaults, escalation targets.
- UR-A-AUT-02 Every automated action is recorded in the audit log as actor "System / Automation".

**Visitor/Prospect** (indirect) — automation guarantees the confirmation email and timely human follow-up after submitting the form.

---

## Role-to-capability summary

| Capability | Visitor | Admin | Sales Manager | Sales Rep |
|------------|:-------:|:-----:|:-------------:|:---------:|
| Submit landing-page form | Yes | — | — | — |
| Log in to CRM | No | Yes | Yes | Yes |
| Mandatory 2FA | — | Yes | Yes | Yes |
| View all records | — | Yes | Yes | Own + assigned |
| Create / edit records | — | Yes | Yes | Yes (own) |
| Delete records | — | Yes | Yes | No |
| View all landing-page leads | — | Yes | Yes | Assigned only |
| Manage users & roles | — | Yes | No | No |
| System / app settings | — | Yes | No | No |
| Dashboards & reports | — | All | All | Own data |

---

*End of URD v2.0 · Ref ASM-CRM-001*
