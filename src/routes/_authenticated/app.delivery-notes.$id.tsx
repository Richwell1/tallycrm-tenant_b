import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CardSkeleton, ErrorState } from "@/components/common";
import { PageHeader, ToolbarButton } from "@/components/layout";
import { DeliveryNoteItemsEditor } from "@/components/delivery-notes/DeliveryNoteItemsEditor";
import { DeliveryNoteStatusBadge } from "@/components/delivery-notes/DeliveryNoteStatusBadge";
import {
  useDeleteDeliveryNote,
  useDeliveryNote,
  useUpdateDeliveryNote,
  useUpdateDeliveryNoteStatus,
} from "@/lib/delivery-notes-data";
import { formatDateOnly, formatRelative } from "@/lib/format";
import { useQuoteFormOptions } from "@/lib/quotes-data";

export const Route = createFileRoute("/_authenticated/app/delivery-notes/$id")({
  component: DeliveryNoteDetailPage,
});

function DeliveryNoteDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: note, isLoading, isError, error, refetch } = useDeliveryNote(id);
  const { data: options } = useQuoteFormOptions();
  const update = useUpdateDeliveryNote();
  const updateStatus = useUpdateDeliveryNoteStatus();
  const remove = useDeleteDeliveryNote();
  const [deliveryDate, setDeliveryDate] = useState("");
  const [recipient, setRecipient] = useState("");
  const [address, setAddress] = useState("");
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  const [notes, setNotes] = useState("");
  const [itemsDirty, setItemsDirty] = useState(false);
  const dirtyChanged = useCallback((dirty: boolean) => setItemsDirty(dirty), []);
  useEffect(() => {
    if (note) {
      setDeliveryDate(note.delivery_date);
      setRecipient(note.recipient_name ?? "");
      setAddress(note.delivery_address ?? "");
      setCarrier(note.carrier ?? "");
      setTracking(note.tracking_reference ?? "");
      setNotes(note.notes ?? "");
    }
  }, [note]);
  if (isLoading) return <CardSkeleton />;
  if (isError || !note)
    return (
      <ErrorState
        description={(error as Error)?.message ?? "Could not load this delivery note"}
        onRetry={() => refetch()}
      />
    );
  const locked = note.status === "delivered" || note.status === "cancelled";
  async function changeStatus(status: "dispatched" | "delivered" | "cancelled") {
    if (itemsDirty) return void toast.error("Save item changes first");
    try {
      await updateStatus.mutateAsync({ id, status });
      toast.success("Delivery note updated");
    } catch (err) {
      toast.error("Could not update the delivery note", { description: (err as Error).message });
    }
  }
  async function saveDetails() {
    try {
      await update.mutateAsync({
        id,
        patch: {
          delivery_date: deliveryDate,
          recipient_name: recipient.trim() || null,
          delivery_address: address.trim() || null,
          carrier: carrier.trim() || null,
          tracking_reference: tracking.trim() || null,
          notes: notes.trim() || null,
        },
      });
      toast.success("Delivery details saved");
    } catch (err) {
      toast.error("Could not save delivery details", { description: (err as Error).message });
    }
  }
  async function archive() {
    if (!window.confirm(`Archive delivery note ${note!.delivery_note_number}?`)) return;
    try {
      await remove.mutateAsync(id);
      navigate({ to: "/app/delivery-notes" });
    } catch (err) {
      toast.error("Could not archive the delivery note", { description: (err as Error).message });
    }
  }
  return (
    <>
      <PageHeader
        title={`Delivery note ${note.delivery_note_number}`}
        breadcrumbs={[
          { label: "Delivery Notes", to: "/app/delivery-notes" },
          { label: note.delivery_note_number },
        ]}
        actions={
          <>
            <Link
              to="/app/delivery-notes/print/$id"
              params={{ id }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[13px] font-semibold"
            >
              <span className="material-symbols-outlined text-[18px]">print</span>Print / PDF
            </Link>
            {note.status === "draft" ? (
              <ToolbarButton
                icon="local_shipping"
                variant="cta"
                disabled={itemsDirty}
                onClick={() => void changeStatus("dispatched")}
              >
                Dispatch
              </ToolbarButton>
            ) : null}
            {note.status === "dispatched" ? (
              <>
                <ToolbarButton
                  icon="task_alt"
                  variant="cta"
                  onClick={() => void changeStatus("delivered")}
                >
                  Mark delivered
                </ToolbarButton>
                <ToolbarButton icon="cancel" onClick={() => void changeStatus("cancelled")}>
                  Cancel
                </ToolbarButton>
              </>
            ) : null}
            <ToolbarButton icon="delete" onClick={archive}>
              Archive
            </ToolbarButton>
          </>
        }
      />
      <div className="mb-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-xl border border-border bg-card px-6 py-5">
          <div className="flex justify-between">
            <div>
              <p className="font-mono text-xs text-text-muted">{note.delivery_note_number}</p>
              <p className="mt-1 text-[18px] font-semibold">
                {note.recipient_name || note.company?.name || "No recipient"}
              </p>
            </div>
            <DeliveryNoteStatusBadge status={note.status} />
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Info label="Delivery date" value={formatDateOnly(note.delivery_date)} />
            <Info label="Carrier" value={note.carrier || "—"} />
            <Info label="Tracking" value={note.tracking_reference || "—"} />
            <Info label="Items" value={String(note.item_count)} />
          </dl>
          {note.invoice ? (
            <p className="mt-5 rounded-lg border border-border bg-muted px-4 py-3 text-sm">
              Against invoice{" "}
              <Link
                to="/app/invoices/$id"
                params={{ id: note.invoice.id }}
                className="font-semibold text-primary"
              >
                {note.invoice.invoice_number}
              </Link>
            </p>
          ) : null}
        </section>
        <section className="rounded-xl border border-border bg-card px-6 py-5">
          <h2 className="text-[15px] font-semibold">Delivery details</h2>
          <div className="mt-4 space-y-3">
            <input
              type="date"
              value={deliveryDate}
              disabled={locked}
              onChange={(event) => setDeliveryDate(event.target.value)}
              className="deal-input"
            />
            <input
              value={recipient}
              disabled={locked}
              onChange={(event) => setRecipient(event.target.value)}
              placeholder="Recipient name"
              className="deal-input"
            />
            <textarea
              value={address}
              disabled={locked}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="Delivery address"
              className="min-h-16 w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
            <input
              value={carrier}
              disabled={locked}
              onChange={(event) => setCarrier(event.target.value)}
              placeholder="Carrier"
              className="deal-input"
            />
            <input
              value={tracking}
              disabled={locked}
              onChange={(event) => setTracking(event.target.value)}
              placeholder="Tracking reference"
              className="deal-input"
            />
            <textarea
              value={notes}
              disabled={locked}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Notes"
              className="min-h-16 w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
            {!locked ? (
              <button
                type="button"
                onClick={saveDetails}
                className="w-full rounded-lg bg-cta px-4 py-2 text-xs font-semibold text-cta-foreground"
              >
                Save details
              </button>
            ) : null}
          </div>
        </section>
      </div>
      <DeliveryNoteItemsEditor
        deliveryNote={note}
        catalog={options?.catalog ?? []}
        readOnly={locked}
        onDirtyChange={dirtyChanged}
      />
      {note.status_history.length ? (
        <section className="mt-6 rounded-xl border border-border bg-card">
          <header className="border-b border-border px-6 py-4">
            <h2 className="font-semibold">Status history</h2>
          </header>
          <ul className="divide-y divide-border">
            {note.status_history.map((entry) => (
              <li key={entry.id} className="flex justify-between px-6 py-3 text-sm">
                <span>
                  {entry.from_status ? `${entry.from_status} → ` : ""}
                  <strong>{entry.to_status}</strong>
                </span>
                <span className="text-xs text-text-muted">{formatRelative(entry.changed_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase text-text-secondary">{label}</dt>
      <dd className="mt-0.5 font-semibold">{value}</dd>
    </div>
  );
}
