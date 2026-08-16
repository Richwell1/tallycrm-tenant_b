import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { CardSkeleton, ErrorState } from "@/components/common";
import { CreditNoteDocument } from "@/components/credit-notes/CreditNoteDocument";
import { useCreditNote } from "@/lib/credit-notes-data";
import { useQuoteFormOptions } from "@/lib/quotes-data";

export const Route = createFileRoute("/_authenticated/app/credit-notes/print/$id")({
  component: CreditNotePrintPage,
});

function CreditNotePrintPage() {
  const { id } = Route.useParams();
  const { data: creditNote, isLoading, isError, error, refetch } = useCreditNote(id);
  const { data: options } = useQuoteFormOptions();

  // Give the document a filename the browser's Save as PDF will pick up.
  useEffect(() => {
    if (!creditNote) return;
    const previous = document.title;
    document.title = `${creditNote.credit_note_number} — Credit Note`;
    return () => {
      document.title = previous;
    };
  }, [creditNote]);

  if (isLoading) return <CardSkeleton />;
  if (isError || !creditNote) {
    return (
      <ErrorState
        description={(error as Error)?.message ?? "Could not load this credit note"}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="quote-print-page">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          to="/app/credit-notes/$id"
          params={{ id }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[13px] font-semibold hover:bg-surface-hover"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back to credit note
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-cta px-3.5 py-2.5 text-[13px] font-semibold text-cta-foreground hover:bg-cta-hover"
        >
          <span className="material-symbols-outlined text-[18px]">print</span>
          Print / Save as PDF
        </button>
      </div>

      <CreditNoteDocument
        creditNote={creditNote}
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
