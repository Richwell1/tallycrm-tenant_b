import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader, ToolbarButton, CrmToolbar } from "@/components/layout";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common";
import { LeadKanban } from "@/components/leads/LeadKanban";
import { LeadsTable } from "@/components/leads/LeadsTable";
import { AddLeadModal } from "@/components/leads/AddLeadModal";
import { ConvertLeadModal } from "@/components/leads/ConvertLeadModal";
import { DisqualifyModal } from "@/components/leads/DisqualifyModal";
import { LEAD_STATUSES, useLeads, type LeadRow, type LeadStatus } from "@/lib/leads-data";

export const Route = createFileRoute("/_authenticated/app/leads/")({
  component: LeadsIndex,
});

type View = "kanban" | "table";
type LeadSort = "recent" | "name" | "value";

function LeadsIndex() {
  const { data: leads, isLoading, isError, error, refetch } = useLeads();
  const [view, setView] = useState<View>("kanban");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [sortKey, setSortKey] = useState<LeadSort>("recent");
  const [addOpen, setAddOpen] = useState(false);
  const [convertLead, setConvertLead] = useState<LeadRow | null>(null);
  const [disqualifyLead, setDisqualifyLead] = useState<LeadRow | null>(null);

  const sourceOptions = useMemo(
    () =>
      Array.from(new Set((leads ?? []).map((lead) => lead.source).filter(Boolean)))
        .sort()
        .map((source) => source!),
    [leads],
  );

  const filtered = useMemo(() => {
    let list = leads ?? [];
    if (statusFilter !== "all") list = list.filter((l) => l.status === statusFilter);
    if (sourceFilter !== "all") list = list.filter((l) => l.source === sourceFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((l) =>
        [l.first_name, l.last_name, l.email, l.company_name]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q)),
      );
    }
    return [...list].sort((a, b) => {
      if (sortKey === "name")
        return `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`);
      if (sortKey === "value") return Number(b.value ?? 0) - Number(a.value ?? 0);
      return dateRank(b.created_at) - dateRank(a.created_at);
    });
  }, [leads, search, sortKey, sourceFilter, statusFilter]);

  return (
    <>
      <PageHeader
        title="Leads"
        count={leads?.length}
        actions={
          <>
            <div className="mr-2 flex overflow-hidden rounded-lg border border-border bg-surface text-[12px] font-semibold">
              {(["kanban", "table"] as View[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-2 ${view === v ? "bg-primary text-primary-foreground" : "text-text-secondary hover:bg-surface-hover"}`}
                >
                  <span className="material-symbols-outlined text-[16px] align-middle">
                    {v === "kanban" ? "view_kanban" : "table_rows"}
                  </span>
                  <span className="ml-1.5">{v === "kanban" ? "Kanban" : "Table"}</span>
                </button>
              ))}
            </div>
            <ToolbarButton icon="refresh" onClick={() => refetch?.()}>
              Refresh
            </ToolbarButton>
            <ToolbarButton icon="add" variant="cta" onClick={() => setAddOpen(true)}>
              Add lead
            </ToolbarButton>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-xs)]">
        <div className="relative min-w-[260px] flex-1">
          <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-text-muted">
            search
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by name or company..."
            className="h-[38px] w-full rounded-lg border border-border bg-card pl-10 pr-3 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <select
          className="h-[38px] min-w-[150px] rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as LeadStatus | "all")}
        >
          <option value="all">Status: All</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          className="h-[38px] min-w-[150px] rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
        >
          <option value="all">Source: All</option>
          {sourceOptions.map((source) => (
            <option key={source} value={source}>
              {source}
            </option>
          ))}
        </select>
        <select
          className="h-[38px] min-w-[170px] rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as LeadSort)}
        >
          <option value="recent">Sort: Recently created</option>
          <option value="name">Sort: Name</option>
          <option value="value">Sort: Estimated value</option>
        </select>
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} />
      ) : isError ? (
        <ErrorState
          description={(error as Error)?.message ?? "Could not load leads"}
          onRetry={() => refetch?.()}
        />
      ) : (leads?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<span className="material-symbols-outlined text-[28px]">person_search</span>}
          title="No leads yet"
          description="Leads from the public landing page or manual entry will appear here."
          action={
            <button
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-cta px-4 py-2 text-sm font-semibold text-cta-foreground hover:bg-cta-hover"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Add your first lead
            </button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<span className="material-symbols-outlined text-[28px]">search_off</span>}
          title="No leads match your filters"
          description="Adjust search, status, source, or sort criteria to widen the result set."
        />
      ) : view === "kanban" ? (
        <LeadKanban leads={filtered} onConvert={setConvertLead} onDisqualify={setDisqualifyLead} />
      ) : (
        <LeadsTable leads={filtered} onConvert={setConvertLead} onDisqualify={setDisqualifyLead} />
      )}

      <AddLeadModal open={addOpen} onOpenChange={setAddOpen} />
      {convertLead ? (
        <ConvertLeadModal
          open={!!convertLead}
          onOpenChange={(open) => {
            if (!open) setConvertLead(null);
          }}
          lead={convertLead}
        />
      ) : null}
      {disqualifyLead ? (
        <DisqualifyModal
          open={!!disqualifyLead}
          onOpenChange={(open) => {
            if (!open) setDisqualifyLead(null);
          }}
          leadId={disqualifyLead.id}
          onDone={() => refetch()}
        />
      ) : null}
    </>
  );
}

function dateRank(value: string | null | undefined) {
  return value ? new Date(value).getTime() : 0;
}
