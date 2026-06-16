import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { EmptyState, ErrorState, GridSkeleton } from "@/components/common";
import { PageHeader, ToolbarButton, CrmToolbar } from "@/components/layout";
import { AddDealModal } from "@/components/deals/AddDealModal";
import { CloseDealModal } from "@/components/deals/CloseDealModal";
import {
  type DealSummary,
  type PipelineStageRow,
  useDealsBoard,
  useUpdateDealStage,
} from "@/lib/deals-data";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/deals/")({
  component: DealsIndex,
});

type DealSort = "recent" | "value" | "probability" | "closeDate";

function DealsIndex() {
  const { data, isLoading, isError, error, refetch } = useDealsBoard();
  const updateStage = useUpdateDealStage();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [sortKey, setSortKey] = useState<DealSort>("recent");
  const [addOpen, setAddOpen] = useState(false);
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);
  const [closeTarget, setCloseTarget] = useState<{
    deal: DealSummary;
    mode: "won" | "lost";
  } | null>(null);

  const filteredDeals = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (data?.deals ?? []).filter((deal) => {
      const stageMatch = stageFilter === "all" || deal.stage_id === stageFilter;
      const searchMatch =
        !q ||
        [
          deal.name,
          deal.primary_contact?.first_name,
          deal.primary_contact?.last_name,
          deal.primary_contact?.email,
          deal.company?.name,
          deal.assigned_rep?.full_name,
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(q));
      return stageMatch && searchMatch;
    });

    return list.sort((a, b) => {
      if (sortKey === "value") return Number(b.value ?? 0) - Number(a.value ?? 0);
      if (sortKey === "probability") return Number(b.probability ?? 0) - Number(a.probability ?? 0);
      if (sortKey === "closeDate")
        return dateRank(a.expected_close_date) - dateRank(b.expected_close_date);
      return dateRank(b.created_at) - dateRank(a.created_at);
    });
  }, [data?.deals, search, sortKey, stageFilter]);

  function handleDrop(stage: PipelineStageRow) {
    if (!draggedDealId) return;
    const deal = data?.deals.find((item) => item.id === draggedDealId);
    setDraggedDealId(null);
    if (!deal || deal.stage_id === stage.id) return;
    if (stage.is_closed) {
      setCloseTarget({ deal, mode: stage.is_won ? "won" : "lost" });
      return;
    }
    updateStage.mutate({ dealId: draggedDealId, stageId: stage.id });
  }

  return (
    <>
      <div className="flex h-[calc(100vh-112px)] flex-col overflow-hidden">
        <PageHeader
          title="Sales Pipeline"
          count={data?.deals.length}
          actions={
            <>
              <ToolbarButton icon="refresh" onClick={() => refetch()}>
                Refresh
              </ToolbarButton>
              <ToolbarButton icon="add" variant="cta" onClick={() => setAddOpen(true)}>
                Add Deal
              </ToolbarButton>
            </>
          }
        />

        <CrmToolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search deals, clients, or reps..."
          filters={[
            {
              label: "Stage",
              value: stageFilter,
              onChange: setStageFilter,
              options: (data?.stages ?? []).map((s) => ({ value: s.id, label: s.name })),
            },
          ]}
          sort={{
            value: sortKey,
            onChange: (v) => setSortKey(v as DealSort),
            options: [
              { value: "recent", label: "Recently created" },
              { value: "value", label: "Value" },
              { value: "probability", label: "Probability" },
              { value: "closeDate", label: "Close date" },
            ],
          }}
        />

        {isLoading ? (
          <GridSkeleton count={8} />
        ) : isError ? (
          <ErrorState
            description={(error as Error)?.message ?? "Could not load deals"}
            onRetry={() => refetch()}
          />
        ) : !data?.stages.length ? (
          <EmptyState
            icon={<span className="material-symbols-outlined text-[28px]">handshake</span>}
            title="No pipeline stages configured"
            description="Create the default seven-stage deal pipeline before adding opportunities."
          />
        ) : data.deals.length === 0 ? (
          <EmptyState
            icon={<span className="material-symbols-outlined text-[28px]">handshake</span>}
            title="No deals yet"
            description="Add an opportunity or convert a qualified lead to begin tracking pipeline value."
            action={
              <button
                onClick={() => setAddOpen(true)}
                className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white"
              >
                Add Deal
              </button>
            }
          />
        ) : filteredDeals.length === 0 ? (
          <EmptyState
            icon={<span className="material-symbols-outlined text-[28px]">search_off</span>}
            title="No deals match your filters"
            description="Adjust search, stage, or sort criteria to widen the result set."
          />
        ) : (
          <div className="kanban-scroll-container flex flex-1 gap-4 overflow-x-auto pb-6">
            {data.stages.map((stage) => {
              const stageDeals = filteredDeals.filter((deal) => deal.stage_id === stage.id);
              return (
                <KanbanColumn
                  key={stage.id}
                  stage={stage}
                  deals={stageDeals}
                  dragging={!!draggedDealId}
                  onDragStart={setDraggedDealId}
                  onDrop={() => handleDrop(stage)}
                  onClose={(deal, mode) => setCloseTarget({ deal, mode })}
                />
              );
            })}
          </div>
        )}
      </div>

      <AddDealModal open={addOpen} onOpenChange={setAddOpen} />
      {closeTarget ? (
        <CloseDealModal
          deal={closeTarget.deal}
          mode={closeTarget.mode}
          open={!!closeTarget}
          onOpenChange={(open) => {
            if (!open) setCloseTarget(null);
          }}
        />
      ) : null}
    </>
  );
}

