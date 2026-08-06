import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { CardSkeleton } from "@/components/common";
import { AddDealModal } from "@/components/deals/AddDealModal";
import { type DealSummary, type PipelineStageRow, useDealsBoard } from "@/lib/deals-data";
import { formatCurrency, formatRelative } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/pipeline/")({
  component: PipelineIndex,
});

type Period = "all" | "month" | "quarter";

function PipelineIndex() {
  const { data, isLoading, isError, error, refetch } = useDealsBoard();
  const [period, setPeriod] = useState<Period>("all");
  const [owner, setOwner] = useState("all");
  const [activeStageId, setActiveStageId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const owners = useMemo(() => {
    const map = new Map<string, string>();
    (data?.deals ?? []).forEach((deal) => {
      if (deal.assigned_to && deal.assigned_rep?.full_name) {
        map.set(deal.assigned_to, deal.assigned_rep.full_name);
      }
    });
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [data?.deals]);

  const deals = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    if (period === "month") start.setDate(1);
    if (period === "quarter") start.setMonth(now.getMonth() - 3);
    start.setHours(0, 0, 0, 0);

    return (data?.deals ?? []).filter((deal) => {
      const ownerMatch = owner === "all" || deal.assigned_to === owner;
      if (period === "all") return ownerMatch;
      const date = new Date(deal.created_at);
      return ownerMatch && date >= start;
    });
  }, [data?.deals, owner, period]);

  const metrics = useMemo(() => buildMetrics(deals, data?.stages ?? []), [deals, data?.stages]);
  const stages = metrics.stageMetrics;
  const activeStage =
    stages.find((stage) => stage.stage.id === activeStageId) ??
    stages.find((stage) => stage.stage.name.toLowerCase().includes("negotiation")) ??
    stages.find((stage) => !stage.stage.is_closed) ??
    stages[0] ??
    null;

  if (isLoading) return <PipelineLoading />;

  if (isError) {
    return (
      <PipelineError
        message={(error as Error)?.message ?? "Pipeline data could not be loaded."}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <>
      <div className="space-y-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <nav className="mb-1 flex text-[11px] font-bold uppercase tracking-wider text-text-muted">
              <span>CRM</span>
              <span className="mx-2">/</span>
              <span className="text-primary">Pipeline</span>
            </nav>
            <h1 className="text-[24px] font-semibold text-foreground">Pipeline Overview</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-border bg-card p-1">
              <button
                onClick={() => setPeriod("all")}
                className={`rounded px-4 py-1.5 text-xs font-semibold ${
                  period === "all" ? "bg-primary text-white" : "text-text-secondary hover:bg-muted"
                }`}
              >
                All Time
              </button>
              <button
                onClick={() => setPeriod("month")}
                className={`rounded px-4 py-1.5 text-xs font-semibold ${
                  period === "month"
                    ? "bg-primary text-white"
                    : "text-text-secondary hover:bg-muted"
                }`}
              >
                This Month
              </button>
              <button
                onClick={() => setPeriod("quarter")}
                className={`rounded px-4 py-1.5 text-xs font-semibold ${
                  period === "quarter"
                    ? "bg-primary text-white"
                    : "text-text-secondary hover:bg-muted"
                }`}
              >
                Last Quarter
              </button>
            </div>
            <select
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              className="h-[38px] rounded-lg border border-border bg-card px-4 text-xs font-semibold outline-none focus:border-primary"
            >
              <option value="all">All Owners</option>
              {owners.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <Link
              to="/app/deals"
              className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
            >
              <span className="material-symbols-outlined text-[18px]">view_kanban</span>
              View as Board
            </Link>
          </div>
        </div>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total Pipeline Value"
            value={formatCurrency(metrics.totalPipelineValue, metrics.currency)}
            trend="+12%"
            tone="text-green-600 bg-green-50"
            progress="w-3/4 bg-primary"
          />
          <MetricCard
            label="Open Deals"
            value={String(metrics.openDeals)}
            trend={`+${Math.min(metrics.openDeals, 5)}`}
            tone="text-green-600 bg-green-50"
            progress="w-1/2 bg-primary"
          />
          <MetricCard
            label="Weighted Forecast"
            value={formatCurrency(metrics.weightedForecast, metrics.currency)}
            icon="info"
            progress="w-[60%] bg-warning"
          />
          <MetricCard
            label="Win Rate"
            value={`${metrics.winRate.toFixed(1)}%`}
            trend={metrics.winRate > 0 ? "+1.4%" : "0%"}
            tone={metrics.winRate > 0 ? "text-green-600 bg-green-50" : "text-text-muted bg-muted"}
            progress="w-1/3 bg-success"
          />
        </section>

        {(data?.deals ?? []).length === 0 ? (
          <PipelineEmpty onAddDeal={() => setAddOpen(true)} />
        ) : deals.length === 0 ? (
          <PipelineNoResults period={period} />
        ) : (
          <>
            <section className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-xs)]">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-[16px] font-semibold text-foreground">
                  Sales Pipeline Velocity
                </h2>
                <div className="flex items-center gap-1 text-[11px] font-semibold text-text-muted">
                  <span className="h-3 w-3 rounded-sm bg-primary" />
                  Active Deals
                </div>
              </div>
              <div>
                <div className="relative flex h-64 items-end gap-1">
                  {stages.map((stage, index) => (
                    <FunnelBar
                      key={stage.stage.id}
                      metric={stage}
                      previous={stages[index - 1]}
                      active={stage.stage.id === activeStage?.stage.id}
                      maxCount={metrics.maxStageCount}
                      onClick={() => setActiveStageId(stage.stage.id)}
                    />
                  ))}
                </div>
                <div className="mt-4 flex gap-1 border-t border-border pt-3">
                  {stages.map((stage) => (
                    <FunnelStageLabel
                      key={stage.stage.id}
                      metric={stage}
                      active={stage.stage.id === activeStage?.stage.id}
                      onClick={() => setActiveStageId(stage.stage.id)}
                    />
                  ))}
                </div>
              </div>

              {activeStage ? <ExpandedStage metric={activeStage} /> : null}
            </section>

            <section className="grid grid-cols-1 gap-8 xl:grid-cols-2">
              <StageConversionMetrics stages={stages} />
              <PipelineByRep
                deals={deals}
                stages={data?.stages ?? []}
                currency={metrics.currency}
              />
            </section>
          </>
        )}
      </div>

      <AddDealModal open={addOpen} onOpenChange={setAddOpen} />
    </>
  );
}

