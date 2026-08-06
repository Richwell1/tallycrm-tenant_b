import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState, ErrorState, GridSkeleton, TableSkeleton } from "@/components/common";
import { PageHeader, SectionCard, ToolbarButton } from "@/components/layout";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency } from "@/lib/format";
import {
  useAnalyticsKpis,
  useConversionFunnel,
  useLeadSources,
  useLossReasonAnalytics,
  useRepLeaderboard,
  useRevenueChart,
  type AnalyticsKpi,
  type AnalyticsPeriod,
  type FunnelStage,
  type LeadSourceMetric,
  type LossReasonMetric,
  type RepPerformance,
  type RevenuePoint,
} from "@/lib/analytics-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/analytics/")({
  component: AnalyticsOverviewPage,
});

const PERIODS: Array<{ id: AnalyticsPeriod; label: string }> = [
  { id: "week", label: "This Week" },
  { id: "month", label: "Month" },
  { id: "quarter", label: "Quarter" },
  { id: "year", label: "Year" },
];

function AnalyticsOverviewPage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<AnalyticsPeriod>("month");
  const [lastUpdated, setLastUpdated] = useState(() => new Date());

  if (user?.role === "rep") {
    return (
      <>
        <PageHeader title="Analytics" breadcrumbs={[{ label: "CRM" }, { label: "Analytics" }]} />
        <SectionCard>
          <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary-light text-primary">
              <span className="material-symbols-outlined text-[30px]">lock</span>
            </div>
            <h2 className="text-lg font-semibold text-foreground">Manager analytics only</h2>
            <p className="mt-2 max-w-md text-sm text-text-secondary">
              Team-wide reporting is available to Admins and Sales Managers. Your personal metrics
              remain scoped through the Dashboard and assigned records.
            </p>
          </div>
        </SectionCard>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Analytics Overview"
        breadcrumbs={[{ label: "CRM" }, { label: "Analytics" }]}
        actions={
          <>
            <ToolbarButton
              icon="file_download"
              onClick={() => toast.success("Analytics PDF export prepared")}
            >
              Export PDF
            </ToolbarButton>
            <ToolbarButton
              icon="refresh"
              variant="primary"
              onClick={() => {
                setLastUpdated(new Date());
                toast.success("Analytics data refreshed", {
                  description: "Pipeline, revenue, source, and rep report metrics are current.",
                });
              }}
            >
              Update Data
            </ToolbarButton>
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-xs)]">
        <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {PERIODS.map((item) => (
            <button
              key={item.id}
              onClick={() => setPeriod(item.id)}
              className={cn(
                "h-9 rounded-md px-4 text-[12px] font-semibold transition-all",
                period === item.id
                  ? "bg-card text-primary shadow-[var(--shadow-xs)]"
                  : "text-text-secondary hover:bg-card/60 hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
          <button className="inline-flex h-9 items-center gap-1.5 rounded-md px-4 text-[12px] font-semibold text-text-secondary hover:bg-card/60 hover:text-foreground">
            <span className="material-symbols-outlined text-[16px]">calendar_today</span>
            Custom
          </button>
        </div>
        <p className="text-[12px] font-medium text-text-muted">
          Showing all permitted CRM records for {periodLabel(period)} - Updated{" "}
          {lastUpdated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
        </p>
      </div>

      <KpiSection period={period} />

      <div className="mt-5">
        <RevenuePerformanceChart period={period} />
      </div>

      <div className="mt-5">
        <ConversionFunnel />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <section className="xl:col-span-2">
          <RepLeaderboard period={period} />
        </section>
        <WinLossAnalysis period={period} />
      </div>

      <div className="mt-5">
        <LeadSourceEfficiency />
      </div>
    </>
  );
}

function KpiSection({ period }: { period: AnalyticsPeriod }) {
  const { data = [], isLoading, isError, error, refetch } = useAnalyticsKpis(period);
  if (isLoading)
    return <GridSkeleton count={4} className="grid-cols-1 md:grid-cols-2 xl:grid-cols-4" />;
  if (isError)
    return (
      <ErrorState
        description={(error as Error)?.message ?? "Could not load KPIs"}
        onRetry={() => refetch()}
      />
    );
  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {data.map((kpi) => (
        <KpiTile key={kpi.label} kpi={kpi} />
      ))}
    </section>
  );
}

function KpiTile({ kpi }: { kpi: AnalyticsKpi }) {
  const toneClasses = {
    primary: "bg-primary-light text-primary",
    accent: "bg-accent-light text-accent-dark",
    success: "bg-success-light text-success",
    warning: "bg-warning-light text-warning",
  }[kpi.tone];
  const trendClasses =
    kpi.trend === "down"
      ? "text-danger"
      : kpi.trend === "up"
        ? "text-success"
        : "text-text-secondary";
  const trendIcon =
    kpi.trend === "down" ? "trending_down" : kpi.trend === "up" ? "trending_up" : "check_circle";

  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", toneClasses)}>
          <span className="material-symbols-outlined">{kpi.icon}</span>
        </div>
        <span
          className={cn("inline-flex items-center gap-1 text-[12px] font-semibold", trendClasses)}
        >
          <span className="material-symbols-outlined text-[15px]">{trendIcon}</span>
          {kpi.delta}
        </span>
      </div>
      <p className="text-[12px] font-semibold text-text-secondary">{kpi.label}</p>
      <h3 className="mt-1 text-[24px] font-semibold tracking-tight text-foreground">{kpi.value}</h3>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${kpi.progress}%` }} />
      </div>
      <p className="mt-3 text-[12px] text-text-muted">{kpi.caption}</p>
    </article>
  );
}

function RevenuePerformanceChart({ period }: { period: AnalyticsPeriod }) {
  const { data = [], isLoading, isError, error, refetch } = useRevenueChart(period);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const { actual, target, area, actualPoints, targetPoints, max } = useMemo(
    () => buildChartPaths(data),
    [data],
  );
  const activePoint = activeIndex === null ? null : data[activeIndex];
  const activeActual = activeIndex === null ? null : actualPoints[activeIndex];
  const activeTarget = activeIndex === null ? null : targetPoints[activeIndex];

  if (isLoading)
    return (
      <SectionCard
        title="Revenue Performance"
        description="Closed Won value vs monthly growth target"
      >
        <TableSkeleton rows={5} columns={12} />
      </SectionCard>
    );
  if (isError)
    return (
      <SectionCard
        title="Revenue Performance"
        description="Closed Won value vs monthly growth target"
      >
        <ErrorState
          description={(error as Error)?.message ?? "Could not load revenue data"}
          onRetry={() => refetch()}
        />
      </SectionCard>
    );

  return (
    <SectionCard
      title="Revenue Performance"
      description="Closed Won value vs monthly growth target"
      actions={
        <div className="flex flex-wrap items-center gap-4 text-[12px] font-semibold">
          <LegendSwatch className="bg-primary" label="Actual Revenue" />
          <LegendSwatch className="bg-accent" label="Target Forecast" />
        </div>
      }
    >
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <div className="min-w-[760px] p-4">
          <div className="relative flex">
            <div className="mr-3 flex h-[260px] w-14 flex-col justify-between py-3 text-right text-[11px] font-semibold text-text-muted">
              <span>{formatCurrency(max)}</span>
              <span>{formatCurrency(max * 0.75)}</span>
              <span>{formatCurrency(max * 0.5)}</span>
              <span>{formatCurrency(max * 0.25)}</span>
              <span>GHS 0</span>
            </div>
            <div className="relative h-[260px] flex-1" onMouseLeave={() => setActiveIndex(null)}>
              <svg
                viewBox="0 0 1000 260"
                preserveAspectRatio="none"
                className="h-full w-full overflow-visible"
              >
                <defs>
                  <linearGradient id="analytics-revenue-fill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[20, 70, 120, 170, 220].map((y) => (
                  <line
                    key={y}
                    x1="0"
                    x2="1000"
                    y1={y}
                    y2={y}
                    stroke="var(--color-border)"
                    strokeDasharray="6 8"
                  />
                ))}
                {activeActual ? (
                  <line
                    x1={activeActual.x}
                    x2={activeActual.x}
                    y1="20"
                    y2="220"
                    stroke="var(--color-primary)"
                    strokeDasharray="5 6"
                    strokeOpacity="0.45"
                  />
                ) : null}
                <path d={area} fill="url(#analytics-revenue-fill)" />
                <path
                  d={target}
                  fill="none"
                  stroke="var(--color-accent)"
                  strokeDasharray="8 8"
                  strokeWidth="3"
                />
                <path
                  d={actual}
                  fill="none"
                  stroke="var(--color-primary)"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="5"
                />
                {targetPoints.map((point, index) => (
                  <circle
                    key={`target-${data[index].label}`}
                    cx={point.x}
                    cy={point.y}
                    r={activeIndex === index ? 5 : 3.5}
                    fill="var(--color-card)"
                    stroke="var(--color-accent)"
                    strokeWidth="3"
                  />
                ))}
                {actualPoints.map((point, index) => (
                  <circle
                    key={`actual-${data[index].label}`}
                    cx={point.x}
                    cy={point.y}
                    r={activeIndex === index ? 7 : 4.5}
                    fill="var(--color-primary)"
                    stroke="var(--color-card)"
                    strokeWidth="3"
                  />
                ))}
              </svg>

              {data.map((point, index) => {
                const position = actualPoints[index];
                return (
                  <button
                    key={point.label}
                    type="button"
                    aria-label={`${point.label}: ${formatCurrency(point.actual)} actual revenue, ${formatCurrency(point.target)} target`}
                    onFocus={() => setActiveIndex(index)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className="absolute top-0 h-full -translate-x-1/2 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    style={{
                      left: `${position.x / 10}%`,
                      width: `${Math.max(42, 100 / data.length)}px`,
                    }}
                  />
                );
              })}

              {activePoint && activeActual && activeTarget ? (
                <div
                  className="pointer-events-none absolute z-20 w-48 rounded-lg border border-border bg-card p-3 text-left shadow-[var(--shadow-md)]"
                  style={{
                    left: `${activeActual.x / 10}%`,
                    top: `${Math.min(activeActual.y, activeTarget.y)}px`,
                    transform:
                      activeActual.x > 760 ? "translate(-100%, -110%)" : "translate(12px, -110%)",
                  }}
                >
                  <p className="text-[12px] font-bold uppercase tracking-wider text-text-muted">
                    {activePoint.label}
                  </p>
                  <div className="mt-2 space-y-1.5 text-[12px] font-semibold">
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-1.5 text-text-secondary">
                        <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                        Actual
                      </span>
                      <span>{formatCurrency(activePoint.actual)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-1.5 text-text-secondary">
                        <span className="h-2.5 w-2.5 rounded-full bg-accent" />
                        Target
                      </span>
                      <span>{formatCurrency(activePoint.target)}</span>
                    </div>
                    <div
                      className={cn(
                        "flex items-center justify-between gap-3 border-t border-border pt-1.5",
                        activePoint.actual >= activePoint.target ? "text-success" : "text-danger",
                      )}
                    >
                      <span>Variance</span>
                      <span>{formatCurrency(activePoint.actual - activePoint.target)}</span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          <div
            className="ml-[68px] mt-3 grid border-t border-border pt-3"
            style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}
          >
            {data.map((point, index) => (
              <button
                key={point.label}
                type="button"
                onFocus={() => setActiveIndex(index)}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
                className={cn(
                  "mx-auto flex h-8 min-w-10 items-center justify-center rounded-md px-2 text-[12px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                  activeIndex === index
                    ? "bg-primary-light text-primary"
                    : "text-text-muted hover:bg-muted hover:text-foreground",
                )}
              >
                {point.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

function ConversionFunnel() {
  const { data: stages = [], isLoading, isError, error, refetch } = useConversionFunnel();
  const max = stages[0]?.count ?? 1;

  if (isLoading)
    return (
      <SectionCard
        title="Sales Conversion Funnel"
        description="Active movement through the canonical lead-to-deal stages"
      >
        <TableSkeleton rows={1} columns={5} />
      </SectionCard>
    );
  if (isError)
    return (
      <SectionCard
        title="Sales Conversion Funnel"
        description="Active movement through the canonical lead-to-deal stages"
      >
        <ErrorState
          description={(error as Error)?.message ?? "Could not load funnel"}
          onRetry={() => refetch()}
        />
      </SectionCard>
    );
  if (stages.length === 0)
    return (
      <SectionCard
        title="Sales Conversion Funnel"
        description="Active movement through the canonical lead-to-deal stages"
      >
        <EmptyState
          icon={<span className="material-symbols-outlined text-[28px]">filter_alt</span>}
          title="No funnel data yet"
          description="Leads and deals will populate the funnel as activity is recorded."
        />
      </SectionCard>
    );

  return (
    <SectionCard
      title="Sales Conversion Funnel"
      description="Active movement through the canonical lead-to-deal stages"
      bodyClassName="overflow-x-auto"
    >
      <div className="flex min-w-[860px] items-center">
        {stages.map((stage, index) => {
          const width = Math.max(42, (stage.count / max) * 100);
          return (
            <div key={stage.name} className="relative flex flex-1 flex-col items-center">
              <div
                className="flex h-28 flex-col items-center justify-center px-4 text-center text-white"
                style={{
                  width: `${width}%`,
                  background: `color-mix(in oklab, var(--color-primary) ${100 - index * 8}%, white)`,
                  clipPath:
                    index === stages.length - 1
                      ? "polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)"
                      : "polygon(0% 0%, 92% 0%, 100% 50%, 92% 100%, 0% 100%, 8% 50%)",
                }}
              >
                <span className="text-[12px] font-semibold opacity-85">{stage.name}</span>
                <span className="mt-1 text-xl font-semibold">{stage.count.toLocaleString()}</span>
              </div>
              {stage.dropoff ? (
                <span className="absolute right-[-18px] top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-[11px] font-bold text-foreground shadow-[var(--shadow-sm)]">
                  {stage.dropoff}%
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

function RepLeaderboard({ period }: { period: AnalyticsPeriod }) {
  const { data: reps = [], isLoading, isError, error, refetch } = useRepLeaderboard(period);
  const topCloser = reps[0];
  const topRevenue = reps.reduce<RepPerformance | null>(
    (best, rep) => (!best || rep.revenue > best.revenue ? rep : best),
    null,
  );
  const bestWinRate = reps
    .filter((rep) => rep.totalClosed > 0)
    .reduce<RepPerformance | null>(
      (best, rep) => (!best || rep.winRate > best.winRate ? rep : best),
      null,
    );

  if (isLoading)
    return (
      <SectionCard title="Rep Closing Leaderboard" bodyClassName="p-0">
        <TableSkeleton rows={4} columns={7} />
      </SectionCard>
    );
  if (isError)
    return (
      <SectionCard title="Rep Closing Leaderboard" bodyClassName="p-0">
        <ErrorState
          description={(error as Error)?.message ?? "Could not load leaderboard"}
          onRetry={() => refetch()}
        />
      </SectionCard>
    );
  if (reps.length === 0)
    return (
      <SectionCard title="Rep Closing Leaderboard" bodyClassName="p-0">
        <EmptyState
          icon={<span className="material-symbols-outlined text-[28px]">leaderboard</span>}
          title="No rep data yet"
          description="Closed-won performance will appear here once reps close deals."
        />
      </SectionCard>
    );

  return (
    <SectionCard
      title="Rep Closing Leaderboard"
      description={`Won deals, revenue, win rate, and pipeline for ${periodLabel(period)}`}
      actions={
        reps[0] ? (
          <Link
            to="/app/analytics/$repId"
            params={{ repId: reps[0].id }}
            className="text-[12px] font-semibold text-primary hover:underline"
          >
            View top rep
          </Link>
        ) : null
      }
      bodyClassName="overflow-x-auto p-0"
    >
      <div className="grid gap-3 border-b border-border p-4 md:grid-cols-3">
        <LeaderboardHighlight
          icon="workspace_premium"
          label="Top closer"
          value={topCloser ? topCloser.name : "—"}
          detail={topCloser ? `${topCloser.closed} won · ${formatCurrency(topCloser.revenue)}` : ""}
        />
        <LeaderboardHighlight
          icon="payments"
          label="Highest revenue"
          value={topRevenue ? topRevenue.name : "—"}
          detail={topRevenue ? formatCurrency(topRevenue.revenue) : ""}
        />
        <LeaderboardHighlight
          icon="percent"
          label="Best win rate"
          value={bestWinRate ? bestWinRate.name : "—"}
          detail={bestWinRate ? `${bestWinRate.winRate.toFixed(1)}% win rate` : ""}
        />
      </div>
      <table className="w-full min-w-[920px] border-collapse text-left">
        <thead className="bg-primary-light text-[11px] uppercase tracking-wider text-text-secondary">
          <tr>
            <th className="px-5 py-3 text-center font-bold">Rank</th>
            <th className="px-5 py-3 font-bold">Rep Name</th>
            <th className="px-4 py-3 text-center font-bold">New Leads</th>
            <th className="px-4 py-3 text-center font-bold">Won</th>
            <th className="px-4 py-3 text-center font-bold">Closed</th>
            <th className="px-4 py-3 text-right font-bold">Revenue</th>
            <th className="px-4 py-3 text-center font-bold">Win Rate</th>
            <th className="px-4 py-3 text-right font-bold">Avg Won Deal</th>
            <th className="px-4 py-3 text-center font-bold">Open</th>
            <th className="px-4 py-3 text-center font-bold">Trend</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {reps.map((rep) => (
            <tr key={rep.id} className="transition-colors hover:bg-surface-hover">
              <td className="px-5 py-4 text-center">
                <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-muted px-2 text-[12px] font-bold text-text-secondary">
                  #{rep.rank}
                </span>
              </td>
              <td className="px-5 py-4">
                <Link
                  to="/app/analytics/$repId"
                  params={{ repId: rep.id }}
                  className="flex items-center gap-3"
                >
                  <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-primary-light text-[12px] font-bold text-primary">
                    {rep.initials}
                    {rep.rank === 1 ? (
                      <span className="material-symbols-outlined absolute -left-2 -top-3 rotate-[-18deg] text-[18px] text-accent">
                        workspace_premium
                      </span>
                    ) : null}
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-foreground">{rep.name}</p>
                    <p className="text-[12px] text-text-muted">{rep.role}</p>
                  </div>
                </Link>
              </td>
              <td className="px-4 py-4 text-center text-sm">{rep.leads}</td>
              <td className="px-4 py-4 text-center text-sm">{rep.closed}</td>
              <td className="px-4 py-4 text-center text-sm">
                {rep.totalClosed}
                {rep.lost > 0 ? (
                  <span className="ml-1 text-[11px] text-text-muted">({rep.lost} lost)</span>
                ) : null}
              </td>
              <td className="px-4 py-4 text-right text-sm font-semibold">
                {formatCurrency(rep.revenue)}
              </td>
              <td className="px-4 py-4 text-center">
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-bold",
                    rep.winRate >= 32
                      ? "bg-success-light text-success"
                      : rep.winRate >= 22
                        ? "bg-warning-light text-warning"
                        : "bg-danger-light text-danger",
                  )}
                >
                  {rep.winRate.toFixed(1)}%
                </span>
              </td>
              <td className="px-4 py-4 text-right text-sm">{formatCurrency(rep.dealSize)}</td>
              <td className="px-4 py-4 text-center text-sm">{rep.openDeals}</td>
              <td className={cn("px-4 py-4 text-center", trendColor(rep.trend))}>
                <span className="material-symbols-outlined">{trendIcon(rep.trend)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </SectionCard>
  );
}

function LeaderboardHighlight({
  icon,
  label,
  value,
  detail,
}: {
  icon: string;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">{label}</p>
        <p className="truncate text-sm font-semibold text-foreground">{value}</p>
        {detail ? <p className="truncate text-[12px] text-text-secondary">{detail}</p> : null}
      </div>
    </div>
  );
}

function WinLossAnalysis({ period }: { period: AnalyticsPeriod }) {
  const { data: kpis = [] } = useAnalyticsKpis(period);
  const { data: lossReasons = [], isLoading, isError, error, refetch } = useLossReasonAnalytics();

  const winRateKpi = kpis[2];
  const winRate = winRateKpi?.progress ?? 0;
  const circumference = 239;
  const winArc = Math.round((winRate / 100) * circumference);
  const lossArc = circumference - winArc;

  if (isLoading)
    return (
      <SectionCard title="Win/Loss Analysis" description="Top reasons for lost opportunities">
        <TableSkeleton rows={5} columns={2} />
      </SectionCard>
    );
  if (isError)
    return (
      <SectionCard title="Win/Loss Analysis" description="Top reasons for lost opportunities">
        <ErrorState
          description={(error as Error)?.message ?? "Could not load data"}
          onRetry={() => refetch()}
        />
      </SectionCard>
    );

  return (
    <SectionCard title="Win/Loss Analysis" description="Top reasons for lost opportunities">
      <div className="flex flex-col items-center">
        <div className="relative mb-6 h-44 w-44">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="38"
              fill="transparent"
              stroke="var(--color-border)"
              strokeWidth="12"
            />
            {winArc > 0 && (
              <circle
                cx="50"
                cy="50"
                r="38"
                fill="transparent"
                stroke="var(--color-primary)"
                strokeDasharray={`${winArc} ${circumference}`}
                strokeLinecap="round"
                strokeWidth="12"
              />
            )}
            {lossArc > 0 && winArc > 0 && (
              <circle
                cx="50"
                cy="50"
                r="38"
                fill="transparent"
                stroke="var(--color-danger)"
                strokeDasharray={`${lossArc} ${circumference}`}
                strokeDashoffset={-winArc}
                strokeLinecap="round"
                strokeWidth="12"
              />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-semibold">{winRateKpi?.value ?? "—"}</span>
            <span className="text-[12px] font-semibold text-text-muted">Win Rate</span>
          </div>
        </div>
        <div className="w-full space-y-3">
          {lossReasons.length === 0 ? (
            <p className="text-center text-sm text-text-muted">No closed-lost deals yet</p>
          ) : (
            lossReasons.map((item) => (
              <div key={item.reason} className="flex items-center justify-between gap-3">
                <span className="text-[13px] text-text-secondary">{item.reason}</span>
                <div className="flex min-w-[130px] items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-danger"
                      style={{ width: `${item.percent}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-[11px] font-bold">{item.percent}%</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </SectionCard>
  );
}

function LeadSourceEfficiency() {
  const { data: sources = [], isLoading, isError, error, refetch } = useLeadSources();
  const max = sources.length > 0 ? Math.max(...sources.map((s) => s.leads)) : 1;

  if (isLoading)
    return (
      <SectionCard
        title="Lead Source Efficiency"
        description="Volume vs conversion rate per channel"
      >
        <GridSkeleton count={4} className="grid-cols-1 md:grid-cols-2 xl:grid-cols-4" />
      </SectionCard>
    );
  if (isError)
    return (
      <SectionCard
        title="Lead Source Efficiency"
        description="Volume vs conversion rate per channel"
      >
        <ErrorState
          description={(error as Error)?.message ?? "Could not load data"}
          onRetry={() => refetch()}
        />
      </SectionCard>
    );
  if (sources.length === 0)
    return (
      <SectionCard
        title="Lead Source Efficiency"
        description="Volume vs conversion rate per channel"
      >
        <EmptyState
          icon={<span className="material-symbols-outlined text-[28px]">ads_click</span>}
          title="No lead source data"
          description="Lead source data will appear here once leads have been captured."
        />
      </SectionCard>
    );

  return (
    <SectionCard
      title="Lead Source Efficiency"
      description="Volume vs conversion rate per channel"
      actions={
        <div className="flex flex-wrap items-center gap-4 text-[12px] font-semibold">
          <LegendSwatch className="bg-primary" label="Volume" />
          <LegendSwatch className="bg-accent" label="Conv %" />
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {sources.map((source) => (
          <article key={source.source} className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-end justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                {source.source}
              </span>
              <span className="text-sm font-semibold">{source.leads} Leads</span>
            </div>
            <div className="relative h-24 overflow-hidden rounded-lg bg-muted p-4">
              <div
                className="absolute bottom-0 left-0 right-0 bg-primary/15"
                style={{ height: `${(source.leads / max) * 100}%` }}
              />
              <div className="relative z-10 flex h-full flex-col justify-end">
                <p className="text-[24px] font-bold text-primary">
                  {source.conversion.toFixed(1)}%
                </p>
                <p className="text-[12px] font-semibold text-text-secondary">Conversion Rate</p>
              </div>
            </div>
            <div className="mt-3 grid gap-2">
              <div>
                <div className="mb-1 flex justify-between text-[11px] font-semibold text-text-muted">
                  <span>Lead volume</span>
                  <span>{Math.round((source.leads / max) * 100)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(source.leads / max) * 100}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-[11px] font-semibold text-text-muted">
                  <span>Conversion</span>
                  <span>{source.conversion.toFixed(1)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${source.conversion}%` }}
                  />
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </SectionCard>
  );
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-text-secondary">
      <span className={cn("h-3 w-3 rounded-full", className)} />
      {label}
    </span>
  );
}

function buildChartPaths(data: RevenuePoint[]) {
  const max = Math.max(...data.flatMap((point) => [point.actual, point.target]));
  const toPoint = (value: number, index: number) => {
    const x = data.length === 1 ? 500 : 24 + (index / (data.length - 1)) * 952;
    const y = 220 - (value / max) * 200;
    return { x, y };
  };
  const actualPoints = data.map((point, index) => toPoint(point.actual, index));
  const targetPoints = data.map((point, index) => toPoint(point.target, index));
  const line = (points: ReadonlyArray<{ x: number; y: number }>) =>
    points.map(({ x, y }, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  return {
    actual: line(actualPoints),
    target: line(targetPoints),
    area: `${line(actualPoints)} L976,230 L24,230 Z`,
    actualPoints,
    targetPoints,
    max,
  };
}

function trendIcon(trend: "up" | "down" | "flat") {
  if (trend === "up") return "trending_up";
  if (trend === "down") return "trending_down";
  return "trending_flat";
}

function trendColor(trend: "up" | "down" | "flat") {
  if (trend === "up") return "text-success";
  if (trend === "down") return "text-danger";
  return "text-warning";
}

function periodLabel(period: AnalyticsPeriod) {
  if (period === "week") return "this week";
  if (period === "quarter") return "this quarter";
  if (period === "year") return "this year";
  return "this month";
}
