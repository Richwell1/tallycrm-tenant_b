import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useModalA11y } from "@/components/common/use-modal-a11y";
import { formatMoney } from "@/lib/format";
import { calculateQuoteTotals } from "@/lib/quote-totals";
import { type InvoiceLineItemDraft, useCreateInvoice } from "@/lib/invoices-data";
import { useQuoteFormOptions } from "@/lib/quotes-data";

interface AddInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const currencies = ["GHS", "USD", "NGN", "KES", "EUR", "GBP"];

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function blankLine(taxRate = 0): InvoiceLineItemDraft {
  return {
    name: "",
    description: null,
    unit: "unit",
    quantity: 1,
    unit_price: 0,
    discount_percent: 0,
    tax_rate: taxRate,
    catalog_item_id: null,
  };
}

/**
 * Fast path for a manual invoice: a customer and one item is all that is
 * required. Number, date, draft status, currency and totals are automatic;
 * due date, tax, discount, notes and terms are optional extras.
 */
export function AddInvoiceModal({ open, onOpenChange }: AddInvoiceModalProps) {
  const { data: options } = useQuoteFormOptions();
  const createInvoice = useCreateInvoice();
  const navigate = useNavigate();
  const modal = useModalA11y(open, onOpenChange, { disabled: createInvoice.isPending });

  const [title, setTitle] = useState("");
  const [contactId, setContactId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [currency, setCurrency] = useState("GHS");
  const [dueDate, setDueDate] = useState("");
  const [lines, setLines] = useState<InvoiceLineItemDraft[]>([blankLine()]);
  const [showOptional, setShowOptional] = useState(false);
  const [notes, setNotes] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");

  useEffect(() => {
    if (!open || !options) return;
    setCurrency((current) => (current === "GHS" ? options.defaults.currency : current));
    setDueDate((current) => current || addDays(30));
    setLines((current) =>
      current.length === 1 && !current[0].name && current[0].tax_rate === 0
        ? [blankLine(options.defaults.taxRate)]
        : current,
    );
  }, [open, options]);

  useEffect(() => {
    if (!contactId || companyId) return;
    const contact = options?.contacts.find((item) => item.id === contactId);
    if (contact?.company_id) setCompanyId(contact.company_id);
  }, [companyId, contactId, options?.contacts]);

  if (!open) return null;

  const totals = calculateQuoteTotals(lines, "none", 0);

  function patchLine(index: number, patch: Partial<InvoiceLineItemDraft>) {
    setLines((current) =>
      current.map((line, position) => (position === index ? { ...line, ...patch } : line)),
    );
  }

  function addCatalogLine(itemId: string) {
    const item = options?.catalog.find((entry) => entry.id === itemId);
    if (!item) return;
    setLines((current) => [
      ...current.filter((line) => line.name.trim()),
      {
        name: item.name,
        description: item.description,
        unit: item.unit,
        quantity: 1,
        unit_price: Number(item.unit_price),
        discount_percent: 0,
        tax_rate: Number(item.tax_rate),
        catalog_item_id: item.id,
      },
    ]);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!contactId && !companyId) {
      toast.error("Select a customer contact or company");
      return;
    }
    const filled = lines.filter((line) => line.name.trim());
    if (filled.length === 0) {
      toast.error("Add at least one invoice item");
      return;
    }

    try {
      const invoice = await createInvoice.mutateAsync({
        title: title.trim() || undefined,
        contact_id: contactId || null,
        company_id: companyId || null,
        currency,
        due_date: dueDate || null,
        notes: notes.trim() || null,
        payment_terms: paymentTerms.trim() || options?.defaults.terms || null,
        lines: filled,
      });
      toast.success(`Invoice ${invoice.invoice_number} created`);
      onOpenChange(false);
      setTitle("");
      setNotes("");
      setLines([blankLine(options?.defaults.taxRate ?? 0)]);
      navigate({ to: "/app/invoices/$id", params: { id: invoice.id } });
    } catch (error) {
      toast.error("Could not create invoice", { description: (error as Error).message });
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/60 p-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-invoice-title"
      ref={modal.ref}
      onKeyDown={modal.onKeyDown}
    >
      <div className="flex max-h-[92vh] w-full max-w-[820px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <header className="flex items-center justify-between border-b border-border bg-muted px-8 py-6">
          <div>
            <h2 id="add-invoice-title" className="text-[24px] font-semibold text-foreground">
              New Invoice
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Pick a customer, add an item — number, date and totals are automatic.
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
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Field label="Customer Contact" required>
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
              <Field label="Company" hint="Either a contact or a company is enough">
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

            <div className="rounded-xl border border-border">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  Items
                </p>
                <div className="flex items-center gap-2">
                  <select
                    value=""
                    onChange={(event) => {
                      if (event.target.value) addCatalogLine(event.target.value);
                    }}
                    className="h-8 rounded-lg border border-border bg-card px-2 text-xs font-semibold outline-none"
                  >
                    <option value="">From catalog...</option>
                    {options?.catalog.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      setLines((current) => [
                        ...current,
                        blankLine(options?.defaults.taxRate ?? 0),
                      ])
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    Add row
                  </button>
                </div>
              </div>

              <div className="divide-y divide-border">
                {lines.map((line, index) => (
                  <div key={index} className="flex flex-wrap items-center gap-2 px-4 py-3">
                    <input
                      value={line.name}
                      onChange={(event) => patchLine(index, { name: event.target.value })}
                      placeholder="Item or service"
                      className="min-w-[180px] flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                    <input
                      type="number"
                      min={0}
                      step={0.001}
                      value={line.quantity}
                      onChange={(event) =>
                        patchLine(index, { quantity: Number(event.target.value) || 0 })
                      }
                      aria-label="Quantity"
                      className="w-20 rounded-lg border border-border bg-card px-2 py-2 text-right text-sm outline-none focus:border-primary"
                    />
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={line.unit_price}
                      onChange={(event) =>
                        patchLine(index, { unit_price: Number(event.target.value) || 0 })
                      }
                      aria-label="Unit price"
                      className="w-28 rounded-lg border border-border bg-card px-2 py-2 text-right text-sm outline-none focus:border-primary"
                    />
                    <span className="w-28 text-right text-sm font-semibold text-foreground">
                      {formatMoney(totals.lines[index]?.line_total ?? 0, currency)}
                    </span>
                    <button
                      type="button"
                      aria-label="Remove item"
                      onClick={() =>
                        setLines((current) =>
                          current.length === 1
                            ? [blankLine(options?.defaults.taxRate ?? 0)]
                            : current.filter((_item, position) => position !== index),
                        )
                      }
                      className="rounded-md p-1.5 text-text-muted hover:bg-danger-light hover:text-danger"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex justify-between border-t border-border bg-muted px-4 py-3 text-sm">
                <span className="text-text-secondary">Total</span>
                <span className="font-bold text-foreground">
                  {formatMoney(totals.total, currency)}
                </span>
              </div>
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
              <Field label="Due Date" hint="Optional">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  className="deal-input"
                />
              </Field>
              <Field label="Reference" hint="Optional title">
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="deal-input"
                  placeholder="Invoice"
                />
              </Field>
            </div>

            <button
              type="button"
              onClick={() => setShowOptional((current) => !current)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary"
            >
              <span className="material-symbols-outlined text-[16px]">
                {showOptional ? "expand_less" : "expand_more"}
              </span>
              {showOptional ? "Hide" : "Add"} payment terms and notes
            </button>

            {showOptional ? (
              <div className="space-y-6">
                <Field label="Payment Terms" hint="Optional — printed on the document">
                  <textarea
                    value={paymentTerms}
                    onChange={(event) => setPaymentTerms(event.target.value)}
                    className="min-h-20 w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="Payable within 30 days by bank transfer..."
                  />
                </Field>
                <Field label="Internal Notes" hint="Not printed on the document">
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    className="min-h-20 w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="Context for the team..."
                  />
                </Field>
              </div>
            ) : null}
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
              disabled={createInvoice.isPending}
              className="rounded-lg bg-cta px-8 py-2 text-xs font-semibold text-cta-foreground transition-colors hover:bg-cta-hover disabled:opacity-60"
            >
              {createInvoice.isPending ? "Creating..." : "Create Invoice"}
            </button>
          </footer>
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
