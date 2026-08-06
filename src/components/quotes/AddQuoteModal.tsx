import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useModalA11y } from "@/components/common/use-modal-a11y";
import { useCreateQuote, useQuoteFormOptions } from "@/lib/quotes-data";

interface AddQuoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-links the quote to a deal when opened from a deal page. */
  dealId?: string;
}

const currencies = ["GHS", "USD", "NGN", "KES", "EUR", "GBP"];

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function AddQuoteModal({ open, onOpenChange, dealId }: AddQuoteModalProps) {
  const { data: options } = useQuoteFormOptions();
  const createQuote = useCreateQuote();
  const navigate = useNavigate();
  const modal = useModalA11y(open, onOpenChange, { disabled: createQuote.isPending });

  const [title, setTitle] = useState("");
  const [contactId, setContactId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [linkedDealId, setLinkedDealId] = useState(dealId ?? "");
  const [assignedTo, setAssignedTo] = useState("");
  const [currency, setCurrency] = useState("GHS");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");

  // Seed the workspace defaults once the settings query resolves.
  useEffect(() => {
    if (!open || !options) return;
    setCurrency((current) => (current === "GHS" ? options.defaults.currency : current));
    setValidUntil((current) => current || addDays(options.defaults.validityDays));
    setTerms((current) => current || (options.defaults.terms ?? ""));
  }, [open, options]);

  useEffect(() => {
    if (dealId) setLinkedDealId(dealId);
  }, [dealId]);

  // Picking a contact fills in their company; picking a deal fills in both.
  useEffect(() => {
    if (!contactId || companyId) return;
    const contact = options?.contacts.find((item) => item.id === contactId);
    if (contact?.company_id) setCompanyId(contact.company_id);
  }, [companyId, contactId, options?.contacts]);

  useEffect(() => {
    if (!linkedDealId) return;
    const deal = options?.deals.find((item) => item.id === linkedDealId);
    if (!deal) return;
    setContactId((current) => current || deal.primary_contact_id || "");
    setCompanyId((current) => current || deal.company_id || "");
  }, [linkedDealId, options?.deals]);

  if (!open) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) {
      toast.error("Quote title is required");
      return;
    }
    if (!contactId && !companyId) {
      toast.error("Select a client contact or company");
      return;
    }

    try {
      const quote = await createQuote.mutateAsync({
        title: title.trim(),
        contact_id: contactId || null,
        company_id: companyId || null,
        deal_id: linkedDealId || null,
        assigned_to: assignedTo || null,
        currency,
        issue_date: issueDate,
        valid_until: validUntil || null,
        notes: notes.trim() || null,
        terms: terms.trim() || null,
      });
      toast.success(`Quote ${quote.quote_number} created`, {
        description: "Add line items to build the document.",
      });
      onOpenChange(false);
      setTitle("");
      setNotes("");
      navigate({ to: "/app/quotes/$id", params: { id: quote.id } });
    } catch (error) {
      toast.error("Could not create quote", { description: (error as Error).message });
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/60 p-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-quote-title"
      ref={modal.ref}
      onKeyDown={modal.onKeyDown}
    >
      <div className="flex max-h-[92vh] w-full max-w-[760px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <header className="flex items-center justify-between border-b border-border bg-muted px-8 py-6">
          <div>
            <h2 id="add-quote-title" className="text-[24px] font-semibold text-foreground">
              New Quotation
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Set the client and validity — line items and pricing come next.
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
          <div className="space-y-6">
            <Field label="Quote Title">
              <input
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="deal-input"
                placeholder="e.g. Annual TallyPrime licence renewal"
              />
            </Field>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Field label="Client Contact">
                <select
                  value={contactId}
                  onChange={(event) => setContactId(event.target.value)}
                  className="deal-input appearance-none"
                >
                  <option value="">Select contact...</option>
                  {options?.contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.first_name} {contact.last_name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Company">
                <select
                  value={companyId}
                  onChange={(event) => setCompanyId(event.target.value)}
                  className="deal-input appearance-none"
                >
                  <option value="">Select company...</option>
                  {options?.companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Field label="Linked Deal" hint="Optional — links the quote to an open opportunity">
                <select
                  value={linkedDealId}
                  onChange={(event) => setLinkedDealId(event.target.value)}
                  className="deal-input appearance-none"
                  disabled={!!dealId}
                >
                  <option value="">No linked deal</option>
                  {options?.deals.map((deal) => (
                    <option key={deal.id} value={deal.id}>
                      {deal.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Owner">
                <select
                  value={assignedTo}
                  onChange={(event) => setAssignedTo(event.target.value)}
                  className="deal-input appearance-none"
                >
                  <option value="">Current user</option>
                  {options?.profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.full_name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <Field label="Currency">
                <select
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                  className="deal-input appearance-none"
                >
                  {currencies.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </Field>
              <Field label="Issue Date">
                <input
                  required
                  type="date"
                  value={issueDate}
                  onChange={(event) => setIssueDate(event.target.value)}
                  className="deal-input"
                />
              </Field>
              <Field label="Valid Until">
                <input
                  type="date"
                  value={validUntil}
                  onChange={(event) => setValidUntil(event.target.value)}
                  className="deal-input"
                />
              </Field>
            </div>

            <Field label="Terms & Conditions">
              <textarea
                value={terms}
                onChange={(event) => setTerms(event.target.value)}
                className="min-h-24 w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="Payment terms, delivery window, warranty..."
              />
            </Field>

            <Field label="Internal Notes" hint="Not printed on the client document">
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="min-h-20 w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="Context for the team..."
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
              disabled={createQuote.isPending}
              className="rounded-lg bg-cta px-8 py-2 text-xs font-semibold text-cta-foreground transition-colors hover:bg-cta-hover disabled:opacity-60"
            >
              {createQuote.isPending ? "Creating..." : "Create Quote"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
        {label}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-text-muted">{hint}</span> : null}
    </label>
  );
}
