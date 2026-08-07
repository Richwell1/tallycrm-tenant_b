# Quotations module

Priced client documents that flow **quote → sent → accepted → deal**, sitting
between a qualified lead and a pipeline opportunity.

## Data model

`supabase/migrations/20260806120000_quotations.sql`

| Table                 | Purpose                                                        |
| --------------------- | -------------------------------------------------------------- |
| `quotes`              | Document header: client, dates, currency, status, stored totals |
| `quote_line_items`    | Priced lines with per-line discount and tax                     |
| `quote_catalog_items` | Reusable products/services reps drop into a quote               |
| `quote_status_history`| Append-only record of every status transition                   |

Plus six `app_settings` columns for workspace defaults (number prefix, node
code, default tax rate, validity days, terms, footer).

### Money is computed server-side

`public.recalculate_quote_totals(quote_id)` runs on every line-item write and
whenever the quote-level discount changes. A client that posts wrong totals
cannot skew a document — the trigger overwrites them.

```
line_gross     = quantity × unit_price
line_discount  = line_gross × discount_percent%
line_net       = line_gross − line_discount
subtotal       = Σ line_net
discount_amount= percent of subtotal, or a fixed amount capped at subtotal
                 …allocated back across lines pro rata
line_tax       = (line_net − allocated discount) × tax_rate%
total          = subtotal − discount_amount + Σ line_tax
```

The allocation remainder lands on the last line, so the parts always sum to the
whole and no cent drifts. `src/lib/quote-totals.ts` mirrors this exactly for the
editor's live preview — **change one, change the other.**

### Lifecycle and locking

- **draft** — fully editable.
- **sent** — line items are locked by `quote_line_items_guard()`, and the
  commercial header fields (title, currency, issue date, discount, client,
  terms) are frozen by `quotes_before_update()`. `valid_until`, internal notes,
  owner, and the linked deal stay editable — those are housekeeping, not price.
- **accepted / rejected** — terminal. No further status change.
- **expired** — set by `expire_stale_quotes()` for sent quotes past
  `valid_until`. The UI also derives the expired look via
  `isEffectivelyExpired()`, so a missed run never shows a stale document as
  live.

To change a locked quote, use **Revise**: `public.revise_quote(id)` clones the
header and lines into a new draft, bumps `version`, and links both through
`root_quote_id` / `supersedes_quote_id`. Every version stays readable.

### Numbering

`next_quote_number()` builds `PREFIX-[NODE-]YYYY-00001` from a Postgres
sequence. Set **Node code** per branch install (Quotations → Catalog → Document
defaults) so LAN/offline nodes cannot mint the same number and collide on sync.

### Access control

RLS mirrors the deal model: reps see quotes they own or created, managers and
admins see everything, deletes are manager/admin only, and archiving is a soft
`deleted_at`. The catalog is readable by everyone and writable by
managers/admins.

## Application

| Path                       | What it is                                              |
| -------------------------- | ------------------------------------------------------- |
| `/app/quotes`              | List with status filters and awaiting/accepted totals   |
| `/app/quotes/$id`          | Detail: line-item editor, actions, history, revisions   |
| `/app/quotes/print/$id`    | Client document, print/PDF                              |
| `/app/quotes/catalog`      | Catalog CRUD + document defaults (manager/admin)        |

Also reachable from a deal's **Quotations** tab, which lists that deal's quotes
and can create one pre-linked.

### PDF

The browser's print dialog is the PDF engine — "Save as PDF" on
`/app/quotes/print/$id` produces the client document. No PDF dependency ships.
Print rules live in the `@media print` block in `src/styles.css`; the app shell
carries `print:hidden`.

### Converting to a deal

An accepted quote can create a pipeline deal worth the quote total (or refresh
the value of the deal it is already linked to), recording the change in
`deal_value_history`. Converting requires a client contact on the quote.

Invoices can be drafted from a quotation without mutating the quote. Receipt
payments then roll up against those invoices; see `docs/INVOICING_RECEIPTS.md`.

## Branch/LAN sync

All four tables are registered in `scripts/sync-once.mjs`. `quote_catalog_items`
is `pullOnly` (managed centrally, like `automation_rules`),
`quote_status_history` is append-only, and `quotes` / `quote_line_items` sync
bidirectionally on `updated_at`.
