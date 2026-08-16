import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useModalA11y } from "@/components/common/use-modal-a11y";
import { InvoiceStatusBadge } from "@/components/invoices/InvoiceStatusBadge";
import { formatDateOnly, formatMoney } from "@/lib/format";
import { useCreateCreditNoteFromInvoice, useCreditableInvoices } from "@/lib/credit-notes-data";

interface CreditNoteFromInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selects an invoice, e.g. when opened from an invoice's page. */
  invoiceId?: string;
}

/**
 * Select invoice → credit note auto-populates → review on the detail page.
 * The clone happens in create_credit_note_from_invoice(); the invoice is untouched.
 */
export function CreditNoteFromInvoiceModal({
  open,
  onOpenChange,
  invoiceId,
}: CreditNoteFromInvoiceModalProps) {
  const { data: invoices, isLoading } = useCreditableInvoices();
  const createFromInvoice = useCreateCreditNoteFromInvoice();
  const navigate = useNavigate();
  const modal = useModalA11y(open, onOpenChange, { disabled: createFromInvoice.isPending });

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(invoiceId ?? "");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (invoices ?? []).filter(
      (invoice) =>
        !query ||
        [invoice.invoice_number, invoice.title]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(query)),
    );
  }, [invoices, search]);

  if (!open) return null;

  async function handleCreate() {
    if (!selected) {
      toast.error("Select an invoice first");
      return;
    }
    try {
      const creditNoteId = await createFromInvoice.mutateAsync(selected);
      toast.success("Credit note drafted from invoice");
      onOpenChange(false);
      navigate({ to: "/app/credit-notes/$id", params: { id: creditNoteId } });
    } catch (error) {
      toast.error("Could not create the credit note", { description: (error as Error).message });
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/60 p-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="credit-note-from-invoice-title"
      ref={modal.ref}
      onKeyDown={modal.onKeyDown}
    >
      <div className="flex max-h-[86vh] w-full max-w-[680px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <header className="border-b border-border bg-muted px-8 py-6">
          <h2
            id="credit-note-from-invoice-title"
            className="text-[20px] font-semibold text-foreground"
          >
            Credit note from invoice
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Customer, items, tax and currency are copied across. Remove or reduce the lines you are
            not crediting. The invoice stays as it is.
          </p>
        </header>

        <div className="border-b border-border px-8 py-4">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search invoices..."
            className="deal-input"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-4">
          {isLoading ? (
            <p className="py-8 text-center text-sm text-text-secondary">Loading invoices...</p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-secondary">
              No invoices found. Raise an invoice first, or create a standalone credit note.
            </p>
          ) : (
            <ul className="space-y-2">
              {filtered.map((invoice) => (
                <li key={invoice.id}>
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                      selected === invoice.id
                        ? "border-primary bg-primary-light/40"
                        : "border-border hover:bg-muted/60"
                    }`}
                  >
                    <input
                      type="radio"
                      name="invoice"
                      value={invoice.id}
                      checked={selected === invoice.id}
                      onChange={() => setSelected(invoice.id)}
                      className="accent-primary"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {invoice.title}
                      </span>
                      <span className="block font-mono text-[11px] text-text-muted">
                        {invoice.invoice_number} · {formatDateOnly(invoice.issue_date)}
                      </span>
                    </span>
                    <InvoiceStatusBadge status={invoice.status} total={invoice.total} />
                    <span className="w-28 text-right text-sm font-semibold text-foreground">
                      {formatMoney(Number(invoice.total), invoice.currency)}
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
            disabled={createFromInvoice.isPending}
            className="rounded-lg bg-cta px-6 py-2 text-xs font-semibold text-cta-foreground hover:bg-cta-hover disabled:opacity-60"
          >
            {createFromInvoice.isPending ? "Creating..." : "Create credit note"}
          </button>
        </footer>
      </div>
    </div>
  );
}
