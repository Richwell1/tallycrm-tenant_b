import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useModalA11y } from "@/components/common/use-modal-a11y";
import { QuoteStatusBadge } from "@/components/quotes/QuoteStatusBadge";
import { formatDateOnly, formatMoney } from "@/lib/format";
import { useCreateInvoiceFromQuote, useInvoiceableQuotes } from "@/lib/invoices-data";

interface InvoiceFromQuoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selects a quotation, e.g. when opened from a quote's page. */
  quoteId?: string;
}

/**
 * Select Quotation → invoice auto-populates → review on the detail page.
 * The clone happens in create_invoice_from_quote(); the quotation is untouched.
 */
export function InvoiceFromQuoteModal({
  open,
  onOpenChange,
  quoteId,
}: InvoiceFromQuoteModalProps) {
  const { data: quotes, isLoading } = useInvoiceableQuotes();
  const createFromQuote = useCreateInvoiceFromQuote();
  const navigate = useNavigate();
  const modal = useModalA11y(open, onOpenChange, { disabled: createFromQuote.isPending });

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(quoteId ?? "");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (quotes ?? []).filter(
      (quote) =>
        !query ||
        [quote.quote_number, quote.title]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(query)),
    );
  }, [quotes, search]);

  if (!open) return null;

  async function handleCreate() {
    if (!selected) {
      toast.error("Select a quotation first");
      return;
    }
    try {
      const invoiceId = await createFromQuote.mutateAsync(selected);
      toast.success("Invoice drafted from quotation");
      onOpenChange(false);
      navigate({ to: "/app/invoices/$id", params: { id: invoiceId } });
    } catch (error) {
      toast.error("Could not create the invoice", { description: (error as Error).message });
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/60 p-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invoice-from-quote-title"
      ref={modal.ref}
      onKeyDown={modal.onKeyDown}
    >
      <div className="flex max-h-[86vh] w-full max-w-[680px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <header className="border-b border-border bg-muted px-8 py-6">
          <h2 id="invoice-from-quote-title" className="text-[20px] font-semibold text-foreground">
            Invoice from quotation
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Customer, items, discount, tax and currency are copied across. The quotation stays as
            it is.
          </p>
        </header>

        <div className="border-b border-border px-8 py-4">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search quotations..."
            className="deal-input"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-4">
          {isLoading ? (
            <p className="py-8 text-center text-sm text-text-secondary">Loading quotations...</p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-secondary">
              No quotations found. Create a quotation first, or raise a manual invoice.
            </p>
          ) : (
            <ul className="space-y-2">
              {filtered.map((quote) => (
                <li key={quote.id}>
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                      selected === quote.id
                        ? "border-primary bg-primary-light/40"
                        : "border-border hover:bg-muted/60"
                    }`}
                  >
                    <input
                      type="radio"
                      name="quote"
                      value={quote.id}
                      checked={selected === quote.id}
                      onChange={() => setSelected(quote.id)}
                      className="accent-primary"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {quote.title}
                      </span>
                      <span className="block font-mono text-[11px] text-text-muted">
                        {quote.quote_number} · {formatDateOnly(quote.issue_date)}
                      </span>
                    </span>
                    <QuoteStatusBadge status={quote.status} />
                    <span className="w-28 text-right text-sm font-semibold text-foreground">
                      {formatMoney(Number(quote.total), quote.currency)}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="flex justify-end gap-4 border-t border-border bg-muted px-8 py-5">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg border border-border bg-card px-6 py-2 text-xs font-semibold hover:bg-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={createFromQuote.isPending}
            className="rounded-lg bg-cta px-6 py-2 text-xs font-semibold text-cta-foreground hover:bg-cta-hover disabled:opacity-60"
          >
            {createFromQuote.isPending ? "Creating..." : "Create invoice"}
          </button>
        </footer>
      </div>
    </div>
  );
}