function KanbanColumn({
  stage,
  deals,
  dragging,
  onDragStart,
  onDrop,
  onClose,
}: {
  stage: PipelineStageRow;
  deals: DealSummary[];
  dragging: boolean;
  onDragStart: (id: string) => void;
  onDrop: () => void;
  onClose: (deal: DealSummary, mode: "won" | "lost") => void;
}) {
  const total = deals.reduce((sum, deal) => sum + Number(deal.value ?? 0), 0);
  const tone = stageTone(stage);

  return (
    <section
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDrop={onDrop}
      className={`flex w-[300px] min-w-[300px] flex-col gap-4 rounded-lg ${
        dragging ? "bg-muted/50" : ""
      }`}
    >
      <div className="sticky top-0 z-10 flex flex-col gap-1 bg-background py-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`h-3 w-3 rounded-full ${tone.dot}`} />
            <h2 className="text-[16px] font-semibold text-foreground">{stage.name}</h2>
          </div>
          <span className={`rounded px-2 py-1 text-[11px] font-bold ${tone.badge}`}>
            {deals.length}
          </span>
        </div>
        <p className="text-xs font-semibold text-text-secondary">
          {formatCurrency(total, deals[0]?.currency ?? "USD")} Total
        </p>
      </div>

      <div className="flex flex-col gap-4 overflow-y-auto pr-1">
        {deals.map((deal) => (
          <DealCard
            key={deal.id}
            deal={deal}
            tone={tone}
            onDragStart={() => onDragStart(deal.id)}
            onClose={onClose}
          />
        ))}
        {deals.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card/70 p-6 text-center text-xs font-semibold text-text-muted">
            Drop deal here
          </div>
        ) : null}
      </div>
    </section>
  );
}

