import { SectionCard } from "@/components/layout";
import { EmptyState } from "@/components/common";
import { useMiniPipeline } from "@/lib/dashboard-data";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency, formatRelative } from "@/lib/format";

export function MiniPipeline() {
  const { user } = useAuth();
  const { data, isLoading } = useMiniPipeline(user?.role ?? null, user?.id);
  const stages = data ?? [];
  const total = stages.reduce((s, x) => s + x.totalValue, 0);

  return (
    <SectionCard
      title={user?.role === "rep" ? "My Pipeline Preview" : "Team Pipeline Preview"}
      description={`Total Value: ${formatCurrency(total)}`}
    >
      {isLoading ? (
        <div className="flex gap-3 overflow-x-auto">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-44 w-56 shrink-0 rounded-xl skeleton" />
          ))}
        </div>
      ) : stages.every((s) => s.deals.length === 0) ? (
        <EmptyState
          icon={<span className="material-symbols-outlined text-[24px]">view_kanban</span>}
          title="Pipeline is empty"
          description="Deals appear here grouped by stage once created."
        />
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {stages.map((s) => (
            <div
              key={s.id}
              className="w-56 shrink-0 rounded-xl border border-border bg-background p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.name}
                </p>
                <span className="text-[10px] text-text-secondary">{s.deals.length}</span>
              </div>
              <div className="space-y-2">
                {s.deals.length === 0 && (
                  <p className="rounded-md border border-dashed border-border px-2 py-3 text-center text-[11px] text-text-secondary">
                    Empty
                  </p>
                )}
                {s.deals.map((d) => (
                  <div key={d.id} className="rounded-lg border border-border bg-surface p-2.5">
                    <p className="truncate text-xs font-semibold text-foreground">{d.name}</p>
                    <div className="mt-1 flex items-center justify-between text-[11px]">
                      <span className="font-bold text-primary">{formatCurrency(d.value)}</span>
                      <span className="text-text-secondary">{formatRelative(d.updated_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
