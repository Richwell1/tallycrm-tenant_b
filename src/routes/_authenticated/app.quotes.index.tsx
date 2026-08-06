import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common";
import { CrmToolbar, PageHeader, ToolbarButton } from "@/components/layout";
import { AddQuoteModal } from "@/components/quotes/AddQuoteModal";
import { QuoteStatusBadge } from "@/components/quotes/QuoteStatusBadge";
import { formatDateOnly, formatMoney } from "@/lib/format";
import { effectiveQuoteStatus } from "@/lib/quote-totals";
import { quoteClientName, useQuotes } from "@/lib/quotes-data";

export const Route = createFileRoute("/_authenticated/app/quotes/")({
  component: QuotesIndex,
});

type QuoteSort = "recent" | "value" | "validity" | "client";

function QuotesIndex() {
  const { data, isLoading, isError, error, refetch } = useQuotes();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<QuoteSort>("recent");
  const [addOpen, setAddOpen] = useState(false);

  const quotes = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = (data ?? []).filter((quote) => {
      const status = effectiveQuoteStatus(quote.status, quote.valid_until);
      const statusMatch = statusFilter === "all" || status === statusFilter;
      const searchMatch =
        !query ||
        [
          quote.quote_number,
          quote.title,
          quoteClientName(quote),
          quote.assigned_rep?.full_name,
          quote.deal?.name,
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(query));
      return statusMatch && searchMatch;
    });

    return list.sort((a, b) => {
      if (sortKey === "value") return Number(b.total ?? 0) - Number(a.total ?? 0);
      if (sortKey === "validity") return rank(a.valid_until) - rank(b.valid_until);
      if (sortKey === "client") return quoteClientName(a).localeCompare(quoteClientName(b));
      return rank(b.created_at) - rank(a.created_at);
    });
  }, [data, search, sortKey, statusFilter]);

  const pipelineValue = quotes
    .filter((quote) => effectiveQuoteStatus(quote.status, quote.valid_until) === "sent")
    .reduce((sum, quote) => sum + Number(quote.total ?? 0), 0);
  const acceptedValue = quotes
    .filter((quote) => quote.status === "accepted")
    .reduce((sum, quote) => sum + Number(quote.total ?? 0), 0);
  const currency = quotes[0]?.currency ?? "GHS";

  return (
    <>
      <PageHeader
        title="Quotations"
        count={data?.length}
        actions={
          <>
            <Link
              to="/app/quotes/catalog"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[13px] font-semibold hover:bg-surface-hover"
            >
              <span className="material-symbols-outlined text-[18px]">inventory_2</span>
              Catalog
            </Link>
            <ToolbarButton icon="refresh" onClick={() => refetch()}>
              Refresh
            </ToolbarButton>
            <ToolbarButton icon="add" variant="cta" onClick={() => setAddOpen(true)}>
              New Quote
            </ToolbarButton>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          label="Awaiting decision"
          value={formatMoney(pipelineValue, currency)}
          icon="hourglass_top"
        />
        <StatTile label="Accepted" value={formatMoney(acceptedValue, currency)} icon="task_alt" />
        <StatTile label="Documents" value={String(data?.length ?? 0)} icon="request_quote" />
      </div>

      <CrmToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by number, title, or client..."
        filters={[
          {
            label: "Status",
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: "draft", label: "Draft" },
              { value: "sent", label: "Sent" },
              { value: "accepted", label: "Accepted" },
              { value: "rejected", label: "Rejected" },
              { value: "expired", label: "Expired" },
            ],
          },
        ]}
        sort={{
          value: sortKey,
          onChange: (value) => setSortKey(value as QuoteSort),
          options: [
            { value: "recent", label: "Recently created" },
            { value: "value", label: "Total value" },
            { value: "validity", label: "Expiring first" },
            { value: "client", label: "Client name" },
          ],
        }}
      />

      {isLoading ? (
        <TableSkeleton rows={6} />
      ) : isError ? (
        <ErrorState
          description={(error as Error)?.message ?? "Could not load quotations"}
          onRetry={() => refetch()}
        />
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<span className="material-symbols-outlined text-[28px]">request_quote</span>}
          title="No quotations yet"
          description="Build a priced document for a client and track it through to an accepted deal."
          action={
            <button
              onClick={() => setAddOpen(true)}
              className="rounded-lg bg-cta px-4 py-2 text-sm font-semibold text-cta-foreground"
            >
              New Quote
            </button>
          }
        />
      ) : quotes.length === 0 ? (
        <EmptyState
          icon={<span className="material-symbols-outlined text-[28px]">search_off</span>}
          title="No quotations match your filters"
          description="Adjust the search or status filter to widen the result set."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted text-[11px] uppercase tracking-wide text-text-secondary">
                  <th className="px-4 py-3 text-left font-semibold">Quote</th>
                  <th className="px-4 py-3 text-left font-semibold">Client</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-left font-semibold">Valid until</th>
                  <th className="px-4 py-3 text-left font-semibold">Owner</th>
                  <th className="px-4 py-3 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((quote) => (
                  <tr key={quote.id} className="border-b border-border/70 hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <Link
                        to="/app/quotes/$id"
                        params={{ id: quote.id }}
                        className="font-semibold text-foreground hover:text-primary"
                      >
                        {quote.title}
                      </Link>
                      <p className="font-mono text-[11px] text-text-muted">
                        {quote.quote_number}
                        {quote.version > 1 ? ` · rev ${quote.version}` : ""} · {quote.line_count}{" "}
                        {quote.line_count === 1 ? "line" : "lines"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{quoteClientName(quote)}</td>
                    <td className="px-4 py-3">
                      <QuoteStatusBadge status={quote.status} validUntil={quote.valid_until} />
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {formatDateOnly(quote.valid_until)}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {quote.assigned_rep?.full_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">
                      {formatMoney(Number(quote.total), quote.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AddQuoteModal open={addOpen} onOpenChange={setAddOpen} />
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
