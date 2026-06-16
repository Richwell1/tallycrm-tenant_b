import { SectionCard } from "@/components/layout";
import { EmptyState, Icon } from "@/components/common";
import { usePipelineFunnel } from "@/lib/dashboard-data";
import { formatCurrency } from "@/lib/format";

export function PipelineFunnel() {
  const { data, isLoading } = usePipelineFunnel();
  const stages = (data ?? []).filter((s) => !s.is_closed);
  const max = Math.max(1, ...stages.map((s) => s.count));

  return (
    <SectionCard title="Pipeline Funnel" description="Count and value of open deals per stage.">
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-9 rounded-lg skeleton" />
          ))}
        </div>
      ) : stages.every((s) => s.count === 0) ? (
        <EmptyState
          icon={<Icon name="filter_alt" className="h-6 w-6" />}
          title="No deals yet"
          description="Funnel populates as soon as deals are created."
        />
      ) : (
        <div className="space-y-2.5">
          {stages.map((s) => {
            const pct = (s.count / max) * 100;
            return (
              <div key={s.id} className="flex items-center gap-3">
                <div className="w-28 truncate text-xs font-semibold text-text-secondary">
                  {s.name}
                </div>
                <div className="flex-1">
                  <div className="h-7 rounded-lg bg-muted">
                    <div
                      className="flex h-full items-center justify-end rounded-lg bg-primary px-3 text-[11px] font-bold text-primary-foreground"
                      style={{
                        width: `${Math.max(pct, 6)}%`,
                      }}
                    >
                      {s.count}
                    </div>
                  </div>
                </div>
                <div className="w-24 text-right text-xs font-semibold text-foreground">
                  {formatCurrency(s.value)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
