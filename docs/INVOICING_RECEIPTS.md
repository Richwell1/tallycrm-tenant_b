# Invoices and receipts

Invoices can be created manually or drafted from a quotation with
`public.create_invoice_from_quote(quote_id)`. The invoice keeps `quote_id` as a
read-only source reference; editing the invoice never changes the quotation.

Receipts are payment records against invoices. Active receipts are the source of
truth for `invoices.amount_paid`; receipt inserts, updates, voids, archives, and
deletes recalculate the invoice paid total and payment status.

## Data model

| Table | Purpose |
| --- | --- |
| `invoices` | Invoice header, copied quote reference, server-owned totals and paid rollup |
| `invoice_line_items` | Billable invoice lines, copied from quote lines or edited manually |
| `invoice_status_history` | Append-only invoice status changes |
| `receipts` | One payment receipt per invoice payment |

Receipt numbers use `next_receipt_number()` and the `receipt_number_prefix`
workspace setting. Receipts inherit invoice customer, deal, quote, owner, and
currency when those fields are not supplied directly.

## Payment behavior

- Issued receipts count toward the invoice paid amount.
- Void or archived receipts do not count.
- A partial receipt marks the invoice `partially_paid`.
- Receipts totaling the invoice total mark it `paid`.
- Cancelling an invoice prevents additional receipts.
- Receipt totals cannot exceed the invoice balance.

## UI

| Route | Purpose |
| --- | --- |
| `/app/invoices` | Invoice list and quote-to-invoice entry point |
| `/app/invoices/$id` | Invoice detail, line editor, linked quote, and receipt list |
| `/app/invoices/print/$id` | Customer invoice print/PDF document |
| `/app/receipts` | Receipt list and payment entry point |
| `/app/receipts/$id` | Receipt detail, void/archive actions, linked invoice |
| `/app/receipts/print/$id` | Customer receipt print/PDF document |

The quote detail page lists invoices raised from that quotation and keeps the
existing **Create invoice** action.