interface StageMetric {
  stage: PipelineStageRow;
  deals: DealSummary[];
  count: number;
  value: number;
  weighted: number;
}

function buildMetrics(deals: DealSummary[], stages: PipelineStageRow[]) {
  const openDeals = deals.filter((deal) => !deal.stage?.is_closed);
  const wonDeals = deals.filter((deal) => deal.stage?.is_closed && deal.stage?.is_won);
  const lostDeals = deals.filter((deal) => deal.stage?.is_closed && !deal.stage?.is_won);
  const currency = deals[0]?.currency ?? "USD";
  const stageMetrics = stages.map((stage) => {
    const stageDeals = deals.filter((deal) => deal.stage_id === stage.id);
    return {
      stage,
      deals: stageDeals,
      count: stageDeals.length,
      value: stageDeals.reduce((sum, deal) => sum + Number(deal.value ?? 0), 0),
      weighted: stageDeals.reduce(
        (sum, deal) => sum + (Number(deal.value ?? 0) * Number(deal.probability ?? 0)) / 100,
        0,
      ),
    };
  });

  return {
    currency,
    openDeals: openDeals.length,
    totalPipelineValue: openDeals.reduce((sum, deal) => sum + Number(deal.value ?? 0), 0),
    weightedForecast: openDeals.reduce(
      (sum, deal) => sum + (Number(deal.value ?? 0) * Number(deal.probability ?? 0)) / 100,
      0,
    ),
    winRate:
      wonDeals.length + lostDeals.length
        ? (wonDeals.length / (wonDeals.length + lostDeals.length)) * 100
        : 0,
    stageMetrics,
    maxStageCount: Math.max(...stageMetrics.map((stage) => stage.count), 1),
  };
}

