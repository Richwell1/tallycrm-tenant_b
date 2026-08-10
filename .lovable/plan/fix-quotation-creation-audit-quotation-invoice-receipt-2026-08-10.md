# Fix quotation creation + audit Quotation → Invoice → Receipt

## What I verified (read-only, this session)

Checks run against the connected Lovable Cloud database:

- `to_regprocedure('public.is_rep_owned_insert()')` → **NULL (missing)**.
- `public.quotes_before_insert()`, `public.has_role(uuid, public.app_role)`, `public.create_invoice_from_quote(uuid)`, `public.revise_quote(uuid)` → all **present**.
- The only database object whose body calls the missing function is **`public.quotes_before_insert()`** (confirmed by scanning `pg_proc.prosrc`). No RLS policy references it.
- Trigger `quotes_before_insert BEFORE INSERT ON public.quotes` is installed and fires that function, so **every quote insert aborts** with `function public.is_rep_owned_insert() does not exist`.
- Function-by-function diff of repo migrations vs live database. Missing in the database:
  - `is_rep_owned_insert` (blocker)
  - `assign_rep_company_insert`, `assign_rep_assigned_insert`, `assign_rep_activity_insert` — all from `20260616120000_feature_2_security_rls_hardening.sql`; **no triggers in the database reference them**, so they are not blocking anything today
  - `handle_lead_manual_assignment`, `keep_closed_lost_deals_visible`, `restore_closed_lost_deal_visibility` — from later lead/deal migrations, unrelated to the financial chain
- Other evidence that `20260616120000_feature_2_security_rls_hardening.sql` never ran on this database: the column-level `GRANT INSERT (...) ON public.leads TO anon` from that file is absent (lead capture now goes through the `capture_landing_lead` SECURITY DEFINER RPC instead, so that grant is no longer needed).
- Migration history table is not readable with the available database role (`permission denied for schema supabase_migrations`), so drift was established by object-level comparison rather than by reading `schema_migrations`.

Root cause (confirmed): partial application of the June security-hardening migration left `public.is_rep_owned_insert()` absent, while the August quotations migration installed a `quotes` insert trigger that depends on it.

## Not yet verified (will confirm before/while implementing)

- Invoice and receipt insert paths: their triggers (`invoices_before_insert`, `receipts_before_write`) are present and set ownership from `auth.uid()` directly, so they are unlikely to be affected — but I have not run a live signed-in insert.
- Whether the totals/paid-rollup and status transitions behave as documented end to end. This needs a signed-in run, and the admin account is behind verified TOTP MFA, so a browser-driven end-to-end test may not be possible without a live authenticator code from you.

## Proposed work

### 1. Additive repair migration (single, minimal)

`supabase/migrations/20260810150000_restore_is_rep_owned_insert.sql`

Restores the function byte-for-byte from the approved June migration (same `LANGUAGE sql`, `SECURITY DEFINER`, `STABLE`, `SET search_path = public`, same `has_role` calls and enum literals `'admin'` / `'manager'`), plus `REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon, authenticated` — safe because the only caller is a SECURITY DEFINER trigger function that executes as its owner, and it matches the least-privilege posture of the earlier security passes.

Nothing else in that migration is re-applied: it also contains grants/revokes and policy changes that later applied migrations have since superseded, and blindly replaying it could revoke access the current app depends on. The three `assign_rep_*` helper functions stay out of scope because no trigger references them; re-installing them would silently change insert behaviour on companies/contacts/leads/activities.

### 2. Verification after the migration

- Re-run the `to_regprocedure(...)` triple.
- Create a quotation with one line item and with multiple line items, confirming generated `quote_number`, `subtotal`, `discount_amount`, `tax_amount`, `total` match `recalculate_quote_totals`.
- Draft an invoice from that quotation via `create_invoice_from_quote`, confirming `invoices.quote_id` link, copied lines, currency, and that the quotation itself is unchanged.
- Record a partial receipt (expect `partially_paid`), then the balance (expect `paid`, `amount_paid = total`), then attempt an overpayment (expect rejection from `receipts_before_write`).
- Read-only SQL summary of the resulting quote → invoice → receipt chain with no personal data.

### 3. Audit report (no code changes unless a blocker is confirmed)

I will read the quotation/invoice/receipt routes, `src/lib/quotes-data.ts`, `invoices-data.ts`, `receipts-data.ts`, `quote-totals.ts`, and the RLS policies, then report findings classified as blocking / security-critical / data-integrity / functional / UX. **Any further fix beyond the one migration above comes back to you for approval first** — no bundled schema changes, no changes to unrelated CRM pages.

### 4. Validation

Run whatever of `typecheck`, `lint`, `format:check`, `test`, `build` actually exists in `package.json` and report results verbatim.

## Risks

- Restoring the function changes rep-role quote inserts from "always fails" to "assigned_to defaults to the inserting rep" — that is the intended approved behaviour, not a new rule.
- The remaining four missing functions represent real drift outside the financial chain; I will report them, not silently fix them.
- MFA on the seeded accounts may block a fully browser-driven end-to-end test; database-level verification will still be run and anything unverified will be labelled UNVERIFIED rather than reported as passing.

## Constraints honoured

No RLS disabled, no `USING (true)` policies, no data deleted, no existing migration edited, no secrets in code, no publish, no push/merge. Lovable Cloud applies migrations directly rather than through a git branch — if you specifically want this committed on `fix/quotation-invoice-receipt-workflow` in GitHub, tell me and I will note it, as git branch operations are outside what I can perform here.

## Approval needed

1. Apply the single additive migration restoring `public.is_rep_owned_insert()`.
2. Confirm whether I may create test quotation/invoice/receipt rows in the live database for verification (I would prefer to, and will label them clearly as test documents and leave them for your review rather than deleting production data).
