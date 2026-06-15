import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, ToolbarButton } from "@/components/layout";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { PipelineFunnel } from "@/components/dashboard/PipelineFunnel";
import { LeadSourceDonut } from "@/components/dashboard/LeadSourceDonut";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { MyTasks } from "@/components/dashboard/MyTasks";
import { MiniPipeline } from "@/components/dashboard/MiniPipeline";
import { useDashboardKpis } from "@/lib/dashboard-data";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/")({
  component: DashboardPage,
});

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function DashboardPage() {
  const { user } = useAuth();
  const { data: kpis, isLoading } = useDashboardKpis();

  const firstName = user?.fullName?.split(" ")[0] ?? "there";

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        breadcrumbs={[{ label: "CRM" }, { label: "Dashboard" }]}
        description={
          user?.role === "rep"
            ? "Your pipeline, tasks and recent activity."
            : "Team pipeline, KPIs and recent activity across all reps."
        }
        actions={
          <>
            <ToolbarButton icon="ios_share">Export</ToolbarButton>
            <ToolbarButton icon="refresh" title="Refresh" />
            <ToolbarButton icon="add" variant="cta">
              Quick Add
            </ToolbarButton>
          </>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon="person_add"
          label="New Leads Today"
          value={kpis ? String(kpis.newLeadsToday) : "0"}
          delta={kpis?.newLeadsDelta}
          loading={isLoading}
          tone="primary"
        />
        <KpiCard
          icon="handshake"
          label="Open Deals"
          value={kpis ? String(kpis.openDeals) : "0"}
          caption={kpis ? formatCurrency(kpis.openDealsValue) + " pipeline value" : undefined}
          loading={isLoading}
          tone="accent"
        />
        <KpiCard
          icon="emoji_events"
          label="Closed Won (Month)"
          value={kpis ? String(kpis.closedWonMonth) : "0"}
          caption={kpis ? formatCurrency(kpis.closedWonValue) + " booked" : undefined}
          loading={isLoading}
          tone="success"
        />
        <KpiCard
          icon="conversion_path"
          label="Conversion Rate"
          value={kpis ? `${kpis.conversionRate.toFixed(1)}%` : "0%"}
          loading={isLoading}
          tone="warning"
        />
      </div>

      {/* Funnel + Donut */}
      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <PipelineFunnel />
        </div>
        <LeadSourceDonut />
      </div>

      {/* Activity + Tasks */}
      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ActivityFeed />
        <MyTasks />
      </div>

      {/* Mini Pipeline */}
      <div className="mt-5">
        <MiniPipeline />
      </div>
    </>
  );
}
