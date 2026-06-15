import { SectionCard } from "@/components/layout";
import { EmptyState } from "@/components/common";
import { useLeadSourceBreakdown } from "@/lib/dashboard-data";

const PALETTE = ["#0057B8", "#F5A623", "#10B981", "#EF4444", "#8B5CF6", "#06B6D4"];

export function LeadSourceDonut() {
  const { data, isLoading } = useLeadSourceBreakdown();
  const slices = data ?? [];
  const total = slices.reduce((s, x) => s + x.count, 0);

  return (
    <SectionCard title="Lead Source" description="Where your leads come from.">
      {isLoading ? (
        <div className="h-44 rounded-lg skeleton" />
      ) : total === 0 ? (
        <EmptyState
          icon={<span className="material-symbols-outlined text-[24px]">donut_large</span>}
          title="No leads captured yet"
          description="Source mix will appear after the first lead arrives."
        />
      ) : (
        <div className="flex items-center gap-6">
          <Donut slices={slices.map((s, i) => ({ ...s, color: PALETTE[i % PALETTE.length] }))} total={total} />
          <ul className="flex-1 space-y-2">
            {slices.map((s, i) => {
              const pct = total > 0 ? (s.count / total) * 100 : 0;
              return (
                <li key={s.source} className="flex items-center gap-2 text-sm">
                  <span
                    className="h-3 w-3 rounded-sm"
                    style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
                  />
                  <span className="flex-1 truncate text-foreground">{s.source}</span>
                  <span className="text-xs font-semibold text-text-secondary">
                    {s.count} • {pct.toFixed(0)}%
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </SectionCard>
  );
}

function Donut({
  slices,
  total,
}: {
  slices: { source: string; count: number; color: string }[];
  total: number;
}) {
  const size = 140;
  const radius = 56;
  const stroke = 22;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
        {slices.map((s) => {
          const frac = s.count / total;
          const dash = frac * circumference;
          const el = (
            <circle
              key={s.source}
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          );
          offset += dash;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-xl font-black text-foreground">{total}</p>
        <p className="text-[10px] uppercase tracking-widest text-text-secondary">Total</p>
      </div>
    </div>
  );
}
