import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useModalA11y } from "@/components/common/use-modal-a11y";
import { formatDateOnly } from "@/lib/format";
import {
  useCreateDeliveryNoteFromInvoice,
  useDeliverableInvoices,
} from "@/lib/delivery-notes-data";

export function DeliveryNoteFromInvoiceModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: invoices, isLoading } = useDeliverableInvoices();
  const create = useCreateDeliveryNoteFromInvoice();
  const navigate = useNavigate();
  const modal = useModalA11y(open, onOpenChange, { disabled: create.isPending });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");
  const filtered = useMemo(
    () =>
      (invoices ?? []).filter(
        (invoice) =>
          !search.trim() ||
          `${invoice.invoice_number} ${invoice.title}`
            .toLowerCase()
            .includes(search.trim().toLowerCase()),
      ),
    [invoices, search],
  );
  if (!open) return null;
  async function handleCreate() {
    if (!selected) return void toast.error("Select an invoice first");
    try {
      const id = await create.mutateAsync(selected);
      toast.success("Delivery note drafted from invoice");
      onOpenChange(false);
      navigate({ to: "/app/delivery-notes/$id", params: { id } });
    } catch (error) {
      toast.error("Could not create the delivery note", { description: (error as Error).message });
    }
  }
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/60 p-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delivery-note-from-invoice-title"
      ref={modal.ref}
      onKeyDown={modal.onKeyDown}
    >
      <div className="flex max-h-[86vh] w-full max-w-[680px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <header className="border-b border-border bg-muted px-8 py-6">
          <h2 id="delivery-note-from-invoice-title" className="text-[20px] font-semibold">
            Delivery note from invoice
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Customer, delivery address and item quantities are copied for review.
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
            <p className="py-8 text-center text-sm">Loading invoices...</p>
          ) : (
            <ul className="space-y-2">
              {filtered.map((invoice) => (
                <li key={invoice.id}>
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 ${selected === invoice.id ? "border-primary bg-primary-light/40" : "border-border"}`}
                  >
                    <input
                      type="radio"
                      checked={selected === invoice.id}
                      onChange={() => setSelected(invoice.id)}
                    />
                    <span className="flex-1">
                      <strong className="block">{invoice.title}</strong>
                      <span className="font-mono text-[11px] text-text-muted">
                        {invoice.invoice_number} · {formatDateOnly(invoice.issue_date)}
                      </span>
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
            className="rounded-lg border border-border bg-card px-6 py-2 text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={create.isPending}
            className="rounded-lg bg-cta px-6 py-2 text-xs font-semibold text-cta-foreground disabled:opacity-60"
          >
            {create.isPending ? "Creating..." : "Create delivery note"}
          </button>
        </footer>
      </div>
    </div>
  );
}
