import { formatDateOnly, formatMoney } from "@/lib/format";
import type { QuoteIssuer } from "@/components/quotes/QuoteDocument";
import type { ReceiptDetail } from "@/lib/receipts-data";

interface ReceiptDocumentProps {
  receipt: ReceiptDetail;
  issuer: QuoteIssuer;
}

export function ReceiptDocument({ receipt, issuer }: ReceiptDocumentProps) {
  const clientLines = [
    receipt.company?.name,
    receipt.contact ? `${receipt.contact.first_name} ${receipt.contact.last_name}`.trim() : null,
    receipt.contact?.email ?? receipt.company?.email,
    receipt.contact?.phone ?? receipt.company?.phone,
    receipt.company?.address,
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
            Receipt
          </p>
          <p className="mt-1 font-mono text-[13px] font-semibold">{receipt.receipt_number}</p>
          {receipt.invoice?.invoice_number ? (
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              Invoice {receipt.invoice.invoice_number}
            </p>
          ) : null}
          <dl className="mt-3 space-y-0.5 text-[12px]">
            <div className="flex justify-end gap-3">
              <dt className="text-neutral-500">Paid</dt>
              <dd className="font-semibold">{formatDateOnly(receipt.payment_date)}</dd>
            </div>
            <div className="flex justify-end gap-3">
              <dt className="text-neutral-500">Method</dt>
              <dd className="font-semibold">{receipt.payment_method}</dd>
            </div>
          </dl>
        </div>
      </header>

      <section className="mt-6 flex flex-wrap justify-between gap-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
            Received from
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
          <p className="mt-1.5 font-semibold">
            {receipt.issued_rep?.full_name ?? receipt.assigned_rep?.full_name ?? "—"}
          </p>
        </div>
      </section>

      <section className="mt-8 rounded-lg border border-neutral-300">
        <div className="grid grid-cols-1 divide-y divide-neutral-200 text-[12px] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          <div className="p-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
              Amount received
            </p>
            <p className="mt-2 text-[24px] font-black">
              {formatMoney(Number(receipt.amount), receipt.currency)}
            </p>
          </div>
          <div className="p-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
              Payment reference
            </p>
            <p className="mt-2 font-semibold">{receipt.reference || "—"}</p>
            {receipt.status === "void" ? (
              <p className="mt-2 text-xs font-bold uppercase tracking-wide text-neutral-500">
                Void receipt
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {receipt.invoice ? (
        <section className="mt-6">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-y border-neutral-300 bg-neutral-100 text-left">
                <th className="py-2 pl-2 font-semibold">Invoice</th>
                <th className="py-2 text-right font-semibold">Invoice total</th>
                <th className="py-2 pr-2 text-right font-semibold">Paid to date</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-neutral-200">
                <td className="py-2 pl-2">
                  <p className="font-semibold">{receipt.invoice.invoice_number}</p>
                  <p className="text-[11px] text-neutral-600">{receipt.invoice.title}</p>
                </td>
                <td className="py-2 text-right">
                  {formatMoney(Number(receipt.invoice.total), receipt.invoice.currency)}
                </td>
                <td className="py-2 pr-2 text-right font-semibold">
                  {formatMoney(Number(receipt.invoice.amount_paid), receipt.invoice.currency)}
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      ) : null}

      {receipt.notes ? (
        <section className="mt-8 border-t border-neutral-200 pt-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">Notes</p>
          <p className="mt-1.5 whitespace-pre-line text-[12px] text-neutral-700">{receipt.notes}</p>
        </section>
      ) : null}

      <footer className="mt-8 border-t border-neutral-200 pt-4 text-[11px] text-neutral-500">
        {issuer.footerNote ? <p className="mb-1 whitespace-pre-line">{issuer.footerNote}</p> : null}
        <p>
          {receipt.receipt_number} · Paid {formatDateOnly(receipt.payment_date)}
        </p>
      </footer>
    </article>
  );
}
