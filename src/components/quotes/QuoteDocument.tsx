import { formatDateOnly, formatMoney } from "@/lib/format";
import type { QuoteDetail } from "@/lib/quotes-data";

export interface QuoteIssuer {
  companyName: string | null;
  companyAddress: string | null;
  companyEmail: string | null;
  companyPhone: string | null;
  logoUrl: string | null;
  footerNote: string | null;
}

interface QuoteDocumentProps {
  quote: QuoteDetail;
  issuer: QuoteIssuer;
}

/**
 * The client-facing document. Rendered on screen and by the browser's print
 * dialog — "Save as PDF" there produces the PDF, so no PDF dependency ships.
 * Print rules live under `@media print` in styles.css.
 */
export function QuoteDocument({ quote, issuer }: QuoteDocumentProps) {
  const clientLines = [
    quote.company?.name,
    quote.contact ? `${quote.contact.first_name} ${quote.contact.last_name}`.trim() : null,
    quote.contact?.email ?? quote.company?.email,
    quote.contact?.phone ?? quote.company?.phone,
    quote.company?.address,
  ].filter(Boolean) as string[];

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
            Quotation
          </p>
          <p className="mt-1 font-mono text-[13px] font-semibold">{quote.quote_number}</p>
          {quote.version > 1 ? (
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              Revision {quote.version}
            </p>
          ) : null}
          <dl className="mt-3 space-y-0.5 text-[12px]">
            <div className="flex justify-end gap-3">
              <dt className="text-neutral-500">Issued</dt>
              <dd className="font-semibold">{formatDateOnly(quote.issue_date)}</dd>
            </div>
            <div className="flex justify-end gap-3">
              <dt className="text-neutral-500">Valid until</dt>
              <dd className="font-semibold">{formatDateOnly(quote.valid_until)}</dd>
            </div>
          </dl>
        </div>
      </header>

      <section className="mt-6 flex flex-wrap justify-between gap-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
            Prepared for
          </p>
          <div className="mt-1.5 space-y-0.5">
            {clientLines.length ? (
              clientLines.map((line, index) => (
                <p key={index} className={index === 0 ? "font-semibold" : "text-neutral-600"}>
                  {line}
                </p>
              ))
            ) : (
              <p className="text-neutral-500">No client details</p>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
            Prepared by
          </p>
          <p className="mt-1.5 font-semibold">{quote.assigned_rep?.full_name ?? "—"}</p>
        </div>
      </section>

      <h2 className="mt-6 text-[15px] font-bold">{quote.title}</h2>

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
          {quote.line_items.map((line, index) => (
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
                {formatMoney(Number(line.unit_price), quote.currency)}
              </td>
              <td className="py-2 text-right">
                {Number(line.discount_percent) ? `${Number(line.discount_percent)}%` : "—"}
              </td>
              <td className="py-2 text-right">
                {Number(line.tax_rate) ? `${Number(line.tax_rate)}%` : "—"}
              </td>
              <td className="py-2 pr-2 text-right font-semibold">
                {formatMoney(Number(line.line_total), quote.currency)}
              </td>
            </tr>
          ))}
          {quote.line_items.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-6 text-center text-neutral-500">
                This quotation has no line items yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <div className="mt-4 flex justify-end">
        <dl className="w-full max-w-[300px] space-y-1.5 text-[12px]">
          <div className="flex justify-between">
            <dt className="text-neutral-600">Subtotal</dt>
            <dd className="font-semibold">{formatMoney(Number(quote.subtotal), quote.currency)}</dd>
          </div>
          {Number(quote.discount_amount) > 0 ? (
            <div className="flex justify-between">
              <dt className="text-neutral-600">
                Discount
                {quote.discount_type === "percent" ? ` (${Number(quote.discount_value)}%)` : ""}
              </dt>
              <dd className="font-semibold">
                −{formatMoney(Number(quote.discount_amount), quote.currency)}
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-neutral-600">Tax</dt>
            <dd className="font-semibold">
              {formatMoney(Number(quote.tax_amount), quote.currency)}
            </dd>
          </div>
          <div className="flex justify-between border-t-2 border-neutral-900 pt-2 text-[15px] font-bold">
            <dt>Total</dt>
            <dd>{formatMoney(Number(quote.total), quote.currency)}</dd>
          </div>
        </dl>
      </div>

      {quote.terms ? (
        <section className="mt-8 border-t border-neutral-200 pt-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
            Terms &amp; conditions
          </p>
          <p className="mt-1.5 whitespace-pre-line text-[12px] text-neutral-700">{quote.terms}</p>
        </section>
      ) : null}

      <footer className="mt-8 border-t border-neutral-200 pt-4 text-[11px] text-neutral-500">
        {issuer.footerNote ? <p className="mb-1 whitespace-pre-line">{issuer.footerNote}</p> : null}
        <p>
          {quote.quote_number} · Issued {formatDateOnly(quote.issue_date)}
          {quote.valid_until ? ` · Valid until ${formatDateOnly(quote.valid_until)}` : ""}
        </p>
      </footer>
    </article>
  );
}
