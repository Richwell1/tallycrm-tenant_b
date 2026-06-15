import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader, SectionCard, ToolbarButton } from "@/components/layout";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency } from "@/lib/format";
import {
  FUNNEL_STAGES,
  REP_ACTIVITIES,
  REP_OUTCOMES,
  REVENUE_POINTS,
  findRep,
  type RepActivity,
  type RepOutcome,
} from "@/lib/analytics-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/analytics/$repId")({
  component: RepAnalyticsPage,
});

function RepAnalyticsPage() {
  const { repId } = Route.useParams();
  const { user } = useAuth();
  const rep = findRep(repId);

  if (user?.role === "rep") {
    return (
      <>
        <PageHeader
          title="Rep Performance"
          breadcrumbs={[
            { label: "CRM" },
            { label: "Analytics", to: "/app/analytics" },
            { label: "Restricted" },
          ]}
        />
        <SectionCard>
          <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary-light text-primary">
              <span className="material-symbols-outlined text-[30px]">lock</span>
            </div>
            <h2 className="text-lg font-semibold text-foreground">Rep reporting is manager-only</h2>
            <p className="mt-2 max-w-md text-sm text-text-secondary">
              This view compares individual reps against team goals and is available to Admins and
              Sales Managers.
            </p>
          </div>
        </SectionCard>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Rep Performance Deep-Dive"
        breadcrumbs={[
          { label: "CRM" },
          { label: "Analytics", to: "/app/analytics" },
          { label: rep.name },
        ]}
        actions={
          <>
            <ToolbarButton
              icon="download"
              onClick={() => toast.success(`${rep.name}'s report export prepared`)}
            >
              Export PDF
            </ToolbarButton>
            <ToolbarButton
              icon="mail"
              variant="primary"
              onClick={() =>
                toast.success("Contact task created", {
                  description: `Follow-up task queued for ${rep.name}.`,
                })
              }
            >
              Contact Rep
            </ToolbarButton>
          </>
        }
      />

      <section className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative flex h-24 w-24 items-center justify-center rounded-xl border-4 border-card bg-primary-light text-2xl font-bold text-primary shadow-[var(--shadow-sm)]">
            {rep.initials}
            <span className="absolute -bottom-2 -right-2 h-6 w-6 rounded-full border-4 border-card bg-success" />
          </div>
          <div>
            <h2 className="text-[24px] font-semibold tracking-tight text-foreground">{rep.name}</h2>
            <p className="text-[15px] text-text-secondary">
              {rep.role} - {rep.region} Region
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-primary-light px-2 py-1 text-[11px] font-bold text-primary">
                <span className="material-symbols-outlined text-[14px]">trending_up</span>
                Rank #{rep.rank} Performer
              </span>
              <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-text-muted">
                <span className="material-symbols-outlined text-[16px]">location_on</span>
                {rep.location}
              </span>
            </div>
          </div>
        </div>
        <Link
          to="/app/analytics"
          className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-4 text-[13px] font-semibold text-foreground transition-colors hover:bg-surface-hover"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          All Analytics
        </Link>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <RepKpi
          icon="account_tree"
          label="Active Pipeline"
          value={formatCurrency(rep.pipeline)}
          caption="+12% vs last month"
          tone="primary"
        />
        <RepKpi
          icon="flag"
          label="Quota Attainment"
          value={`${rep.quota.toFixed(1)}%`}
          caption="Current period target"
          tone="success"
          progress={rep.quota}
        />
        <RepKpi
          icon="payments"
          label="Avg Deal Size"
          value={formatCurrency(rep.dealSize)}
          caption="Target: GHS 40.0K"
          tone="accent"
        />
        <RepKpi
          icon="speed"
          label="Sales Velocity"
          value={`${rep.velocityDays} Days`}
          caption={rep.velocityDays <= 30 ? "Ahead of team average" : "+2 days from avg"}
          tone="warning"
        />
      </section>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-12">
        <section className="xl:col-span-8">
          <PerformanceBars />
        </section>
        <section className="xl:col-span-4">
          <PersonalFunnel />
        </section>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-12">
        <section className="xl:col-span-4">
          <ActivitySummary />
        </section>
        <section className="xl:col-span-8">
          <RecentOutcomes />
        </section>
      </div>

      <section className="mt-5 flex flex-wrap items-center gap-5 rounded-xl border border-primary/20 bg-primary-light/60 p-5 shadow-[var(--shadow-xs)]">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-white">
          <span className="material-symbols-outlined text-[32px]">lightbulb</span>
        </div>
        <div className="min-w-[240px] flex-1">
          <h3 className="text-[16px] font-semibold text-primary">Rep Insights: Speed to Lead</h3>
          <p className="mt-1 max-w-3xl text-sm text-text-secondary">
            {rep.name.split(" ")[0]}'s current sales velocity is trending at {rep.velocityDays}{" "}
            days. Follow-up on high-intent Tally Landing Page leads should stay under 24 hours to
            protect the current quota pace.
          </p>
        </div>
        <button
          onClick={() =>
            toast.success("Strategy plan opened", {
              description: "Speed-to-lead coaching actions are ready for review.",
            })
          }
          className="inline-flex h-10 items-center rounded-lg bg-primary px-5 text-[13px] font-semibold text-primary-foreground hover:bg-primary-dark"
        >
          View Strategy Plan
        </button>
      </section>
    </>
  );
}

function RepKpi({
  icon,
  label,
  value,
  caption,
  tone,
  progress,
}: {
  icon: string;
  label: string;
  value: string;
  caption: string;
  tone: "primary" | "accent" | "success" | "warning";
  progress?: number;
}) {
  const colors = {
    primary: "text-primary bg-primary-light",
    accent: "text-accent-dark bg-accent-light",
    success: "text-success bg-success-light",
    warning: "text-warning bg-warning-light",
  }[tone];

  return (
    <article className="flex min-h-32 flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
          {label}
        </span>
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", colors)}>
          <span className="material-symbols-outlined">{icon}</span>
        </span>
      </div>
      <div>
        <div className="text-[24px] font-semibold tracking-tight text-foreground">{value}</div>
        {progress !== undefined ? (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
          </div>
        ) : null}
        <div className="mt-2 text-[12px] font-medium text-text-muted">{caption}</div>
      </div>
    </article>
  );
}

function PerformanceBars() {
  const visible = REVENUE_POINTS.slice(0, 6);
  const max = Math.max(...visible.flatMap((point) => [point.actual, point.target]));

  return (
    <SectionCard
      title="Performance vs Target"
      description="Fiscal year revenue attainment"
      actions={
        <div className="flex items-center gap-4 text-[12px] font-semibold text-text-secondary">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-primary" />
            Actuals
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-border-strong" />
            Target
          </span>
        </div>
      }
    >
      <div className="relative flex h-[300px] items-end justify-between gap-4 rounded-lg border border-border bg-card px-5 pb-9 pt-5">
        <div className="absolute inset-x-5 top-5 flex h-[220px] flex-col justify-between">
          {[0, 1, 2, 3].map((line) => (
            <div key={line} className="border-t border-dashed border-border" />
          ))}
        </div>
        {visible.map((point) => (
          <div
            key={point.label}
            className="relative z-10 flex h-full flex-1 flex-col items-center justify-end"
          >
            <div className="relative flex h-[220px] w-12 items-end justify-center">
              <div
                className="absolute bottom-0 h-full w-8 rounded-t bg-border-strong"
                style={{ height: `${(point.target / max) * 100}%` }}
              />
              <div
                className="relative w-8 rounded-t bg-primary transition-all hover:bg-primary-dark"
                style={{ height: `${(point.actual / max) * 100}%` }}
              />
            </div>
            <span className="absolute bottom-0 text-[12px] font-semibold text-text-muted">
              {point.label}
            </span>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function PersonalFunnel() {
  const stages = FUNNEL_STAGES.map((stage, index) => ({
    ...stage,
    count: Math.max(14, Math.round(stage.count * [0.34, 0.21, 0.16, 0.12, 0.09, 0.07][index])),
  }));
  const max = stages[0]?.count ?? 1;

  return (
    <SectionCard title="Personal Funnel Efficiency" className="h-full">
      <div className="flex min-h-[280px] flex-col justify-center gap-3">
        {stages.map((stage, index) => (
          <div key={stage.name} className="flex justify-center">
            <div
              className={cn(
                "flex h-11 items-center justify-center px-3 text-center text-[12px] font-bold",
                index === stages.length - 1 ? "text-foreground" : "text-white",
              )}
              style={{
                width: `${Math.max(24, (stage.count / max) * 100)}%`,
                background:
                  index === stages.length - 1
                    ? "var(--color-primary-light)"
                    : `color-mix(in oklab, var(--color-primary) ${100 - index * 12}%, white)`,
                clipPath: "polygon(0% 0%, 100% 0%, 84% 100%, 16% 100%)",
              }}
            >
              {stage.name}: {stage.count}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 text-center">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
            L2Q Rate
          </div>
          <div className="text-[18px] font-semibold text-foreground">44%</div>
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
            Q2C Rate
          </div>
          <div className="text-[18px] font-semibold text-foreground">7.6%</div>
        </div>
      </div>
    </SectionCard>
  );
}

function ActivitySummary() {
  return (
    <SectionCard
      title="Activity Log Summary"
      actions={
        <button className="text-[12px] font-semibold text-primary hover:underline">View All</button>
      }
      bodyClassName="space-y-4"
    >
      {REP_ACTIVITIES.map((activity, index) => (
        <ActivityRow
          key={activity.title}
          activity={activity}
          isLast={index === REP_ACTIVITIES.length - 1}
        />
      ))}
    </SectionCard>
  );
}

function ActivityRow({ activity, isLast }: { activity: RepActivity; isLast: boolean }) {
  const icon = {
    call: "call",
    email: "mail",
    meeting: "handshake",
    task: "task_alt",
  }[activity.type];
  const tone = {
    call: "bg-info-light text-info",
    email: "bg-warning-light text-warning",
    meeting: "bg-success-light text-success",
    task: "bg-primary-light text-primary",
  }[activity.type];

  return (
    <div className="relative flex gap-3">
      {!isLast ? (
        <span className="absolute left-[13px] top-7 h-[calc(100%+16px)] w-px bg-border" />
      ) : null}
      <div
        className={cn(
          "relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          tone,
        )}
      >
        <span className="material-symbols-outlined text-[16px]">{icon}</span>
      </div>
      <div>
        <p className="text-[13px] font-semibold text-foreground">{activity.title}</p>
        <p className="mt-0.5 text-[12px] text-text-secondary">{activity.description}</p>
        <p className="mt-1 text-[11px] font-semibold text-text-muted">{activity.time}</p>
      </div>
    </div>
  );
}

function RecentOutcomes() {
  return (
    <SectionCard
      title="Recent Outcomes"
      actions={
        <div className="flex rounded-md bg-muted p-0.5 text-[12px] font-semibold">
          <button className="rounded bg-card px-3 py-1 shadow-[var(--shadow-xs)]">All</button>
          <button className="px-3 py-1 text-text-muted hover:text-foreground">Wins</button>
          <button className="px-3 py-1 text-text-muted hover:text-foreground">Losses</button>
        </div>
      }
      bodyClassName="overflow-x-auto p-0"
    >
      <table className="w-full min-w-[760px] text-left">
        <thead className="bg-primary-light text-[11px] uppercase tracking-wider text-text-secondary">
          <tr>
            <th className="px-5 py-3 font-bold">Company / Contact</th>
            <th className="px-4 py-3 text-right font-bold">Value</th>
            <th className="px-4 py-3 text-center font-bold">Status</th>
            <th className="px-4 py-3 font-bold">Closing Reason</th>
            <th className="px-4 py-3 font-bold">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {REP_OUTCOMES.map((outcome) => (
            <OutcomeRow key={`${outcome.company}-${outcome.date}`} outcome={outcome} />
          ))}
        </tbody>
      </table>
    </SectionCard>
  );
}

function OutcomeRow({ outcome }: { outcome: RepOutcome }) {
  const badge = {
    won: "bg-success-light text-success",
    lost: "bg-danger-light text-danger",
    draft: "bg-muted text-text-secondary",
    pending: "bg-accent-light text-accent-dark",
  }[outcome.status];

  return (
    <tr className="transition-colors hover:bg-surface-hover">
      <td className="px-5 py-4">
        <p className="text-[13px] font-semibold text-foreground">{outcome.company}</p>
        <p className="text-[12px] text-text-muted">{outcome.contact}</p>
      </td>
      <td className="px-4 py-4 text-right text-sm font-semibold">
        {formatCurrency(outcome.value)}
      </td>
      <td className="px-4 py-4 text-center">
        <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold uppercase", badge)}>
          {outcome.status}
        </span>
      </td>
      <td className="px-4 py-4 text-[13px] text-text-secondary">{outcome.reason}</td>
      <td className="px-4 py-4 text-[12px] font-semibold text-text-muted">{outcome.date}</td>
    </tr>
  );
}