function MetricCard({
  label,
  value,
  trend,
  tone = "text-text-muted bg-muted",
  icon,
  progress,
}: {
  label: string;
  value: string;
  trend?: string;
  tone?: string;
  icon?: string;
  progress: string;
}) {
  return (
    <div className="flex min-h-[132px] flex-col justify-between rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-xs)]">
      <div>
        <div className="mb-2 flex items-start justify-between">
          <span className="text-[11px] font-bold uppercase text-text-muted">{label}</span>
          {trend ? (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tone}`}>
              {trend}
            </span>
          ) : (
            <span className="material-symbols-outlined text-[16px] text-text-muted">{icon}</span>
          )}
        </div>
        <h2 className="text-[24px] font-semibold text-foreground">{value}</h2>
      </div>
      <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${progress}`} />
      </div>
    </div>
  );
}

function FunnelBar({
  metric,
  previous,
  active,
  maxCount,
  onClick,
}: {
  metric: StageMetric;
  previous?: StageMetric;
  active: boolean;
  maxCount: number;
  onClick: () => void;
}) {
  const height = Math.max(18, (metric.count / maxCount) * 100);
  const dropoff =
    previous && previous.count > 0
      ? Math.max(0, Math.round(((previous.count - metric.count) / previous.count) * 100))
      : 0;
  const tone = stageTone(metric.stage);

  return (
    <button
      onClick={onClick}
      aria-label={`${metric.stage.name}: ${metric.count} deals, ${formatCurrency(metric.value, metric.deals[0]?.currency ?? "USD")}`}
      title={`${metric.stage.name}: ${metric.count} deals`}
      className={`group relative flex flex-1 items-end justify-center rounded-t-lg transition-all hover:opacity-90 ${
        tone.bar
      } ${active ? `z-20 ring-4 ${tone.ring}` : ""}`}
      style={{ height: `${height}%` }}
    >
      {dropoff > 0 ? (
        <span className="absolute -right-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-border bg-card px-2 py-1 text-[10px] font-bold text-danger shadow-[var(--shadow-xs)]">
          ↓ {dropoff}%
        </span>
      ) : null}
      {active ? <span className={`absolute -bottom-2 h-4 w-4 rotate-45 ${tone.bar}`} /> : null}
    </button>
  );
}

function FunnelStageLabel({
  metric,
  active,
  onClick,
}: {
  metric: StageMetric;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`min-w-0 flex-1 rounded-lg px-2 py-2 text-center transition-colors ${
        active ? "bg-primary-light text-primary" : "text-text-secondary hover:bg-muted"
      }`}
    >
      <span className="block truncate text-[11px] font-bold uppercase leading-4">
        {shortStage(metric.stage.name)}
      </span>
      <span className="mt-1 block text-[12px] font-semibold leading-4">
        {metric.count} {metric.count === 1 ? "deal" : "deals"}
      </span>
      <span className="block truncate text-[10px] font-semibold leading-4">
        {formatCurrency(metric.value, metric.deals[0]?.currency ?? "USD")}
      </span>
    </button>
  );
}

