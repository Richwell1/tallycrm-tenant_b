import { formatDateOnly } from "@/lib/format";
import type { QuoteIssuer } from "@/components/quotes/QuoteDocument";
import type { DeliveryNoteDetail } from "@/lib/delivery-notes-data";

export function DeliveryNoteDocument({
  deliveryNote,
  issuer,
}: {
  deliveryNote: DeliveryNoteDetail;
  issuer: QuoteIssuer;
}) {
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
          <h1 className="text-[20px] font-bold">{issuer.companyName ?? "Tally CRM Sales"}</h1>
          <div className="mt-1 text-[12px] text-neutral-600">
            {issuer.companyAddress ? (
              <p className="whitespace-pre-line">{issuer.companyAddress}</p>
            ) : null}
            {issuer.companyEmail ? <p>{issuer.companyEmail}</p> : null}
            {issuer.companyPhone ? <p>{issuer.companyPhone}</p> : null}
          </div>
        </div>
        <div className="text-right">
          <p className="text-[22px] font-black uppercase tracking-[0.2em]">Delivery Note</p>
          <p className="mt-1 font-mono font-semibold">{deliveryNote.delivery_note_number}</p>
          {deliveryNote.invoice ? (
            <p className="text-[11px] uppercase text-neutral-500">
              Invoice {deliveryNote.invoice.invoice_number}
            </p>
          ) : null}
          <p className="mt-3 text-[12px]">
            <span className="text-neutral-500">Delivery date </span>
            <strong>{formatDateOnly(deliveryNote.delivery_date)}</strong>
          </p>
        </div>
      </header>
      <section className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
            Deliver to
          </p>
          <p className="mt-1.5 font-semibold">{deliveryNote.recipient_name || "—"}</p>
          <p className="whitespace-pre-line text-neutral-600">
            {deliveryNote.delivery_address || "No delivery address"}
          </p>
        </div>
        <div className="sm:text-right">
          <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
            Dispatch details
          </p>
          <p className="mt-1.5">
            <span className="text-neutral-500">Carrier: </span>
            {deliveryNote.carrier || "—"}
          </p>
          <p>
            <span className="text-neutral-500">Tracking: </span>
            {deliveryNote.tracking_reference || "—"}
          </p>
          <p>
            <span className="text-neutral-500">Assigned to: </span>
            {deliveryNote.assigned_rep?.full_name ?? "—"}
          </p>
        </div>
      </section>
      <table className="mt-6 w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-y border-neutral-300 bg-neutral-100 text-left">
            <th className="py-2 pl-2">#</th>
            <th className="py-2">Description</th>
            <th className="py-2 text-right">Quantity</th>
          </tr>
        </thead>
        <tbody>
          {deliveryNote.items.map((item, index) => (
            <tr key={item.id} className="border-b border-neutral-200 align-top">
              <td className="py-2 pl-2 text-neutral-500">{index + 1}</td>
              <td className="py-2">
                <p className="font-medium">{item.name}</p>
                {item.description ? (
                  <p className="text-[11px] text-neutral-600">{item.description}</p>
                ) : null}
              </td>
              <td className="py-2 text-right">
                {Number(item.quantity)} {item.unit}
              </td>
            </tr>
          ))}
          {!deliveryNote.items.length ? (
            <tr>
              <td colSpan={3} className="py-6 text-center text-neutral-500">
                This delivery note has no items yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      {deliveryNote.notes ? (
        <section className="mt-8 border-t border-neutral-200 pt-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">Notes</p>
          <p className="mt-1.5 whitespace-pre-line text-[12px] text-neutral-700">
            {deliveryNote.notes}
          </p>
        </section>
      ) : null}
      <footer className="mt-8 border-t border-neutral-200 pt-4 text-[11px] text-neutral-500">
        {issuer.footerNote ? <p className="mb-1 whitespace-pre-line">{issuer.footerNote}</p> : null}
        <p>
          {deliveryNote.delivery_note_number} · Delivery date{" "}
          {formatDateOnly(deliveryNote.delivery_date)}
        </p>
      </footer>
    </article>
  );
}
