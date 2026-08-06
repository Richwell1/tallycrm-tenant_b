import { formatDateOnly, formatMoney } from "@/lib/format";
import type { InvoiceDetail } from "@/lib/invoices-data";
import type { QuoteIssuer } from "@/components/quotes/QuoteDocument";

interface InvoiceDocumentProps {
  invoice: InvoiceDetail;
  issuer: QuoteIssuer;
}

/**
 * The customer-facing document, shared by the screen view and the browser's
 * print dialog — "Save as PDF" there produces the PDF. Print rules live under
 * `@media print` in styles.css.
 */
export function InvoiceDocument({ invoice, issuer }: InvoiceDocumentProps) {
  const clientLines = [
    invoice.company?.name,
    invoice.contact ? `${invoice.contact.first_name} ${invoice.contact.last_name}`.trim() : null,
    invoice.contact?.email ?? invoice.company?.email,
    invoice.contact?.phone ?? invoice.company?.phone,
    invoice.company?.address,
  ].filter(Boolean) as string[];

  const balance = Number(invoice.total ?? 0) - Number(invoice.amount_paid ?? 0);

  return (
    <article className="quote-document mx-auto w-full max-w-[820px] bg-white p-10 text-[13px] leading-relaxed text-neutral-900 shadow-[var(--shadow-card)] print:max-w-none print:p-0 print:shadow-none">
      <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-neutral-900 pb-6">
        <div>
          {issuer.logoUrl ? (
            <img
              src={issuer.logoUrl}
              alt={issuer.companyName ?? "Company logo"}
              className="mb-3 h-12 w-auto object-contain"
            />
          ) : null}
          <h1 className="text-[20px] font-bold tracking-tight">
            {issuer.companyName ?? "Tally CRM Sales"}
          </h1>
          <div className="mt-1 space-y-0.5 text-[12px] text-neutral-600">
            {issuer.companyAddress ? (
              <p className="whitespace-pre-line">{issuer.companyAddress}</p>
            ) : null}
            {issuer.companyEmail ? <p>{issuer.companyEmail}</p> : null}
            {issuer.companyPhone ? <p>{issuer.companyPhone}</p> : null}
          </div>
        </div>

        <div className="text-right">
          <p className="text-[22px] font-black uppercase tracking-[0.2em] text-neutral-900">
            Invoice
          </p>
          <p className="mt-1 font-mono text-[13px] font-semibold">{invoice.invoice_number}</p>
          {invoice.quote?.quote_number ? (
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              Ref quote {invoice.quote.quote_number}
            </p>
          ) : null}
          <dl className="mt-3 space-y-0.5 text-[12px]">
            <div className="flex justify-end gap-3">
              <dt className="text-neutral-500">Issued</dt>
              <dd className="font-semibold">{formatDateOnly(invoice.issue_date)}</dd>
            </div>
            <div className="flex justify-end gap-3">
              <dt className="text-neutral-500">Due</dt>
              <dd className="font-semibold">{formatDateOnly(invoice.due_date)}</dd>
            </div>
          </dl>
        </div>
      </header>

      <section className="mt-6 flex flex-wrap justify-between gap-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
            Billed to
          </p>
          <div className="mt-1.5 space-y-0.5">
            {clientLines.length ? (
              clientLines.map((line, index) => (
                <p key={index} className={index === 0 ? "font-semibold" : "text-neutral-600"}>
                  {line}
                </p>
              ))
            ) : (
              <p className="text-neutral-500">No customer details</p>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
            Issued by
          </p>
          <p className="mt-1.5 font-semibold">{invoice.assigned_rep?.full_name ?? "—"}</p>
        </div>
      </section>

      <h2 className="mt-6 text-[15px] font-bold">{invoice.title}</h2>

      <table className="mt-3 w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-y border-neutral-300 bg-neutral-100 text-left">
            <th className="py-2 pl-2 font-semibold">#</th>
            <th className="py-2 font-semibold">Description</th>
            <th className="py-2 text-right font-semibold">Qty</th>
            <th className="py-2 text-right font-semibold">Unit price</th>
            <th className="py-2 text-right font-semibold">Disc.</th>
            <th className="py-2 text-right font-semibold">Tax</th>
            <th className="py-2 pr-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.line_items.map((line, index) => (
            <tr key={line.id} className="border-b border-neutral-200 align-top">
              <td className="py-2 pl-2 text-neutral-500">{index + 1}</td>
              <td className="py-2 pr-4">
                <p className="font-medium">{line.name}</p>
                {line.description ? (
                  <p className="text-[11px] text-neutral-600">{line.description}</p>
                ) : null}
              </td>
              <td className="py-2 text-right">
                {Number(line.quantity)} {line.unit}
              </td>
              <td className="py-2 text-right">
                {formatMoney(Number(line.unit_price), invoice.currency)}
              </td>
              <td className="py-2 text-right">
                {Number(line.discount_percent) ? `${Number(line.discount_percent)}%` : "—"}
              </td>
              <td className="py-2 text-right">
                {Number(line.tax_rate) ? `${Number(line.tax_rate)}%` : "—"}
              </td>
              <td className="py-2 pr-2 text-right font-semibold">
                {formatMoney(Number(line.line_total), invoice.currency)}
              </td>
            </tr>
          ))}
          {invoice.line_items.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-6 text-center text-neutral-500">
                This invoice has no items yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <div className="mt-4 flex justify-end">
        <dl className="w-full max-w-[300px] space-y-1.5 text-[12px]">
          <div className="flex justify-between">
            <dt className="text-neutral-600">Subtotal</dt>
            <dd className="font-semibold">
              {formatMoney(Number(invoice.subtotal), invoice.currency)}
            </dd>
          </div>
          {Number(invoice.discount_amount) > 0 ? (
            <div className="flex justify-between">
              <dt className="text-neutral-600">
                Discount
                {invoice.discount_type === "percent" ? ` (${Number(invoice.discount_value)}%)` : ""}
              </dt>
              <dd className="font-semibold">
                −{formatMoney(Number(invoice.discount_amount), invoice.currency)}
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-neutral-600">Tax</dt>
            <dd className="font-semibold">
              {formatMoney(Number(invoice.tax_amount), invoice.currency)}
            </dd>
          </div>
          <div className="flex justify-between border-t-2 border-neutral-900 pt-2 text-[15px] font-bold">
            <dt>Total</dt>
            <dd>{formatMoney(Number(invoice.total), invoice.currency)}</dd>
          </div>
          {Number(invoice.amount_paid) > 0 ? (
            <>
              <div className="flex justify-between">
                <dt className="text-neutral-600">Paid</dt>
                <dd className="font-semibold">
                  {formatMoney(Number(invoice.amount_paid), invoice.currency)}
                </dd>
              </div>
              <div className="flex justify-between font-bold">
                <dt>Balance due</dt>
                <dd>{formatMoney(balance, invoice.currency)}</dd>
              </div>
            </>
          ) : null}
        </dl>
      </div>

      {invoice.payment_terms ? (
        <section className="mt-8 border-t border-neutral-200 pt-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
            Payment terms
          </p>
          <p className="mt-1.5 whitespace-pre-line text-[12px] text-neutral-700">
            {invoice.payment_terms}
          </p>
        </section>
      ) : null}

      <footer className="mt-8 border-t border-neutral-200 pt-4 text-[11px] text-neutral-500">
        {issuer.footerNote ? <p className="mb-1 whitespace-pre-line">{issuer.footerNote}</p> : null}
        <p>
          {invoice.invoice_number} · Issued {formatDateOnly(invoice.issue_date)}
          {invoice.due_date ? ` · Due ${formatDateOnly(invoice.due_date)}` : ""}
        </p>
      </footer>
    </article>
  );
}