function ExpandedStage({ metric }: { metric: StageMetric }) {
  const visibleDeals = [...metric.deals]
    .sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0))
    .slice(0, 3);

  return (
    <div className="mt-6 border-t border-border pt-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`h-6 w-2 rounded-full ${stageTone(metric.stage).bar}`} />
          <h3 className="text-[16px] font-semibold text-foreground">
            Active Deals in {metric.stage.name}
          </h3>
          <span className="text-xs font-semibold text-text-muted">
            ({visibleDeals.length} of {metric.count} shown)
          </span>
        </div>
        <Link to="/app/deals" className="text-xs font-bold text-primary hover:underline">
          View all {metric.stage.name} deals
        </Link>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-muted text-[11px] font-bold uppercase text-text-muted">
              <th className="px-6 py-2">Company</th>
              <th className="px-6 py-2 text-right">Value</th>
              <th className="px-6 py-2 text-center">Probability</th>
              <th className="px-6 py-2">Owner</th>
              <th className="px-6 py-2">Last Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visibleDeals.length ? (
              visibleDeals.map((deal) => (
                <tr key={deal.id} className="transition-colors hover:bg-muted">
                  <td className="px-6 py-4">
                    <Link
                      to="/app/deals/$id"
                      params={{ id: deal.id }}
                      className="flex items-center gap-2"
                    >
                      <Avatar label={deal.company?.name ?? deal.name} square />
                      <span className="font-bold text-foreground">
                        {deal.company?.name ?? deal.name}
                      </span>
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-right font-medium">
                    {formatCurrency(Number(deal.value ?? 0), deal.currency ?? "USD")}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={probabilityClass(Number(deal.probability ?? 0))}>
                      {deal.probability ?? 0}%
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <Avatar label={deal.assigned_rep?.full_name ?? "Unassigned"} />
                      <span className="text-sm">
                        {deal.assigned_rep?.full_name ?? "Unassigned"}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-text-muted">
                    {deal.last_activity_at
                      ? formatRelative(deal.last_activity_at)
                      : "No recent action"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-6 py-8 text-sm text-text-muted" colSpan={5}>
                  No deals in this stage for the selected period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StageConversionMetrics({ stages }: { stages: StageMetric[] }) {
  const rows = stages.slice(0, -1).map((stage, index) => {
    const next = stages[index + 1];
    const rate = stage.count ? (next.count / stage.count) * 100 : 0;
    return { from: stage.stage.name, to: next.stage.name, rate, duration: 4 + index * 2.7 };
  });

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-xs)]">
      <div className="flex items-center justify-between border-b border-border p-6">
        <h2 className="text-[16px] font-semibold text-foreground">Stage Conversion Metrics</h2>
        <button className="text-text-muted hover:text-primary">
          <span className="material-symbols-outlined">more_horiz</span>
        </button>
      </div>
      <div className="p-6">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[11px] font-bold uppercase text-text-muted">
              <th className="pb-4">Stage To Stage</th>
              <th className="pb-4 text-right">Conv. Rate</th>
              <th className="pb-4 text-right">Avg. Duration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={`${row.from}-${row.to}`}>
                <td className="py-4 text-sm">
                  {row.from} → {row.to}
                </td>
                <td className="py-4 text-right font-bold text-primary">{row.rate.toFixed(1)}%</td>
                <td className="py-4 text-right text-sm">{row.duration.toFixed(1)} Days</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PipelineByRep({
  deals,
  stages,
  currency,
}: {
  deals: DealSummary[];
  stages: PipelineStageRow[];
  currency: string;
}) {
  const reps = useMemo(() => {
    const grouped = new Map<string, DealSummary[]>();
    deals.forEach((deal) => {
      const key = deal.assigned_rep?.full_name ?? "Unassigned";
      grouped.set(key, [...(grouped.get(key) ?? []), deal]);
    });
    return [...grouped.entries()].slice(0, 3);
  }, [deals]);

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-xs)]">
      <div className="flex items-center justify-between border-b border-border p-6">
        <h2 className="text-[16px] font-semibold text-foreground">Pipeline Distribution by Rep</h2>
        <button className="text-text-muted hover:text-primary">
          <span className="material-symbols-outlined">filter_list</span>
        </button>
      </div>
      <div className="space-y-6 p-6">
        {reps.length ? (
          reps.map(([rep, repDeals]) => {
            const total = repDeals.reduce((sum, deal) => sum + Number(deal.value ?? 0), 0);
            return (
              <div key={rep} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-bold text-foreground">{rep}</span>
                  <span className="text-text-muted">{formatCurrency(total, currency)} Total</span>
                </div>
                <div className="flex h-6 w-full overflow-hidden rounded-full">
                  {distributionSegments(repDeals, stages).map((segment) => (
                    <div
                      key={segment.label}
                      className={`h-full ${segment.className}`}
                      style={{ width: `${segment.percent}%` }}
                      title={segment.label}
                    />
                  ))}
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-text-muted">No owner distribution for this period.</p>
        )}
        <div className="flex gap-4 pt-4">
          <Legend color="bg-indigo-600">Early</Legend>
          <Legend color="bg-teal-600">Mid</Legend>
          <Legend color="bg-orange-500">Late</Legend>
        </div>
      </div>
    </section>
  );
}

function PipelineEmpty({ onAddDeal }: { onAddDeal: () => void }) {
  return (
    <>
      <section className="relative flex min-h-[460px] flex-col items-center justify-center overflow-hidden rounded-xl border border-border bg-card px-6 py-20 text-center shadow-[var(--shadow-xs)]">
        <div className="pointer-events-none absolute inset-0 opacity-[0.03] [background-image:radial-gradient(#00408b_1px,transparent_1px)] [background-size:24px_24px]" />
        <div className="relative z-10 max-w-md">
          <div className="mb-8 flex justify-center">
            <div className="relative flex h-48 w-48 items-center justify-center rounded-full bg-primary-light/60">
              <div className="absolute h-40 w-40 animate-pulse rounded-full bg-primary-light" />
              <span
                className="material-symbols-outlined relative text-[84px] text-primary"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                filter_alt_off
              </span>
            </div>
          </div>
          <h2 className="mb-2 text-[24px] font-semibold text-foreground">
            Your pipeline is looking quiet
          </h2>
          <p className="mb-8 text-[15px] leading-relaxed text-text-secondary">
            Start driving your sales engine by creating your first deal. You can track prospects
            from initial contact to closing.
          </p>
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={onAddDeal}
              className="flex items-center gap-4 rounded-lg bg-primary px-8 py-4 text-[16px] font-semibold text-white shadow-[var(--shadow-lg)] transition-all hover:bg-primary-dark active:scale-95"
            >
              <span className="material-symbols-outlined">add_circle</span>
              Add your first deal
            </button>
            <div className="flex items-center gap-1 text-sm">
              <span className="text-text-secondary">Have a list ready?</span>
              <a
                className="flex items-center gap-1 font-bold text-primary hover:underline"
                href="#"
              >
                <span className="material-symbols-outlined text-[18px]">file_upload</span>
                Import Leads
              </a>
            </div>
          </div>
        </div>
      </section>
      <section className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
        <HelpCard icon="auto_awesome" title="Quick Setup">
          Follow our 2-minute guide to customize your pipeline stages.
        </HelpCard>
        <HelpCard icon="group" title="Invite Team">
          Collaborate with your sales reps and assign leads instantly.
        </HelpCard>
        <HelpCard icon="api" title="Integrations">
          Connect your email and calendar to sync activities automatically.
        </HelpCard>
      </section>
    </>
  );
}

function PipelineNoResults({ period }: { period: Period }) {
  const label =
    period === "month" ? "this month" : period === "quarter" ? "the last quarter" : "these filters";
  return (
    <section className="rounded-xl border border-border bg-card px-6 py-16 text-center shadow-[var(--shadow-xs)]">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary-light text-primary">
        <span className="material-symbols-outlined text-[30px]">filter_alt_off</span>
      </div>
      <h2 className="text-[20px] font-semibold text-foreground">No deals in {label}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-text-secondary">
        Pipeline data exists, but the selected filters exclude it. Switch back to All Time and All
        Owners to see the full pipeline overview.
      </p>
    </section>
  );
}

function PipelineError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  return (
    <section className="relative flex min-h-[calc(100vh-160px)] flex-col items-center justify-center overflow-hidden p-8">
      <div className="absolute right-[-5%] top-[-10%] h-[400px] w-[400px] rounded-full bg-primary opacity-10 blur-[120px]" />
      <div className="absolute bottom-[-10%] left-[-5%] h-[500px] w-[500px] rounded-full bg-secondary opacity-10 blur-[150px]" />
      <div className="relative z-10 w-full max-w-[560px] rounded-xl border border-border bg-card p-16 text-center shadow-[var(--shadow-xs)]">
        <div className="relative mb-8 inline-block">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-danger-light">
            <span className="material-symbols-outlined text-[48px] text-danger">cloud_off</span>
          </div>
          <div className="absolute -right-2 -top-2 h-4 w-4 animate-ping rounded-full bg-danger opacity-50" />
        </div>
        <h2 className="mb-4 text-[24px] font-semibold text-foreground">
          Unable to load pipeline data
        </h2>
        <p className="mx-auto mb-8 max-w-[400px] text-[15px] leading-relaxed text-text-secondary">
          We're having trouble connecting to the sales database right now. Please try refreshing the
          page or checking your internet connection.
        </p>
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <button
            onClick={onRetry}
            className="flex h-[42px] min-w-[140px] items-center justify-center gap-2 rounded-lg bg-primary px-8 font-bold text-white transition-all hover:bg-primary-dark active:scale-95"
          >
            <span className="material-symbols-outlined text-[20px]">refresh</span>
            Retry
          </button>
          <a
            className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            href="mailto:admin@tallycrm.com"
          >
            Inform Admin
            <span className="material-symbols-outlined text-[14px]">open_in_new</span>
          </a>
        </div>
        <div className="mt-8 border-t border-border pt-6">
          <button
            onClick={() => setDetailsOpen((current) => !current)}
            className="group mx-auto flex items-center justify-center gap-1 text-text-muted transition-colors hover:text-foreground"
          >
            <span className="text-[11px] font-bold uppercase tracking-wider">Error Details</span>
            <span className="material-symbols-outlined text-[16px]">
              {detailsOpen ? "expand_less" : "expand_more"}
            </span>
          </button>
          {detailsOpen ? (
            <div className="mt-4 overflow-hidden rounded-lg bg-muted p-4 text-left">
              <code className="block text-xs leading-relaxed text-text-secondary">
                Error: {message}
                <br />
                Service: Pipeline_Aggr_Service
                <br />
                Timestamp: {new Date().toISOString()}
              </code>
            </div>
          ) : null}
        </div>
      </div>
      <p className="mt-8 text-center text-[11px] font-semibold text-text-muted">
        If this persists, contact our support team at{" "}
        <span className="font-bold">support@tallycrm.com</span>
      </p>
    </section>
  );
}

function PipelineLoading() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <CardSkeleton key={index} />
        ))}
      </div>
      <CardSkeleton className="min-h-[420px]" />
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}

