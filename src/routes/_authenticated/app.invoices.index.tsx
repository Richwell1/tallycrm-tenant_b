import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common";
import { CrmToolbar, PageHeader, ToolbarButton } from "@/components/layout";
import { AddInvoiceModal } from "@/components/invoices/AddInvoiceModal";
import { InvoiceFromQuoteModal } from "@/components/invoices/InvoiceFromQuoteModal";
import { InvoiceStatusBadge } from "@/components/invoices/InvoiceStatusBadge";
import { formatDateOnly, formatMoney } from "@/lib/format";
import {
  effectiveInvoiceStatus,
  invoiceBalance,
  invoiceClientName,
  useInvoices,
} from "@/lib/invoices-data";

export const Route = createFileRoute("/_authenticated/app/invoices/")({
  component: InvoicesIndex,
});

type InvoiceSort = "recent" | "value" | "due" | "client";

function InvoicesIndex() {
  const { data, isLoading, isError, error, refetch } = useInvoices();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<InvoiceSort>("recent");
  const [addOpen, setAddOpen] = useState(false);
  const [fromQuoteOpen, setFromQuoteOpen] = useState(false);

  const invoices = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = (data ?? []).filter((invoice) => {
      const status = effectiveInvoiceStatus(
        invoice.status,
        invoice.due_date,
        invoice.amount_paid,
        invoice.total,
      );
      const statusMatch = statusFilter === "all" || status === statusFilter;
      const searchMatch =
        !query ||
        [
          invoice.invoice_number,
          invoice.title,
          invoiceClientName(invoice),
          invoice.quote?.quote_number,
          invoice.assigned_rep?.full_name,
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(query));
      return statusMatch && searchMatch;
    });

    return list.sort((a, b) => {
      if (sortKey === "value") return Number(b.total ?? 0) - Number(a.total ?? 0);
      if (sortKey === "due") return rank(a.due_date) - rank(b.due_date);
      if (sortKey === "client") return invoiceClientName(a).localeCompare(invoiceClientName(b));
      return rank(b.created_at) - rank(a.created_at);
    });
  }, [data, search, sortKey, statusFilter]);

  const outstanding = invoices
    .filter((invoice) => invoice.status !== "paid" && invoice.status !== "cancelled")
    .reduce((sum, invoice) => sum + invoiceBalance(invoice), 0);
  const collected = invoices.reduce((sum, invoice) => sum + Number(invoice.amount_paid ?? 0), 0);
  const overdueCount = invoices.filter(
    (invoice) =>
      effectiveInvoiceStatus(
        invoice.status,
        invoice.due_date,
        invoice.amount_paid,
        invoice.total,
      ) === "overdue",
  ).length;
  const currency = invoices[0]?.currency ?? "GHS";

  return (
    <>
      <PageHeader
        title="Invoices"
        count={data?.length}
        actions={
          <>
            <ToolbarButton icon="refresh" onClick={() => refetch()}>
              Refresh
            </ToolbarButton>
            <ToolbarButton icon="request_quote" onClick={() => setFromQuoteOpen(true)}>
              From Quotation
            </ToolbarButton>
            <ToolbarButton icon="add" variant="cta" onClick={() => setAddOpen(true)}>
              New Invoice
            </ToolbarButton>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          label="Outstanding"
          value={formatMoney(outstanding, currency)}
          icon="account_balance_wallet"
        />
        <StatTile label="Collected" value={formatMoney(collected, currency)} icon="payments" />
        <StatTile label="Overdue" value={String(overdueCount)} icon="schedule" />
      </div>

      <CrmToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by number, title, or customer..."
        filters={[
          {
            label: "Status",
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: "draft", label: "Draft" },
              { value: "sent", label: "Sent" },
              { value: "partially_paid", label: "Partially Paid" },
              { value: "paid", label: "Paid" },
              { value: "overdue", label: "Overdue" },
              { value: "cancelled", label: "Cancelled" },
            ],
          },
        ]}
        sort={{
          value: sortKey,
          onChange: (value) => setSortKey(value as InvoiceSort),
          options: [
            { value: "recent", label: "Recently created" },
            { value: "value", label: "Total value" },
            { value: "due", label: "Due first" },
            { value: "client", label: "Customer name" },
          ],
        }}
      />

      {isLoading ? (
        <TableSkeleton rows={6} />
      ) : isError ? (
        <ErrorState
          description={(error as Error)?.message ?? "Could not load invoices"}
          onRetry={() => refetch()}
        />
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<span className="material-symbols-outlined text-[28px]">receipt_long</span>}
          title="No invoices yet"
          description="Raise an invoice from an accepted quotation, or bill a customer directly."
          action={
            <button
              onClick={() => setFromQuoteOpen(true)}
              className="rounded-lg bg-cta px-4 py-2 text-sm font-semibold text-cta-foreground"
            >
              From Quotation
            </button>
          }
        />
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={<span className="material-symbols-outlined text-[28px]">search_off</span>}
          title="No invoices match your filters"
          description="Adjust the search or status filter to widen the result set."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted text-[11px] uppercase tracking-wide text-text-secondary">
                  <th className="px-4 py-3 text-left font-semibold">Invoice</th>
                  <th className="px-4 py-3 text-left font-semibold">Customer</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-left font-semibold">Due</th>
                  <th className="px-4 py-3 text-right font-semibold">Balance</th>
                  <th className="px-4 py-3 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-border/70 hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <Link
                        to="/app/invoices/$id"
                        params={{ id: invoice.id }}
                        className="font-semibold text-foreground hover:text-primary"
                      >
                        {invoice.title}
                      </Link>
                      <p className="font-mono text-[11px] text-text-muted">
                        {invoice.invoice_number}
                        {invoice.quote?.quote_number
                          ? ` · from ${invoice.quote.quote_number}`
                          : ""}{" "}
                        · {invoice.line_count} {invoice.line_count === 1 ? "item" : "items"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{invoiceClientName(invoice)}</td>
                    <td className="px-4 py-3">
                      <InvoiceStatusBadge
                        status={invoice.status}
                        dueDate={invoice.due_date}
                        amountPaid={invoice.amount_paid}
                        total={invoice.total}
                      />
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {formatDateOnly(invoice.due_date)}
                    </td>
                    <td className="px-4 py-3 text-right text-text-secondary">
                      {formatMoney(invoiceBalance(invoice), invoice.currency)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">
                      {formatMoney(Number(invoice.total), invoice.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AddInvoiceModal open={addOpen} onOpenChange={setAddOpen} />
      <InvoiceFromQuoteModal open={fromQuoteOpen} onOpenChange={setFromQuoteOpen} />
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
