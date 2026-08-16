import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useModalA11y } from "@/components/common/use-modal-a11y";
import { useQuoteFormOptions } from "@/lib/quotes-data";
import { useCreateCreditNote, useCreditableInvoices } from "@/lib/credit-notes-data";

interface AddCreditNoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * A standalone credit note. To reverse an existing invoice, use
 * CreditNoteFromInvoiceModal instead — it copies the line items across.
 */
export function AddCreditNoteModal({ open, onOpenChange }: AddCreditNoteModalProps) {
  const { data: options } = useQuoteFormOptions();
  const { data: invoices } = useCreditableInvoices();
  const createCreditNote = useCreateCreditNote();
  const navigate = useNavigate();
  const modal = useModalA11y(open, onOpenChange, { disabled: createCreditNote.isPending });

  const [invoiceId, setInvoiceId] = useState("");
  const [contactId, setContactId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [currency, setCurrency] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  // Seed the currency from settings, but only while the field is untouched.
  useEffect(() => {
    if (!options) return;
    setCurrency((current) => current || options.defaults.currency);
  }, [options]);

  // Picking a contact fills in its company, unless one was chosen already.
  useEffect(() => {
    if (!contactId || companyId) return;
    const contact = options?.contacts.find((item) => item.id === contactId);
    if (contact?.company_id) setCompanyId(contact.company_id);
  }, [companyId, contactId, options]);

  if (!open) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!companyId && !contactId && !invoiceId) {
      toast.error("Choose an invoice, a company or a contact");
      return;
    }

    try {
      const note = await createCreditNote.mutateAsync({
        invoice_id: invoiceId || null,
        company_id: companyId || null,
        contact_id: contactId || null,
        issue_date: issueDate,
        currency: currency || "GHS",
        reason: reason.trim() || null,
        notes: notes.trim() || null,
      });
      toast.success(`Credit note ${note.credit_note_number} created`);
      onOpenChange(false);
      setReason("");
      setNotes("");
      navigate({ to: "/app/credit-notes/$id", params: { id: note.id } });
    } catch (error) {
      toast.error("Could not create the credit note", { description: (error as Error).message });
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/60 p-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-credit-note-title"
      ref={modal.ref}
      onKeyDown={modal.onKeyDown}
    >
      <div className="flex max-h-[90vh] w-full max-w-[640px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <header className="flex items-center justify-between border-b border-border bg-muted px-8 py-6">
          <div>
            <h2 id="add-credit-note-title" className="text-[22px] font-semibold text-foreground">
              New Credit Note
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Create the document, then add the lines you are crediting.
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
            <Field
              label="Invoice"
              hint="Optional. Links this credit note to the invoice it reverses."
            >
              <select
                value={invoiceId}
                onChange={(event) => setInvoiceId(event.target.value)}
                className="deal-input appearance-none"
              >
                <option value="">No invoice</option>
                {(invoices ?? []).map((invoice) => (
                  <option key={invoice.id} value={invoice.id}>
                    {invoice.invoice_number} · {invoice.title}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Company">
                <select
                  value={companyId}
                  onChange={(event) => setCompanyId(event.target.value)}
                  className="deal-input appearance-none"
                >
                  <option value="">Select company...</option>
                  {(options?.companies ?? []).map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Contact">
                <select
                  value={contactId}
                  onChange={(event) => setContactId(event.target.value)}
                  className="deal-input appearance-none"
                >
                  <option value="">Select contact...</option>
                  {(options?.contacts ?? []).map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.first_name} {contact.last_name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Issue date" required>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(event) => setIssueDate(event.target.value)}
                  className="deal-input"
                  required
                />
              </Field>

              <Field label="Currency" required>
                <input
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value.toUpperCase())}
                  className="deal-input"
                  maxLength={3}
                  required
                />
              </Field>
            </div>

            <Field label="Reason" hint="Why is this being credited? Shown on the printed document.">
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="min-h-16 w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                placeholder="Returned licence, overcharge, cancelled line..."
              />
            </Field>

            <Field label="Internal notes">
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="min-h-16 w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </Field>
          </div>

          <div className="mt-8 flex justify-end gap-4 border-t border-border pt-6">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg border border-border bg-card px-6 py-2 text-xs font-semibold hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createCreditNote.isPending}
              className="rounded-lg bg-cta px-6 py-2 text-xs font-semibold text-cta-foreground hover:bg-cta-hover disabled:opacity-60"
            >
              {createCreditNote.isPending ? "Creating..." : "Create credit note"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
        {label}
        {required ? <span className="ml-1 text-danger">*</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-text-muted">{hint}</span> : null}
    </label>
  );
}
