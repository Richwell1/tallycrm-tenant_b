import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useDealFormOptions, useUpdateDealStage } from "@/lib/deals-data";
import { formatCurrency } from "@/lib/format";
import type { DealRow } from "@/lib/deals-data";

type DealWithRefs = DealRow & {
  primary_contact: { id: string; first_name: string; last_name: string; email: string | null } | null;
  company: { id: string; name: string } | null;
};

export function DealKanban({ deals }: { deals: DealWithRefs[] }) {
  const { data: options } = useDealFormOptions();
  const stages = options?.stages;
  const update = useUpdateDealStage();
  const [dragOver, setDragOver] = useState<string | null>(null);

  function onDrop(stageId: string, e: React.DragEvent) {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData("text/deal-id");
    const from = e.dataTransfer.getData("text/deal-stage");
    if (!id || stageId === from) return;
    const stage = stages?.find((s) => s.id === stageId);
    update.mutate(
      { dealId: id, stageId },
      {
        onSuccess: () => toast.success(`Moved to ${stage?.name}`),
        onError: (err) => toast.error("Could not move deal", { description: (err as Error).message }),
      }
    );
  }

  if (!stages) return null;

  return (
    <div className="grid grid-flow-col auto-cols-[300px] gap-4 overflow-x-auto pb-2">
      {stages.map((col) => {
        const items = deals.filter((d) => d.stage_id === col.id);
        const total = items.reduce((s, d) => s + Number(d.value || 0), 0);
        return (
          <div
            key={col.id}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(col.id);
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => onDrop(col.id, e)}
            className={`flex h-full flex-col rounded-xl border bg-surface p-3 transition-colors ${
              dragOver === col.id ? "border-primary bg-primary-light/30" : "border-border"
            }`}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: col.color }}
                />
                <span className="text-sm font-bold">{col.name}</span>
              </div>
              <span className="text-xs font-semibold text-text-secondary">{items.length}</span>
            </div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              {formatCurrency(total, "GHS")}
            </p>
            <div className="space-y-2">
              {items.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-text-muted">
                  No deals
                </div>
              ) : (
                items.map((d) => <DealCard key={d.id} deal={d} stageColor={col.color} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DealCard({ deal, stageColor }: { deal: DealWithRefs; stageColor: string }) {
  const days = Math.floor(
    (Date.now() - new Date(deal.updated_at).getTime()) / (1000 * 60 * 60 * 24)
  );
  return (
    <Link
      to="/app/deals/$id"
      params={{ id: deal.id }}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/deal-id", deal.id);
        e.dataTransfer.setData("text/deal-stage", deal.stage_id);
      }}
      className="block cursor-grab rounded-lg border border-border bg-card p-3 shadow-[var(--shadow-xs)] transition-shadow hover:shadow-[var(--shadow-sm)] active:cursor-grabbing"
      style={{ borderLeft: `3px solid ${stageColor}` }}
    >
      <p className="text-sm font-semibold text-foreground">{deal.name}</p>
      <p className="mt-0.5 text-xs text-text-secondary">
        {deal.primary_contact
          ? `${deal.primary_contact.first_name} ${deal.primary_contact.last_name}`
          : "No contact"}
        {deal.company ? ` · ${deal.company.name}` : ""}
      </p>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm font-bold text-primary">
          {formatCurrency(Number(deal.value), deal.currency)}
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-text-secondary">
          {deal.probability}%
        </span>
      </div>
      <p className="mt-1.5 text-[10px] text-text-muted">{days}d in stage</p>
    </Link>
  );
}