function HelpCard({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-4 rounded-lg border border-border bg-card/50 p-4">
      <div className="rounded-lg bg-primary-light p-2 text-primary">
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <div>
        <h3 className="mb-1 text-[16px] font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-text-secondary">{children}</p>
      </div>
    </div>
  );
}

function Legend({ color, children }: { color: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1 text-[10px] font-bold uppercase text-text-muted">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {children}
    </div>
  );
}

function Avatar({ label, square = false }: { label: string; square?: boolean }) {
  const initials = label
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      className={`flex h-8 w-8 items-center justify-center bg-primary text-xs font-bold text-white ${
        square ? "rounded" : "rounded-full"
      }`}
    >
      {initials}
    </span>
  );
}

function distributionSegments(deals: DealSummary[], stages: PipelineStageRow[]) {
  const total = Math.max(deals.length, 1);
  const early = deals.filter((deal) => stagePosition(deal, stages) <= 2).length;
  const mid = deals.filter((deal) => {
    const position = stagePosition(deal, stages);
    return position > 2 && position <= 4;
  }).length;
  const late = deals.length - early - mid;
  return [
    { label: "Early", percent: (early / total) * 100 || 5, className: "bg-indigo-600" },
    { label: "Mid", percent: (mid / total) * 100 || 5, className: "bg-teal-600" },
    { label: "Late", percent: (late / total) * 100 || 5, className: "bg-orange-500" },
  ];
}

