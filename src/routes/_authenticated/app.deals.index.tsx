import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader, ToolbarButton, FilterBar } from "@/components/layout";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common";
import { DealKanban } from "@/components/deals/DealKanban";
import { DealsTable } from "@/components/deals/DealsTable";
import { AddDealModal } from "@/components/deals/AddDealModal";
import { useDeals, usePipelineStages } from "@/lib/deals-data";

export const Route = createFileRoute("/_authenticated/app/deals/")({
  component: DealsIndex,
});

type View = "kanban" | "table";

function DealsIndex() {
  const { data: deals, isLoading, isError, error, refetch } = useDeals();
  const { data: stages } = usePipelineStages();
  const [view, setView] = useState<View>("kanban");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [addOpen, setAddOpen] = useState(false);

  const filtered = useMemo(() => {
    let list = deals ?? [];
    if (stageFilter !== "all") list = list.filter((d) => d.stage_id === stageFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((d) =>
        [
          d.name,
          d.primary_contact ? `${d.primary_contact.first_name} ${d.primary_contact.last_name}` : "",
          d.company?.name,
        ]
          .filter(Boolean)
          .some((v) => (v as string).toLowerCase().includes(q))
      );
    }
    return list;
  }, [deals, search, stageFilter]);

  const stageName = stages?.find((s) => s.id === stageFilter)?.name;

  return (
    <>
      <PageHeader
        title="Deals"
        count={deals?.length}
        actions={
          <>
            <div className="mr-2 flex overflow-hidden rounded-lg border border-border bg-surface text-[12px] font-semibold">
              {(["kanban", "table"] as View[]).map((vw) => (
                <button
                  key={vw}
                  onClick={() => setView(vw)}
                  className={`px-3 py-2 ${
                    view === vw
                      ? "bg-primary text-primary-foreground"
                      : "text-text-secondary hover:bg-surface-hover"
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px] align-middle">
                    {vw === "kanban" ? "view_kanban" : "table_rows"}
                  </span>
                  <span className="ml-1.5">{vw === "kanban" ? "Kanban" : "Table"}</span>
                </button>
              ))}
            </div>
            <ToolbarButton icon="refresh" onClick={() => refetch?.()}>
              Refresh
            </ToolbarButton>
            <ToolbarButton icon="add" variant="cta" onClick={() => setAddOpen(true)}>
              Add deal
            </ToolbarButton>
          </>
        }
      />

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search deals by name, contact, company..."
        chips={
          stageFilter !== "all" && stageName
            ? [{ label: `Stage: ${stageName}`, onRemove: () => setStageFilter("all") }]
            : []
        }
        right={
          <select
            className="h-9 rounded-lg border border-border bg-background px-2.5 text-sm"
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
          >
            <option value="all">All stages</option>
            {(stages ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        }
      />

      {isLoading ? (
        <TableSkeleton rows={6} />
      ) : isError ? (
        <ErrorState description={(error as Error)?.message ?? "Could not load deals"} onRetry={() => refetch?.()} />
      ) : (deals?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<span className="material-symbols-outlined text-[28px]">handshake</span>}
          title="No deals yet"
          description="Convert a qualified lead into a deal, or add a deal manually to get started."
          action={
            <button
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-cta px-4 py-2 text-sm font-semibold text-cta-foreground hover:bg-cta-hover"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Add your first deal
            </button>
          }
        />
      ) : view === "kanban" ? (
        <DealKanban deals={filtered} />
      ) : (
        <DealsTable deals={filtered} />
      )}

      <AddDealModal open={addOpen} onOpenChange={setAddOpen} />
    </>
  );
}
