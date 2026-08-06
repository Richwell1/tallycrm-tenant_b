import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader, ToolbarButton, CrmToolbar } from "@/components/layout";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common";
import { LeadKanban } from "@/components/leads/LeadKanban";
import { LeadsTable } from "@/components/leads/LeadsTable";
import { AddLeadModal } from "@/components/leads/AddLeadModal";
import { ConvertLeadModal } from "@/components/leads/ConvertLeadModal";
import { DisqualifyModal } from "@/components/leads/DisqualifyModal";
import { EditLeadModal } from "@/components/leads/EditLeadModal";
import { useCurrentRole } from "@/lib/auth-context";
import { LEAD_STATUSES, useLeads, type LeadRow, type LeadStatus } from "@/lib/leads-data";
import { useSyncStatus } from "@/lib/sync-status-data";

export const Route = createFileRoute("/_authenticated/app/leads/")({
  component: LeadsIndex,
});

type View = "kanban" | "table";
type LeadSort = "recent" | "name" | "value";

function LeadsIndex() {
  const { data: leads, isLoading, isError, error, refetch } = useLeads();
  const role = useCurrentRole();
  const canReadSyncStatus = role === "admin" || role === "manager";
  const syncStatus = useSyncStatus(canReadSyncStatus);
  const [view, setView] = useState<View>("kanban");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [sortKey, setSortKey] = useState<LeadSort>("recent");
  const [addOpen, setAddOpen] = useState(false);
  const [editLead, setEditLead] = useState<LeadRow | null>(null);
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

  const leadLastPushedAt = syncStatus.data?.leadLastPushedAt ?? null;
  const isPendingSync = (lead: LeadRow) =>
    canReadSyncStatus &&
    (!leadLastPushedAt || dateRank(lead.updated_at) > dateRank(leadLastPushedAt));

  return (
    <>
      <PageHeader
        title="Leads"
        count={leads?.length}
        actions={
          <>
            <ToolbarButton icon="refresh" onClick={() => refetch?.()}>
              Refresh
            </ToolbarButton>
            <ToolbarButton icon="add" variant="cta" onClick={() => setAddOpen(true)}>
              Add lead
            </ToolbarButton>
          </>
        }
      />

      <CrmToolbar<View>
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Filter by name or company..."
        view={view}
        onViewChange={setView}
        viewOptions={[
          { value: "kanban", icon: "view_kanban", label: "Kanban" },
          { value: "table", icon: "table_rows", label: "Table" },
        ]}
        filters={[
          {
            label: "Status",
            value: statusFilter,
            onChange: (v) => setStatusFilter(v as LeadStatus | "all"),
            options: LEAD_STATUSES.map((s) => ({ value: s.id, label: s.label })),
          },
          {
            label: "Source",
            value: sourceFilter,
            onChange: setSourceFilter,
            options: sourceOptions.map((s) => ({ value: s, label: s })),
          },
        ]}
        sort={{
          value: sortKey,
          onChange: (v) => setSortKey(v as LeadSort),
          options: [
            { value: "recent", label: "Recently created" },
            { value: "name", label: "Name" },
            { value: "value", label: "Estimated value" },
          ],
        }}
      />

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
        <LeadKanban
          leads={filtered}
          isPendingSync={isPendingSync}
          onEdit={setEditLead}
          onConvert={setConvertLead}
          onDisqualify={setDisqualifyLead}
        />
      ) : (
        <LeadsTable
          leads={filtered}
          isPendingSync={isPendingSync}
          onEdit={setEditLead}
          onConvert={setConvertLead}
          onDisqualify={setDisqualifyLead}
        />
      )}

      <AddLeadModal open={addOpen} onOpenChange={setAddOpen} />
      <EditLeadModal
        lead={editLead}
        open={!!editLead}
        onOpenChange={(open) => {
          if (!open) setEditLead(null);
        }}
      />
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