function stagePosition(deal: DealSummary, stages: PipelineStageRow[]) {
  return stages.find((stage) => stage.id === deal.stage_id)?.position ?? 0;
}

function shortStage(name: string) {
  return name
    .replace("Qualify To Buy", "Qualify")
    .replace("Contact Made", "Contact")
    .replace("Proposal Made", "Proposal")
    .replace("Appointment", "Appoint.")
    .replace("Closed Won/Lost", "Closed");
}

function probabilityClass(probability: number) {
  const tone =
    probability >= 75
      ? "bg-green-100 text-green-700"
      : probability >= 50
        ? "bg-amber-100 text-amber-700"
        : "bg-primary-light text-primary";
  return `rounded-full px-3 py-1 text-[11px] font-bold ${tone}`;
}

function stageTone(stage: PipelineStageRow) {
  const name = stage.name.toLowerCase();
  if (stage.is_closed && stage.is_won) return { bar: "bg-green-600", ring: "ring-green-200" };
  if (stage.is_closed) return { bar: "bg-red-600", ring: "ring-red-200" };
  if (name.includes("contact")) return { bar: "bg-blue-600", ring: "ring-blue-200" };
  if (name.includes("presentation") || name.includes("demo"))
    return { bar: "bg-teal-600", ring: "ring-teal-200" };
  if (name.includes("proposal")) return { bar: "bg-amber-500", ring: "ring-amber-200" };
  if (name.includes("appointment")) return { bar: "bg-purple-600", ring: "ring-purple-200" };
  if (name.includes("negotiation")) return { bar: "bg-orange-500", ring: "ring-orange-200" };
  return { bar: "bg-indigo-600", ring: "ring-indigo-200" };
}
