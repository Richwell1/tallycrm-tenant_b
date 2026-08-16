import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common";
import { CrmToolbar, PageHeader, ToolbarButton } from "@/components/layout";
import { AddDeliveryNoteModal } from "@/components/delivery-notes/AddDeliveryNoteModal";
import { DeliveryNoteFromInvoiceModal } from "@/components/delivery-notes/DeliveryNoteFromInvoiceModal";
import { DeliveryNoteStatusBadge } from "@/components/delivery-notes/DeliveryNoteStatusBadge";
import { deliveryNoteClientName, useDeliveryNotes } from "@/lib/delivery-notes-data";
import { formatDateOnly } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/delivery-notes/")({
  component: DeliveryNotesIndex,
});

function DeliveryNotesIndex() {
  const { data, isLoading, isError, error, refetch } = useDeliveryNotes();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [fromInvoiceOpen, setFromInvoiceOpen] = useState(false);
  const notes = useMemo(
    () =>
      (data ?? []).filter((note) => {
        const query = search.trim().toLowerCase();
        return (
          (status === "all" || note.status === status) &&
          (!query ||
            [
              note.delivery_note_number,
              note.invoice?.invoice_number,
              deliveryNoteClientName(note),
              note.carrier,
              note.tracking_reference,
            ]
              .filter(Boolean)
              .some((value) => value!.toLowerCase().includes(query)))
        );
      }),
    [data, search, status],
  );
  return (
    <>
      <PageHeader
        title="Delivery Notes"
        count={data?.length}
        actions={
          <>
            <ToolbarButton icon="refresh" onClick={() => refetch()}>
              Refresh
            </ToolbarButton>
            <ToolbarButton icon="receipt_long" onClick={() => setFromInvoiceOpen(true)}>
              From Invoice
            </ToolbarButton>
            <ToolbarButton icon="post_add" variant="cta" onClick={() => setAddOpen(true)}>
              New Delivery Note
            </ToolbarButton>
          </>
        }
      />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat
          label="Drafts"
          value={notes.filter((note) => note.status === "draft").length}
          icon="edit_note"
        />
        <Stat
          label="Dispatched"
          value={notes.filter((note) => note.status === "dispatched").length}
          icon="local_shipping"
        />
        <Stat
          label="Delivered"
          value={notes.filter((note) => note.status === "delivered").length}
          icon="task_alt"
        />
      </div>
      <CrmToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by delivery note, invoice, recipient, carrier, or tracking..."
        filters={[
          {
            label: "Status",
            value: status,
            onChange: setStatus,
            options: [
              { value: "draft", label: "Draft" },
              { value: "dispatched", label: "Dispatched" },
              { value: "delivered", label: "Delivered" },
              { value: "cancelled", label: "Cancelled" },
            ],
          },
        ]}
      />
      {isLoading ? (
        <TableSkeleton rows={6} />
      ) : isError ? (
        <ErrorState
          description={(error as Error)?.message ?? "Could not load delivery notes"}
          onRetry={() => refetch()}
        />
      ) : !data?.length ? (
        <EmptyState
          icon={<span className="material-symbols-outlined text-[28px]">local_shipping</span>}
          title="No delivery notes yet"
          description="Create one from an invoice to record what was dispatched."
          action={
            <button
              onClick={() => setFromInvoiceOpen(true)}
              className="rounded-lg bg-cta px-4 py-2 text-sm font-semibold text-cta-foreground"
            >
              Create from Invoice
            </button>
          }
        />
      ) : !notes.length ? (
        <EmptyState
          icon={<span className="material-symbols-outlined text-[28px]">search_off</span>}
          title="No delivery notes match your filters"
          description="Adjust the search or status filter."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted text-[11px] uppercase text-text-secondary">
                  <th className="px-4 py-3 text-left">Delivery note</th>
                  <th className="px-4 py-3 text-left">Recipient</th>
                  <th className="px-4 py-3 text-left">Invoice</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Delivery date</th>
                  <th className="px-4 py-3 text-right">Items</th>
                </tr>
              </thead>
              <tbody>
                {notes.map((note) => (
                  <tr key={note.id} className="border-b border-border/70 hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <Link
                        to="/app/delivery-notes/$id"
                        params={{ id: note.id }}
                        className="font-semibold hover:text-primary"
                      >
                        {note.delivery_note_number}
                      </Link>
                      <p className="text-[11px] text-text-muted">
                        {note.tracking_reference || note.carrier || "No tracking details"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {deliveryNoteClientName(note)}
                    </td>
                    <td className="px-4 py-3">
                      {note.invoice ? (
                        <Link
                          to="/app/invoices/$id"
                          params={{ id: note.invoice.id }}
                          className="font-mono text-xs font-semibold text-primary"
                        >
                          {note.invoice.invoice_number}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <DeliveryNoteStatusBadge status={note.status} />
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {formatDateOnly(note.delivery_date)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{note.item_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <AddDeliveryNoteModal open={addOpen} onOpenChange={setAddOpen} />
      <DeliveryNoteFromInvoiceModal open={fromInvoiceOpen} onOpenChange={setFromInvoiceOpen} />
    </>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <span className="material-symbols-outlined text-primary">{icon}</span>
      <div>
        <p className="text-[11px] font-semibold uppercase text-text-secondary">{label}</p>
        <p className="text-[16px] font-semibold">{value}</p>
      </div>
    </div>
  );
}
