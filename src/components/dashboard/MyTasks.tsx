import { SectionCard } from "@/components/layout";
import { EmptyState, Icon } from "@/components/common";
import { useMyTasks } from "@/lib/dashboard-data";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { formatTaskDue } from "@/lib/format";

const PRIORITY_STYLES = {
  high: "bg-cta/10 text-cta",
  medium: "bg-warning/15 text-warning",
  low: "bg-muted text-text-secondary",
} as const;

export function MyTasks() {
  const { user } = useAuth();
  const { data, isLoading } = useMyTasks(user?.id);
  const tasks = data ?? [];

  return (
    <SectionCard title="My Tasks" description="Open tasks assigned to you.">
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg skeleton" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={<Icon name="task_alt" className="h-6 w-6" />}
          title="You're all caught up"
          description="New tasks land here when they're assigned to you."
        />
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => {
            const overdue = t.due_at ? new Date(t.due_at) < new Date() : false;
            return (
              <li
                key={t.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5"
              >
                <input type="checkbox" className="h-4 w-4 accent-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{t.title}</p>
                  <p
                    className={cn(
                      "flex items-center gap-1 text-xs",
                      overdue ? "font-semibold text-cta" : "text-text-secondary",
                    )}
                  >
                    <Icon name="event" className="h-[14px] w-[14px]" />
                    {formatTaskDue(t.due_at)}
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                    PRIORITY_STYLES[t.priority],
                  )}
                >
                  {t.priority}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
