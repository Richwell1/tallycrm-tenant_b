import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { CardSkeleton, ErrorState } from "@/components/common";
import { ReceiptDocument } from "@/components/receipts/ReceiptDocument";
import { useReceipt } from "@/lib/receipts-data";
import { useQuoteFormOptions } from "@/lib/quotes-data";

export const Route = createFileRoute("/_authenticated/app/receipts/print/$id")({
  component: ReceiptPrintPage,
});

function ReceiptPrintPage() {
  const { id } = Route.useParams();
  const { data: receipt, isLoading, isError, error, refetch } = useReceipt(id);
  const { data: options } = useQuoteFormOptions();

  useEffect(() => {
    if (!receipt) return;
    const previous = document.title;
    document.title = `${receipt.receipt_number} — Receipt`;
    return () => {
      document.title = previous;
    };
  }, [receipt]);

  if (isLoading) return <CardSkeleton />;
  if (isError || !receipt) {
    return (
      <ErrorState
        description={(error as Error)?.message ?? "Could not load this receipt"}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="quote-print-page">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          to="/app/receipts/$id"
          params={{ id }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[13px] font-semibold hover:bg-surface-hover"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back to receipt
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

      <ReceiptDocument
        receipt={receipt}
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
