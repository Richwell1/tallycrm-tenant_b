import { SectionCard } from "@/components/layout";
import { EmptyState } from "@/components/common";
import { useRecentActivity } from "@/lib/dashboard-data";
import { formatRelative } from "@/lib/format";

const ICONS: Record<string, string> = {
  call: "call",
  email: "mail",
  meeting: "groups",
  demo: "slideshow",
  proposal: "description",
  note: "sticky_note_2",
};

export function ActivityFeed() {
  const { data, isLoading } = useRecentActivity(10);
  const items = data ?? [];

  return (
    <SectionCard
      title="Recent Activity Feed"
      description="Last 10 events visible to you."
      actions={<button className="text-xs font-semibold text-primary hover:underline">View All</button>}
    >
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg skeleton" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<span className="material-symbols-outlined text-[24px]">history</span>}
          title="No activity yet"
          description="Calls, emails and meetings appear here as your team logs them."
        />
      ) : (
        <ul className="space-y-3">
          {items.map((a) => (
            <li key={a.id} className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <span className="material-symbols-outlined text-[18px]">
                  {ICONS[a.type] ?? "bolt"}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{a.title}</p>
                {a.notes && (
                  <p className="truncate text-xs text-text-secondary">{a.notes}</p>
                )}
                <p className="mt-0.5 text-[11px] text-text-secondary">
                  {formatRelative(a.created_at)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
