import { Link } from "@tanstack/react-router";
import { LEAD_STATUSES, useUpdateLeadStatus, type LeadRow, type LeadStatus } from "@/lib/leads-data";
import { useState } from "react";
import { toast } from "sonner";

export function LeadKanban({ leads }: { leads: LeadRow[] }) {
  const update = useUpdateLeadStatus();
  const [dragOver, setDragOver] = useState<LeadStatus | null>(null);

  function onDrop(status: LeadStatus, e: React.DragEvent) {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData("text/lead-id");
    if (!id) return;
    update.mutate(
      { id, status },
      {
        onSuccess: () => toast.success(`Moved to ${LEAD_STATUSES.find((s) => s.id === status)?.label}`),
        onError: (err) => toast.error("Could not update", { description: (err as Error).message }),
      },
    );
  }

  return (
    <div className="grid grid-flow-col auto-cols-[280px] gap-4 overflow-x-auto pb-2">
      {LEAD_STATUSES.map((col) => {
        const items = leads.filter((l) => l.status === col.id);
        return (
          <div
            key={col.id}
            onDragOver={(e) => { e.preventDefault(); setDragOver(col.id); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => onDrop(col.id, e)}
            className={`flex h-full flex-col rounded-xl border bg-surface p-3 transition-colors ${
              dragOver === col.id ? "border-primary bg-primary-light/30" : "border-border"
            }`}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${col.color}`}>{col.label}</span>
              </div>
              <span className="text-xs font-semibold text-text-secondary">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-text-muted">
                  No leads
                </div>
              ) : items.map((l) => <LeadCard key={l.id} lead={l} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LeadCard({ lead }: { lead: LeadRow }) {
  return (
    <Link
      to="/app/leads/$id"
      params={{ id: lead.id }}
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/lead-id", lead.id)}
      className="block cursor-grab rounded-lg border border-border bg-card p-3 shadow-[var(--shadow-xs)] transition-shadow hover:shadow-[var(--shadow-sm)] active:cursor-grabbing"
    >
      <p className="text-sm font-semibold text-foreground">{lead.first_name} {lead.last_name}</p>
      {lead.company_name && (
        <p className="text-xs text-text-secondary">{lead.company_name}</p>
      )}
      <p className="mt-1 truncate text-[11px] text-text-muted">{lead.email}</p>
      <div className="mt-2 flex items-center justify-between text-[10px] text-text-muted">
        <span>{lead.source}</span>
        <span>{new Date(lead.created_at).toLocaleDateString()}</span>
      </div>
    </Link>
  );
}
