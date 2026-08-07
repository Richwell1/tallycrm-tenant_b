import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common";
import { CrmToolbar, PageHeader, ToolbarButton } from "@/components/layout";
import { AddReceiptModal } from "@/components/receipts/AddReceiptModal";
import { ReceiptStatusBadge } from "@/components/receipts/ReceiptStatusBadge";
import { formatDateOnly, formatMoney } from "@/lib/format";
import { receiptClientName, useReceipts } from "@/lib/receipts-data";

export const Route = createFileRoute("/_authenticated/app/receipts/")({
  component: ReceiptsIndex,
});

type ReceiptSort = "recent" | "value" | "client";

function ReceiptsIndex() {
  const { data, isLoading, isError, error, refetch } = useReceipts();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<ReceiptSort>("recent");
  const [addOpen, setAddOpen] = useState(false);

  const receipts = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = (data ?? []).filter((receipt) => {
      const searchMatch =
        !query ||
        [
          receipt.receipt_number,
          receipt.invoice?.invoice_number,
          receipt.reference,
          receiptClientName(receipt),
          receipt.issued_rep?.full_name,
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(query));
      return (statusFilter === "all" || receipt.status === statusFilter) && searchMatch;
    });

    return list.sort((a, b) => {
      if (sortKey === "value") return Number(b.amount ?? 0) - Number(a.amount ?? 0);
      if (sortKey === "client") return receiptClientName(a).localeCompare(receiptClientName(b));
      return rank(b.payment_date) - rank(a.payment_date) || rank(b.created_at) - rank(a.created_at);
    });
  }, [data, search, sortKey, statusFilter]);

  const issued = receipts.filter((receipt) => receipt.status === "issued");
  const received = issued.reduce((sum, receipt) => sum + Number(receipt.amount ?? 0), 0);
  const currency = issued[0]?.currency ?? "GHS";

  return (
    <>
      <PageHeader
        title="Receipts"
        count={data?.length}
        actions={
          <>
            <ToolbarButton icon="refresh" onClick={() => refetch()}>
              Refresh
            </ToolbarButton>
            <ToolbarButton icon="payments" variant="cta" onClick={() => setAddOpen(true)}>
              Record Payment
            </ToolbarButton>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Received" value={formatMoney(received, currency)} icon="payments" />
        <StatTile label="Issued" value={String(issued.length)} icon="verified" />
        <StatTile
          label="Void"
          value={String(receipts.filter((receipt) => receipt.status === "void").length)}
          icon="block"
        />
      </div>

      <CrmToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by receipt, invoice, customer, or reference..."
        filters={[
          {
            label: "Status",
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: "issued", label: "Issued" },
              { value: "void", label: "Void" },
            ],
          },
        ]}
        sort={{
          value: sortKey,
          onChange: (value) => setSortKey(value as ReceiptSort),
          options: [
            { value: "recent", label: "Recently paid" },
            { value: "value", label: "Payment value" },
            { value: "client", label: "Customer name" },
          ],
        }}
      />

      {isLoading ? (
        <TableSkeleton rows={6} />
      ) : isError ? (
        <ErrorState
          description={(error as Error)?.message ?? "Could not load receipts"}
          onRetry={() => refetch()}
        />
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<span className="material-symbols-outlined text-[28px]">payments</span>}
          title="No receipts yet"
          description="Record an invoice payment to issue the first receipt."
          action={
            <button
              onClick={() => setAddOpen(true)}
              className="rounded-lg bg-cta px-4 py-2 text-sm font-semibold text-cta-foreground"
            >
              Record Payment
            </button>
          }
        />
      ) : receipts.length === 0 ? (
        <EmptyState
          icon={<span className="material-symbols-outlined text-[28px]">search_off</span>}
          title="No receipts match your filters"
          description="Adjust the search or status filter to widen the result set."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted text-[11px] uppercase tracking-wide text-text-secondary">
                  <th className="px-4 py-3 text-left font-semibold">Receipt</th>
                  <th className="px-4 py-3 text-left font-semibold">Customer</th>
                  <th className="px-4 py-3 text-left font-semibold">Invoice</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-left font-semibold">Paid</th>
                  <th className="px-4 py-3 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((receipt) => (
                  <tr key={receipt.id} className="border-b border-border/70 hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <Link
                        to="/app/receipts/$id"
                        params={{ id: receipt.id }}
                        className="font-semibold text-foreground hover:text-primary"
                      >
                        {receipt.receipt_number}
                      </Link>
                      <p className="text-[11px] text-text-muted">
                        {receipt.payment_method}
                        {receipt.reference ? ` · ${receipt.reference}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{receiptClientName(receipt)}</td>
                    <td className="px-4 py-3">
                      {receipt.invoice ? (
                        <Link
                          to="/app/invoices/$id"
                          params={{ id: receipt.invoice.id }}
                          className="font-mono text-xs font-semibold text-primary hover:underline"
                        >
                          {receipt.invoice.invoice_number}
                        </Link>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ReceiptStatusBadge status={receipt.status} />
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {formatDateOnly(receipt.payment_date)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">
                      {formatMoney(Number(receipt.amount), receipt.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AddReceiptModal open={addOpen} onOpenChange={setAddOpen} />
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
