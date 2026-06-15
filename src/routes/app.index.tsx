import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, ToolbarButton, SectionCard } from "@/components/layout";
import { EmptyState } from "@/components/common";

export const Route = createFileRoute("/app/")({
  component: DashboardPlaceholder,
});

function DashboardPlaceholder() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        breadcrumbs={[{ label: "CRM" }, { label: "Dashboard" }]}
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
      <SectionCard title="Shared component library ready" description="Feature 0 complete. The Dashboard will be wired in Feature 1.">
        <EmptyState
          icon={<span className="material-symbols-outlined text-[28px]">dashboard</span>}
          title="Dashboard coming up next"
          description="Sidebar, topbar, page header, filter bar, status badges, loading skeletons, empty and error states are all in place and ready to be reused by every feature module."
        />
      </SectionCard>
    </>
  );
}
