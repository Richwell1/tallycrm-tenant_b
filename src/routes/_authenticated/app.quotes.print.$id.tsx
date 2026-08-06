import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { CardSkeleton, ErrorState } from "@/components/common";
import { QuoteDocument } from "@/components/quotes/QuoteDocument";
import { useQuote, useQuoteFormOptions } from "@/lib/quotes-data";

export const Route = createFileRoute("/_authenticated/app/quotes/print/$id")({
  component: QuotePrintPage,
});

function QuotePrintPage() {
  const { id } = Route.useParams();
  const { data: quote, isLoading, isError, error, refetch } = useQuote(id);
  const { data: options } = useQuoteFormOptions();

  // Give the document a filename the browser's "Save as PDF" will pick up.
  useEffect(() => {
    if (!quote) return;
    const previous = document.title;
    document.title = `${quote.quote_number} — ${quote.title}`;
    return () => {
      document.title = previous;
    };
  }, [quote]);

  if (isLoading) return <CardSkeleton />;
  if (isError || !quote) {
    return (
      <ErrorState
        description={(error as Error)?.message ?? "Could not load this quotation"}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="quote-print-page">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          to="/app/quotes/$id"
          params={{ id }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[13px] font-semibold hover:bg-surface-hover"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back to quote
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

      <QuoteDocument
        quote={quote}
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
