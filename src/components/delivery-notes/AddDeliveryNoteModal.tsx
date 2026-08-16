import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useModalA11y } from "@/components/common/use-modal-a11y";
import { useCreateDeliveryNote } from "@/lib/delivery-notes-data";
import { useQuoteFormOptions } from "@/lib/quotes-data";

export function AddDeliveryNoteModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: options } = useQuoteFormOptions();
  const create = useCreateDeliveryNote();
  const navigate = useNavigate();
  const modal = useModalA11y(open, onOpenChange, { disabled: create.isPending });
  const [companyId, setCompanyId] = useState("");
  const [contactId, setContactId] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().slice(0, 10));
  const [recipientName, setRecipientName] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [carrier, setCarrier] = useState("");
  const [trackingReference, setTrackingReference] = useState("");
  const [notes, setNotes] = useState("");
  useEffect(() => {
    const contact = options?.contacts.find((item) => item.id === contactId);
    if (!contact) return;
    setRecipientName((value) => value || `${contact.first_name} ${contact.last_name}`.trim());
    if (contact.company_id) setCompanyId((value) => value || contact.company_id || "");
  }, [contactId, options]);
  useEffect(() => {
    const company = options?.companies.find((item) => item.id === companyId);
    if (!company) return;
    setRecipientName((value) => value || company.name);
    setDeliveryAddress((value) => value || company.address || "");
  }, [companyId, options]);
  if (!open) return null;
  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const note = await create.mutateAsync({
        company_id: companyId || null,
        contact_id: contactId || null,
        delivery_date: deliveryDate,
        recipient_name: recipientName,
        delivery_address: deliveryAddress,
        carrier,
        tracking_reference: trackingReference,
        notes,
      });
      toast.success(`Delivery note ${note.delivery_note_number} created`);
      onOpenChange(false);
      navigate({ to: "/app/delivery-notes/$id", params: { id: note.id } });
    } catch (error) {
      toast.error("Could not create the delivery note", { description: (error as Error).message });
    }
  }
  const field = "deal-input";
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/60 p-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-delivery-note-title"
      ref={modal.ref}
      onKeyDown={modal.onKeyDown}
    >
      <div className="flex max-h-[90vh] w-full max-w-[680px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <header className="border-b border-border bg-muted px-8 py-6">
          <h2 id="add-delivery-note-title" className="text-[22px] font-semibold">
            New Delivery Note
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Create a draft, then add the items being dispatched.
          </p>
        </header>
        <form onSubmit={submit} className="flex-1 space-y-5 overflow-y-auto px-8 py-8">
          <div className="grid gap-5 sm:grid-cols-2">
            <Label text="Company">
              <select
                value={companyId}
                onChange={(event) => setCompanyId(event.target.value)}
                className={`${field} appearance-none`}
              >
                <option value="">Select company...</option>
                {(options?.companies ?? []).map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </Label>
            <Label text="Contact">
              <select
                value={contactId}
                onChange={(event) => setContactId(event.target.value)}
                className={`${field} appearance-none`}
              >
                <option value="">Select contact...</option>
                {(options?.contacts ?? []).map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.first_name} {contact.last_name}
                  </option>
                ))}
              </select>
            </Label>
          </div>
          <Label text="Delivery date">
            <input
              type="date"
              required
              value={deliveryDate}
              onChange={(event) => setDeliveryDate(event.target.value)}
              className={field}
            />
          </Label>
          <Label text="Recipient name">
            <input
              value={recipientName}
              onChange={(event) => setRecipientName(event.target.value)}
              className={field}
            />
          </Label>
          <Label text="Delivery address">
            <textarea
              value={deliveryAddress}
              onChange={(event) => setDeliveryAddress(event.target.value)}
              className="min-h-20 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
            />
          </Label>
          <div className="grid gap-5 sm:grid-cols-2">
            <Label text="Carrier">
              <input
                value={carrier}
                onChange={(event) => setCarrier(event.target.value)}
                className={field}
              />
            </Label>
            <Label text="Tracking reference">
              <input
                value={trackingReference}
                onChange={(event) => setTrackingReference(event.target.value)}
                className={field}
              />
            </Label>
          </div>
          <Label text="Notes">
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="min-h-16 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
            />
          </Label>
          <div className="flex justify-end gap-4 border-t border-border pt-6">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg border border-border px-6 py-2 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={create.isPending}
              className="rounded-lg bg-cta px-6 py-2 text-xs font-semibold text-cta-foreground disabled:opacity-60"
            >
              {create.isPending ? "Creating..." : "Create delivery note"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
        {text}
      </span>
      {children}
    </label>
  );
}
