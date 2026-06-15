import { cn } from "@/lib/utils";

interface Props {
  icon: string;
  label: string;
  value: string;
  delta?: number;
  caption?: string;
  loading?: boolean;
  tone?: "primary" | "accent" | "success" | "warning";
}

const tones: Record<NonNullable<Props["tone"]>, string> = {
  primary: "bg-primary/10 text-primary",
  accent: "bg-accent/15 text-accent-dark",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
};

export function KpiCard({ icon, label, value, delta, caption, loading, tone = "primary" }: Props) {
  const positive = delta !== undefined && delta >= 0;
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
      <div className="flex items-start justify-between gap-3">
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", tones[tone])}>
          <span className="material-symbols-outlined">{icon}</span>
        </div>
        {delta !== undefined && (
          <div
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
              positive ? "bg-success/15 text-success" : "bg-cta/10 text-cta",
            )}
          >
            <span className="material-symbols-outlined text-[14px]">
              {positive ? "trending_up" : "trending_down"}
            </span>
            {Math.abs(delta).toFixed(0)}%
          </div>
        )}
      </div>
      <p className="mt-4 text-[12px] font-semibold uppercase tracking-wider text-text-secondary">
        {label}
      </p>
      <p className="mt-1 text-[28px] font-black tracking-tight text-foreground">
        {loading ? <span className="inline-block h-7 w-20 skeleton" /> : value}
      </p>
      {caption && <p className="mt-1 text-xs text-text-secondary">{caption}</p>}
    </div>
  );
}
