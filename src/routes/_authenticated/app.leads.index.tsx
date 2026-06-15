import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader, ToolbarButton, FilterBar } from "@/components/layout";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/common";
import { LeadKanban } from "@/components/leads/LeadKanban";
import { LeadsTable } from "@/components/leads/LeadsTable";
import { AddLeadModal } from "@/components/leads/AddLeadModal";
import { LEAD_STATUSES, useLeads, type LeadStatus } from "@/lib/leads-data";

export const Route = createFileRoute("/_authenticated/app/leads/")({
  component: LeadsIndex,
});

type View = "kanban" | "table";

function LeadsIndex() {
  const { data: leads, isLoading, isError, error, refetch } = useLeads();
  const [view, setView] = useState<View>("kanban");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [addOpen, setAddOpen] = useState(false);

  const filtered = useMemo(() => {
    let list = leads ?? [];
    if (statusFilter !== "all") list = list.filter((l) => l.status === statusFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((l) =>
        [l.first_name, l.last_name, l.email, l.company_name].filter(Boolean).some((v) => v!.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [leads, search, statusFilter]);

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
                  <span className="material-symbols-outlined text-[16px] align-middle">{v === "kanban" ? "view_kanban" : "table_rows"}</span>
                  <span className="ml-1.5">{v === "kanban" ? "Kanban" : "Table"}</span>
                </button>
              ))}
            </div>
            <ToolbarButton icon="refresh" onClick={() => refetch?.()}>Refresh</ToolbarButton>
            <ToolbarButton icon="add" variant="cta" onClick={() => setAddOpen(true)}>Add lead</ToolbarButton>
          </>
        }
      />

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search leads by name, email, company..."
        chips={statusFilter !== "all" ? [{ label: `Status: ${LEAD_STATUSES.find((s) => s.id === statusFilter)?.label}`, onRemove: () => setStatusFilter("all") }] : []}
        right={
          <select
            className="h-9 rounded-lg border border-border bg-background px-2.5 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as LeadStatus | "all")}
          >
            <option value="all">All statuses</option>
            {LEAD_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        }
      />

      {isLoading ? (
        <LoadingSkeleton rows={6} />
      ) : isError ? (
        <ErrorState message={(error as Error)?.message ?? "Could not load leads"} onRetry={() => refetch?.()} />
      ) : (leads?.length ?? 0) === 0 ? (
        <EmptyState
          icon="person_search"
          title="No leads yet"
          description="Leads from the public landing page or manual entry will appear here."
          action={{ label: "Add your first lead", onClick: () => setAddOpen(true) }}
        />
      ) : view === "kanban" ? (
        <LeadKanban leads={filtered} />
      ) : (
        <LeadsTable leads={filtered} />
      )}

      <AddLeadModal open={addOpen} onOpenChange={setAddOpen} />
    </>
  );
}
