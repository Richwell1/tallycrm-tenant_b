import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { CardSkeleton, ErrorState } from "@/components/common";
import { DeliveryNoteDocument } from "@/components/delivery-notes/DeliveryNoteDocument";
import { useDeliveryNote } from "@/lib/delivery-notes-data";
import { useQuoteFormOptions } from "@/lib/quotes-data";

export const Route = createFileRoute("/_authenticated/app/delivery-notes/print/$id")({
  component: DeliveryNotePrintPage,
});
function DeliveryNotePrintPage() {
  const { id } = Route.useParams();
  const { data: note, isLoading, isError, error, refetch } = useDeliveryNote(id);
  const { data: options } = useQuoteFormOptions();
  useEffect(() => {
    if (!note) return;
    const previous = document.title;
    document.title = `${note.delivery_note_number} — Delivery Note`;
    return () => {
      document.title = previous;
    };
  }, [note]);
  if (isLoading) return <CardSkeleton />;
  if (isError || !note)
    return (
      <ErrorState
        description={(error as Error)?.message ?? "Could not load this delivery note"}
        onRetry={() => refetch()}
      />
    );
  return (
    <div className="quote-print-page">
      <div className="mb-6 flex justify-between print:hidden">
        <Link
          to="/app/delivery-notes/$id"
          params={{ id }}
          className="rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[13px] font-semibold"
        >
          Back to delivery note
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-cta px-3.5 py-2.5 text-[13px] font-semibold text-cta-foreground"
        >
          Print / Save as PDF
        </button>
      </div>
      <DeliveryNoteDocument
        deliveryNote={note}
        issuer={{
          companyName: options?.defaults.companyName ?? null,
          companyAddress: options?.defaults.companyAddress ?? null,
          companyEmail: options?.defaults.companyEmail ?? null,
          companyPhone: options?.defaults.companyPhone ?? null,
          logoUrl: options?.defaults.logoUrl ?? null,
          footerNote: options?.defaults.footerNote ?? null,
        }}
      />
    </div>
  );
}
