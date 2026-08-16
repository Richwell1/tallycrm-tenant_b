import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common";
import { CrmToolbar, PageHeader, ToolbarButton } from "@/components/layout";
import { AddCreditNoteModal } from "@/components/credit-notes/AddCreditNoteModal";
import { CreditNoteFromInvoiceModal } from "@/components/credit-notes/CreditNoteFromInvoiceModal";
import { CreditNoteStatusBadge } from "@/components/credit-notes/CreditNoteStatusBadge";
import { formatDateOnly, formatMoney } from "@/lib/format";
import { creditNoteClientName, useCreditNotes } from "@/lib/credit-notes-data";

export const Route = createFileRoute("/_authenticated/app/credit-notes/")({
  component: CreditNotesIndex,
});

type CreditNoteSort = "recent" | "value" | "client";

function CreditNotesIndex() {
  const { data, isLoading, isError, error, refetch } = useCreditNotes();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<CreditNoteSort>("recent");
  const [addOpen, setAddOpen] = useState(false);
  const [fromInvoiceOpen, setFromInvoiceOpen] = useState(false);

  const creditNotes = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = (data ?? []).filter((note) => {
      const searchMatch =
        !query ||
        [
          note.credit_note_number,
          note.invoice?.invoice_number,
          note.reason,
          creditNoteClientName(note),
          note.assigned_rep?.full_name,
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(query));
      return (statusFilter === "all" || note.status === statusFilter) && searchMatch;
    });

    return list.sort((a, b) => {
      if (sortKey === "value") return Number(b.total ?? 0) - Number(a.total ?? 0);
      if (sortKey === "client")
        return creditNoteClientName(a).localeCompare(creditNoteClientName(b));
      return rank(b.issue_date) - rank(a.issue_date) || rank(b.created_at) - rank(a.created_at);
    });
  }, [data, search, sortKey, statusFilter]);

  const live = creditNotes.filter((note) => note.status !== "void");
  const credited = live.reduce((sum, note) => sum + Number(note.total ?? 0), 0);
  const currency = live[0]?.currency ?? "GHS";

  return (
    <>
      <PageHeader
        title="Credit Notes"
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
              New Credit Note
            </ToolbarButton>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Credited" value={formatMoney(credited, currency)} icon="credit_score" />
        <StatTile
          label="Drafts"
          value={String(creditNotes.filter((note) => note.status === "draft").length)}
          icon="edit_note"
        />
        <StatTile
          label="Void"
          value={String(creditNotes.filter((note) => note.status === "void").length)}
          icon="block"
        />
      </div>

      <CrmToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by credit note, invoice, customer, or reason..."
        filters={[
          {
            label: "Status",
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: "draft", label: "Draft" },
              { value: "issued", label: "Issued" },
              { value: "applied", label: "Applied" },
              { value: "void", label: "Void" },
            ],
          },
        ]}
        sort={{
          value: sortKey,
          onChange: (value) => setSortKey(value as CreditNoteSort),
          options: [
            { value: "recent", label: "Recently issued" },
            { value: "value", label: "Credit value" },
            { value: "client", label: "Customer name" },
          ],
        }}
      />

      {isLoading ? (
        <TableSkeleton rows={6} />
      ) : isError ? (
        <ErrorState
          description={(error as Error)?.message ?? "Could not load credit notes"}
          onRetry={() => refetch()}
        />
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<span className="material-symbols-outlined text-[28px]">credit_score</span>}
          title="No credit notes yet"
          description="Credit an invoice to reverse a returned licence, an overcharge, or a cancelled line."
          action={
            <button
              onClick={() => setFromInvoiceOpen(true)}
              className="rounded-lg bg-cta px-4 py-2 text-sm font-semibold text-cta-foreground"
            >
              Credit an Invoice
            </button>
          }
        />
      ) : creditNotes.length === 0 ? (
        <EmptyState
          icon={<span className="material-symbols-outlined text-[28px]">search_off</span>}
          title="No credit notes match your filters"
          description="Adjust the search or status filter to widen the result set."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted text-[11px] uppercase tracking-wide text-text-secondary">
                  <th className="px-4 py-3 text-left font-semibold">Credit note</th>
                  <th className="px-4 py-3 text-left font-semibold">Customer</th>
                  <th className="px-4 py-3 text-left font-semibold">Invoice</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-left font-semibold">Issued</th>
                  <th className="px-4 py-3 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {creditNotes.map((note) => (
                  <tr key={note.id} className="border-b border-border/70 hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <Link
                        to="/app/credit-notes/$id"
                        params={{ id: note.id }}
                        className="font-semibold text-foreground hover:text-primary"
                      >
                        {note.credit_note_number}
                      </Link>
                      <p className="text-[11px] text-text-muted">
                        {note.line_count} {note.line_count === 1 ? "item" : "items"}
                        {note.reason ? ` · ${note.reason}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{creditNoteClientName(note)}</td>
                    <td className="px-4 py-3">
                      {note.invoice ? (
                        <Link
                          to="/app/invoices/$id"
                          params={{ id: note.invoice.id }}
                          className="font-mono text-xs font-semibold text-primary hover:underline"
                        >
                          {note.invoice.invoice_number}
                        </Link>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <CreditNoteStatusBadge status={note.status} />
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {formatDateOnly(note.issue_date)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">
                      {formatMoney(Number(note.total), note.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AddCreditNoteModal open={addOpen} onOpenChange={setAddOpen} />
      <CreditNoteFromInvoiceModal open={fromInvoiceOpen} onOpenChange={setFromInvoiceOpen} />
    </>
  );
}

function StatTile({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-light text-primary">
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
      </span>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
          {label}
        </p>
        <p className="text-[16px] font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}

function rank(value: string | null | undefined) {
  return value ? new Date(value).getTime() : 0;
}
