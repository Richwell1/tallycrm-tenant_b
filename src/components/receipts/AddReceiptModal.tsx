import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useModalA11y } from "@/components/common/use-modal-a11y";
import { formatMoney } from "@/lib/format";
import { invoiceBalance } from "@/lib/invoices-data";
import { type ReceiptInvoice, useCreateReceipt, useReceiptableInvoices } from "@/lib/receipts-data";

interface AddReceiptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice?: ReceiptInvoice;
}

const PAYMENT_METHODS = ["Cash", "Bank transfer", "Mobile money", "Card", "Cheque"];

export function AddReceiptModal({ open, onOpenChange, invoice }: AddReceiptModalProps) {
  const { data: invoices, isLoading } = useReceiptableInvoices();
  const createReceipt = useCreateReceipt();
  const navigate = useNavigate();
  const modal = useModalA11y(open, onOpenChange, { disabled: createReceipt.isPending });

  const [invoiceId, setInvoiceId] = useState(invoice?.id ?? "");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const availableInvoices = useMemo(() => {
    const base = invoices ?? [];
    return invoice && !base.some((item) => item.id === invoice.id) ? [invoice, ...base] : base;
  }, [invoice, invoices]);

  const selectedInvoice =
    availableInvoices.find((item) => item.id === invoiceId) ?? invoice ?? null;
  const balance = selectedInvoice ? invoiceBalance(selectedInvoice) : 0;

  useEffect(() => {
    if (!open) return;
    const nextInvoice = invoice ?? availableInvoices[0] ?? null;
    setInvoiceId((current) => current || nextInvoice?.id || "");
    if (nextInvoice) setAmount(String(Math.max(invoiceBalance(nextInvoice), 0)));
  }, [availableInvoices, invoice, open]);

  if (!open) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!invoiceId) {
      toast.error("Select an invoice first");
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      toast.error("Enter a payment amount");
      return;
    }
    if (selectedInvoice && balance <= 0) {
      toast.error("This invoice has no balance to receipt");
      return;
    }
    if (balance > 0 && numericAmount > balance) {
      toast.error("Payment cannot exceed the invoice balance");
      return;
    }

    try {
      const receipt = await createReceipt.mutateAsync({
        invoice_id: invoiceId,
        amount: numericAmount,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        reference: reference.trim() || null,
        notes: notes.trim() || null,
      });
      toast.success(`Receipt ${receipt.receipt_number} created`);
      onOpenChange(false);
      setAmount("");
      setReference("");
      setNotes("");
      navigate({ to: "/app/receipts/$id", params: { id: receipt.id } });
    } catch (error) {
      toast.error("Could not record payment", { description: (error as Error).message });
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/60 p-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-receipt-title"
      ref={modal.ref}
      onKeyDown={modal.onKeyDown}
    >
      <div className="flex max-h-[90vh] w-full max-w-[640px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <header className="flex items-center justify-between border-b border-border bg-muted px-8 py-6">
          <div>
            <h2 id="add-receipt-title" className="text-[22px] font-semibold text-foreground">
              Record Payment
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Create a receipt and update the invoice balance.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-full p-2 text-text-secondary transition-colors hover:bg-danger-light hover:text-danger"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-8 py-8">
          <div className="space-y-5">
            <Field label="Invoice">
              {invoice ? (
                <div className="rounded-lg border border-border bg-muted px-3 py-2 text-sm font-semibold">
                  {invoice.invoice_number} · {formatMoney(balance, invoice.currency)} balance
                </div>
              ) : (
                <select
                  value={invoiceId}
                  onChange={(event) => {
                    const nextId = event.target.value;
                    setInvoiceId(nextId);
                    const next = availableInvoices.find((item) => item.id === nextId);
                    if (next) setAmount(String(Math.max(invoiceBalance(next), 0)));
                  }}
                  className="deal-input appearance-none"
                  disabled={isLoading}
                >
                  <option value="">Select invoice...</option>
                  {availableInvoices.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.invoice_number} · {formatMoney(invoiceBalance(item), item.currency)}
                    </option>
                  ))}
                </select>
              )}
            </Field>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Field label={`Amount${selectedInvoice ? ` (${selectedInvoice.currency})` : ""}`}>
                <input
                  type="number"
                  min={0.01}
                  max={balance || undefined}
                  step={0.01}
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="deal-input"
                />
              </Field>
              <Field label="Payment Date">
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(event) => setPaymentDate(event.target.value)}
                  className="deal-input"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Field label="Method">
                <select
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                  className="deal-input appearance-none"
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method}>{method}</option>
                  ))}
                </select>
              </Field>
              <Field label="Reference">
                <input
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  className="deal-input"
                  placeholder="Transaction ID or cheque no."
                />
              </Field>
            </div>

            <Field label="Notes">
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="min-h-20 w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </Field>
          </div>

          <footer className="-mx-8 -mb-8 mt-8 flex justify-end gap-4 border-t border-border bg-muted px-8 py-6">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg border border-border bg-card px-8 py-2 text-xs font-semibold transition-colors hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createReceipt.isPending}
              className="rounded-lg bg-cta px-8 py-2 text-xs font-semibold text-cta-foreground hover:bg-cta-hover disabled:opacity-60"
            >
              {createReceipt.isPending ? "Recording..." : "Create receipt"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
        {label}
      </span>
      {children}
    </label>
  );
}