function DealCard({
  deal,
  tone,
  onDragStart,
  onClose,
}: {
  deal: DealSummary;
  tone: ReturnType<typeof stageTone>;
  onDragStart: () => void;
  onClose: (deal: DealSummary, mode: "won" | "lost") => void;
}) {
  const contactName = deal.primary_contact
    ? `${deal.primary_contact.first_name} ${deal.primary_contact.last_name}`
    : "Unassigned contact";
  const initials = (deal.assigned_rep?.full_name ?? contactName)
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="group cursor-grab overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-primary active:cursor-grabbing"
    >
      <div className={`h-1 w-full ${tone.bar}`} />
      <div className="p-4">
        <Link to="/app/deals/$id" params={{ id: deal.id }} className="block">
          <div className="mb-2 flex items-start justify-between gap-2">
            <h3 className="text-[16px] font-semibold text-foreground transition-colors group-hover:text-primary">
              {deal.name}
            </h3>
            <span className="material-symbols-outlined text-text-muted">open_in_new</span>
          </div>
          <div className="mb-4 flex items-center gap-1 text-[16px] font-semibold text-foreground">
            <span className="material-symbols-outlined text-[18px] text-primary">payments</span>
            {formatCurrency(Number(deal.value ?? 0), deal.currency ?? "USD")}
          </div>
          <div className="mb-4 space-y-1">
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <span className="material-symbols-outlined text-[16px] text-text-muted">person</span>
              {contactName}
            </div>
            <div className="flex items-center gap-2 truncate text-sm text-text-secondary">
              <span className="material-symbols-outlined text-[16px] text-text-muted">mail</span>
              <span className="truncate">{deal.primary_contact?.email ?? deal.company?.email}</span>
            </div>
          </div>
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-primary-light text-[10px] font-bold text-primary">
            {initials}
          </div>
          <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${tone.probability}`}>
            {deal.probability ?? 0}% Prob.
          </span>
        </div>
        {!deal.stage?.is_closed ? (
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3">
            <button
              type="button"
              onClick={() => onClose(deal, "won")}
              className="rounded bg-success-light px-2 py-1.5 text-xs font-bold text-success hover:bg-success hover:text-white"
            >
              Won
            </button>
            <button
              type="button"
              onClick={() => onClose(deal, "lost")}
              className="rounded bg-danger-light px-2 py-1.5 text-xs font-bold text-danger hover:bg-danger hover:text-white"
            >
              Lost
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}


function dateRank(value: string | null | undefined) {
  return value ? new Date(value).getTime() : 0;
}

function stageTone(stage: PipelineStageRow) {
  const name = stage.name.toLowerCase();
  if (stage.is_closed && stage.is_won) return colorSet("green");
  if (stage.is_closed) return colorSet("red");
  if (name.includes("contact")) return colorSet("blue");
  if (name.includes("presentation")) return colorSet("teal");
  if (name.includes("proposal")) return colorSet("amber");
  if (name.includes("appointment")) return colorSet("purple");
  if (name.includes("negotiation")) return colorSet("orange");
  return colorSet("indigo");
}

function colorSet(
  color: "indigo" | "blue" | "teal" | "amber" | "purple" | "orange" | "green" | "red",
) {
  const sets = {
    indigo: {
      dot: "bg-indigo-500",
      bar: "bg-indigo-500",
      badge: "bg-indigo-100 text-indigo-700",
      probability: "bg-indigo-50 text-indigo-600",
    },
    blue: {
      dot: "bg-blue-500",
      bar: "bg-blue-500",
      badge: "bg-blue-100 text-blue-700",
      probability: "bg-blue-50 text-blue-600",
    },
    teal: {
      dot: "bg-teal-500",
      bar: "bg-teal-500",
      badge: "bg-teal-100 text-teal-700",
      probability: "bg-teal-50 text-teal-600",
    },
    amber: {
      dot: "bg-amber-500",
      bar: "bg-amber-500",
      badge: "bg-amber-100 text-amber-700",
      probability: "bg-amber-50 text-amber-600",
    },
    purple: {
      dot: "bg-purple-500",
      bar: "bg-purple-500",
      badge: "bg-purple-100 text-purple-700",
      probability: "bg-purple-50 text-purple-600",
    },
    orange: {
      dot: "bg-orange-500",
      bar: "bg-orange-500",
      badge: "bg-orange-100 text-orange-700",
      probability: "bg-orange-50 text-orange-600",
    },
    green: {
      dot: "bg-green-500",
      bar: "bg-green-500",
      badge: "bg-green-100 text-green-700",
      probability: "bg-green-50 text-green-600",
    },
    red: {
      dot: "bg-red-500",
      bar: "bg-red-500",
      badge: "bg-red-100 text-red-700",
      probability: "bg-red-50 text-red-600",
    },
  };
  return sets[color];
}
