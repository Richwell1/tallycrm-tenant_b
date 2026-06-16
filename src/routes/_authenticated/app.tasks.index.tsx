import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AddTaskModal } from "@/components/tasks/AddTaskModal";
import { EmptyState, ErrorState } from "@/components/common";
import { PageHeader, SectionCard, ToolbarButton, CrmToolbar } from "@/components/layout";
import {
  type TaskItem,
  type TaskPriority,
  type TaskStatus,
  useTasks,
  useToggleTaskCompletion,
} from "@/lib/tasks-data";
import { cn } from "@/lib/utils";
import { formatTaskDue, formatRelative } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/tasks/")({
  component: TasksIndex,
});

type StatusFilter = "all" | "open" | "completed";
type SortKey = "due" | "priority" | "recent";

const STATUS_FILTERS: Array<{ label: string; value: StatusFilter }> = [
  { label: "All Tasks", value: "all" },
  { label: "Open", value: "open" },
  { label: "Completed", value: "completed" },
];

const PRIORITY_FILTERS: Array<{ label: string; value: "all" | TaskPriority }> = [
  { label: "All Priorities", value: "all" },
  { label: "High", value: "high" },
  { label: "Medium", value: "medium" },
  { label: "Low", value: "low" },
];

const SORT_OPTIONS: Array<{ label: string; value: SortKey }> = [
  { label: "Due date", value: "due" },
  { label: "Priority", value: "priority" },
  { label: "Recent", value: "recent" },
];

function TasksIndex() {
  const { data: tasks, isLoading, isError, error, refetch } = useTasks();
  const toggleCompletion = useToggleTaskCompletion();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | TaskPriority>("all");
  const [sortKey, setSortKey] = useState<SortKey>("due");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const source = (tasks ?? []).filter((task) => {
      const statusMatch =
        statusFilter === "all" ||
        (statusFilter === "open" && task.status !== "done" && task.status !== "cancelled") ||
        (statusFilter === "completed" && task.status === "done");
      const priorityMatch = priorityFilter === "all" || task.priority === priorityFilter;
      const searchMatch =
        !q ||
        [
          task.title,
          task.notes,
          task.contact ? `${task.contact.first_name} ${task.contact.last_name}` : null,
          task.deal?.name,
          task.company?.name,
          task.owner?.full_name,
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(q));
      return statusMatch && priorityMatch && searchMatch;
    });

    return source.sort((a, b) => {
      if (sortKey === "priority") return priorityRank(b.priority) - priorityRank(a.priority);
      if (sortKey === "recent")
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      return taskDueRank(a) - taskDueRank(b);
    });
  }, [priorityFilter, search, sortKey, statusFilter, tasks]);

  const groups = useMemo(() => groupTasks(filtered), [filtered]);
  const stats = useMemo(() => buildStats(tasks ?? []), [tasks]);
  const nextTask =
    filtered.find((item) => item.status !== "done" && item.status !== "cancelled") ?? null;

  async function handleToggle(task: TaskItem, completed: boolean) {
    try {
      await toggleCompletion.mutateAsync({ task, completed });
      toast.success(completed ? "Task completed" : "Task reopened");
    } catch (err) {
      toast.error("Could not update task", { description: (err as Error).message });
    }
  }

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title="Tasks"
          count={tasks?.length ?? 0}
          breadcrumbs={[{ label: "CRM", to: "/app" }, { label: "Tasks" }]}
          actions={
            <>
              <ToolbarButton icon="file_download" title="Export tasks">
                Export
              </ToolbarButton>
              <ToolbarButton icon="add" variant="cta" onClick={() => setAddOpen(true)}>
                Add Task
              </ToolbarButton>
            </>
          }
        />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <SectionCard className="overflow-hidden" bodyClassName="p-0">
            <div className="flex flex-col gap-4 border-b border-border px-5 py-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <label className="block space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    Search
                  </span>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="input"
                    placeholder="Title, contact, deal, owner..."
                    type="search"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    Status
                  </span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                    className="input"
                  >
                    {STATUS_FILTERS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    Priority
                  </span>
                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value as "all" | TaskPriority)}
                    className="input"
                  >
                    {PRIORITY_FILTERS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    Sort
                  </span>
                  <select
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as SortKey)}
                    className="input"
                  >
                    {SORT_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {isLoading ? (
              <TaskListSkeleton />
            ) : isError ? (
              <div className="p-6">
                <ErrorState
                  description={(error as Error)?.message ?? "Could not load tasks"}
                  onRetry={() => refetch()}
                />
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<span className="material-symbols-outlined text-[28px]">task_alt</span>}
                  title="No tasks found"
                  description="Create tasks for calls, emails, meetings, and follow-ups with due dates and reminders."
                  action={
                    <button
                      onClick={() => setAddOpen(true)}
                      className="rounded-lg bg-cta px-4 py-2 text-sm font-semibold text-white"
                    >
                      Add Task
                    </button>
                  }
                />
              </div>
            ) : (
              <div className="space-y-6 p-5">
                {groups.map((group) => (
                  <section key={group.key} className="space-y-3">
                    <div className="flex items-center gap-3">
                      <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">
                        {group.label}
                      </h3>
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-[11px] font-semibold text-text-muted">
                        {group.items.length}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {group.items.map((task) => {
                        const checked = task.status === "done";
                        const overdue = isOverdue(task);
                        return (
                          <div
                            key={task.id}
                            className={cn(
                              "group flex items-center gap-3 rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-xs)] transition-all hover:shadow-[var(--shadow-sm)]",
                              checked ? "opacity-75" : "",
                              taskAccent(task),
                            )}
                          >
                            <span className="drag-handle material-symbols-outlined text-text-muted/50">
                              drag_indicator
                            </span>
                            <input
                              checked={checked}
                              disabled={task.locked}
                              onChange={(e) => handleToggle(task, e.target.checked)}
                              type="checkbox"
                              className="h-4 w-4 rounded border-border text-primary"
                            />
                            <button className="text-text-muted/50 transition-colors hover:text-cta">
                              <span
                                className="material-symbols-outlined"
                                style={{ fontVariationSettings: checked ? "'FILL' 1" : "'FILL' 0" }}
                              >
                                star
                              </span>
                            </button>
                            <div className="min-w-0 flex-1">
                              <p
                                className={cn(
                                  "truncate text-[15px] font-semibold text-foreground",
                                  checked ? "line-through decoration-text-muted/50" : "",
                                )}
                              >
                                {task.title}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <StatusBadge status={task.status} />
                                <TypeBadge type={task.type} />
                                <PriorityBadge priority={task.priority} />
                                {task.reminder_at ? (
                                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-secondary-foreground">
                                    Reminder
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-text-secondary">
                                <span className="flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[16px]">
                                    event
                                  </span>
                                  {task.due_at ? formatTaskDue(task.due_at) : "No due date"}
                                </span>
                                {task.owner ? (
                                  <span className="flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[16px]">
                                      person
                                    </span>
                                    {task.owner.full_name}
                                  </span>
                                ) : null}
                                {task.deal ? (
                                  <Link
                                    to="/app/deals/$id"
                                    params={{ id: task.deal.id }}
                                    className="flex items-center gap-1 text-primary hover:underline"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">
                                      handshake
                                    </span>
                                    {task.deal.name}
                                  </Link>
                                ) : null}
                                {task.contact ? (
                                  <Link
                                    to="/app/contacts/$id"
                                    params={{ id: task.contact.id }}
                                    className="flex items-center gap-1 text-primary hover:underline"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">
                                      person
                                    </span>
                                    {task.contact.first_name} {task.contact.last_name}
                                  </Link>
                                ) : null}
                                {task.company ? (
                                  <span className="flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[16px]">
                                      business
                                    </span>
                                    {task.company.name}
                                  </span>
                                ) : null}
                              </div>
                              {task.notes ? (
                                <p className="mt-2 line-clamp-2 text-sm text-text-muted">
                                  {task.notes}
                                </p>
                              ) : null}
                            </div>
                            <div className="text-right">
                              <p
                                className={cn(
                                  "text-[11px] font-semibold uppercase tracking-wider",
                                  overdue ? "text-danger" : "text-text-muted",
                                )}
                              >
                                {checked ? "Completed" : overdue ? "Overdue" : "Due"}
                              </p>
                              <p className="text-sm text-text-secondary">
                                {task.completed_at
                                  ? formatRelative(task.completed_at)
                                  : task.due_at
                                    ? formatRelative(task.due_at)
                                    : "Unscheduled"}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </SectionCard>

          <div className="space-y-4">
            <SectionCard title="Overview" description="Live status for your open work.">
              <div className="grid grid-cols-2 gap-3">
                <StatTile label="Open" value={stats.open} tone="bg-primary-light text-primary" />
                <StatTile
                  label="Overdue"
                  value={stats.overdue}
                  tone="bg-danger-light text-danger"
                />
                <StatTile
                  label="Due Soon"
                  value={stats.dueSoon}
                  tone="bg-warning-light text-warning"
                />
                <StatTile
                  label="Done Today"
                  value={stats.completedToday}
                  tone="bg-success-light text-success"
                />
              </div>
              <div className="mt-4 rounded-lg border border-border bg-muted p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                  Next Up
                </p>
                <p className="mt-1 text-[15px] font-semibold text-foreground">
                  {nextTask?.title ?? "No pending tasks"}
                </p>
                <p className="mt-1 text-sm text-text-secondary">
                  {nextTask?.due_at
                    ? formatTaskDue(nextTask.due_at)
                    : "Create a task to get started."}
                </p>
              </div>
            </SectionCard>

            <SectionCard title="Task Flow" description="Quick reminders and completion live here.">
              <div className="space-y-3 text-sm text-text-secondary">
                <p>• Open tasks sit in the list until completed or cancelled.</p>
                <p>• Checkboxes mark tasks done and restore them when unchecked.</p>
                <p>• Reminder timestamps are stored with each task for downstream dispatch.</p>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>

      <button
        onClick={() => setAddOpen(true)}
        className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-cta text-white shadow-[var(--shadow-lg)] transition-all hover:scale-110 active:scale-95"
      >
        <span className="material-symbols-outlined text-[28px]">add</span>
      </button>

      <AddTaskModal open={addOpen} onOpenChange={setAddOpen} />
    </>
  );
}

function TaskListSkeleton() {
  return (
    <div className="space-y-6 p-5">
      {Array.from({ length: 3 }).map((_, groupIndex) => (
        <div key={groupIndex} className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-3 w-28 skeleton" />
            <div className="h-px flex-1 bg-border" />
            <div className="h-3 w-6 skeleton" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((__, rowIndex) => (
              <div
                key={rowIndex}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-4"
              >
                <div className="h-4 w-4 skeleton rounded" />
                <div className="h-4 w-4 skeleton rounded-full" />
                <div className="h-10 w-10 skeleton rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-2/3 skeleton" />
                  <div className="h-3 w-1/2 skeleton" />
                </div>
                <div className="h-8 w-24 skeleton" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatTile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className={`text-[22px] font-semibold leading-tight ${tone}`}>{value}</p>
      <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-text-muted">{label}</p>
    </div>
  );
}

function groupTasks(items: TaskItem[]) {
  const groups = new Map<string, TaskItem[]>();
  for (const item of items) {
    const key = groupKey(item);
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }

  return Array.from(groups.entries())
    .map(([key, groupItems]) => ({
      key,
      label: labelForKey(key),
      items: groupItems.sort((a, b) => taskDueRank(a) - taskDueRank(b)),
    }))
    .sort((a, b) => labelRank(a.key) - labelRank(b.key));
}

function groupKey(task: TaskItem) {
  const base = task.completed_at ?? task.due_at ?? task.created_at;
  const date = new Date(base);
  return date.toISOString().slice(0, 10);
}

function labelForKey(key: string) {
  const date = new Date(`${key}T00:00:00`);
  const today = startOfDay();
  const diff = Math.round((startOfDay(date).getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === -1) return "Yesterday";
  if (diff === 1) return "Tomorrow";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function labelRank(key: string) {
  const date = new Date(`${key}T00:00:00`).getTime();
  return Number.isFinite(date) ? -date : Number.MAX_SAFE_INTEGER;
}

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function buildStats(items: TaskItem[]) {
  const open = items.filter((item) => item.status !== "done" && item.status !== "cancelled");
  const overdue = open.filter(isOverdue).length;
  const dueSoon = open.filter((item) => {
    if (!item.due_at) return false;
    const diffDays = Math.ceil((new Date(item.due_at).getTime() - Date.now()) / 86_400_000);
    return diffDays >= 0 && diffDays <= 7;
  }).length;
  const completedToday = items.filter((item) => {
    if (item.status !== "done" || !item.completed_at) return false;
    return startOfDay(new Date(item.completed_at)).getTime() === startOfDay().getTime();
  }).length;
  return { open: open.length, overdue, dueSoon, completedToday };
}

function taskDueRank(task: TaskItem) {
  const date = task.due_at ?? task.completed_at ?? task.created_at;
  return new Date(date).getTime();
}

function priorityRank(priority: TaskPriority) {
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}

function isOverdue(task: TaskItem) {
  return (
    task.status !== "done" &&
    task.status !== "cancelled" &&
    !!task.due_at &&
    new Date(task.due_at).getTime() < Date.now()
  );
}

function taskAccent(task: TaskItem) {
  if (task.status === "done") return "border-l-4 border-l-success";
  if (isOverdue(task) || task.priority === "high") return "border-l-4 border-l-cta";
  if (task.priority === "medium") return "border-l-4 border-l-warning";
  return "border-l-4 border-l-primary";
}

function StatusBadge({ status }: { status: TaskStatus }) {
  const meta =
    status === "done"
      ? { label: "Completed", tone: "bg-success-light text-success" }
      : status === "in_progress"
        ? { label: "In Progress", tone: "bg-warning-light text-warning" }
        : status === "cancelled"
          ? { label: "Cancelled", tone: "bg-danger-light text-danger" }
          : { label: "Pending", tone: "bg-primary-light text-primary" };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${meta.tone}`}
    >
      {meta.label}
    </span>
  );
}

function TypeBadge({ type }: { type: string | null }) {
  const label = typeLabel(type);
  const tone = typeTone(type);
  const icon = typeIcon(type);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tone}`}
    >
      <span className="material-symbols-outlined text-[14px]">{icon}</span>
      {label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const tone =
    priority === "high"
      ? "bg-danger-light text-danger"
      : priority === "medium"
        ? "bg-warning-light text-warning"
        : "bg-secondary text-secondary-foreground";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tone}`}
    >
      {priority}
    </span>
  );
}

function typeLabel(type: string | null) {
  if (!type) return "Task";
  if (type === "call") return "Call";
  if (type === "email") return "Email";
  if (type === "meeting") return "Meeting";
  if (type === "task") return "Task";
  if (type === "activity_reminder") return "Reminder";
  return "Manual";
}

function typeTone(type: string | null) {
  if (type === "call") return "bg-info-light text-info";
  if (type === "email") return "bg-warning-light text-warning";
  if (type === "meeting") return "bg-primary-light text-primary";
  if (type === "task") return "bg-secondary text-secondary-foreground";
  return "bg-muted text-text-secondary";
}

function typeIcon(type: string | null) {
  if (type === "call") return "call";
  if (type === "email") return "mail";
  if (type === "meeting") return "groups";
  if (type === "task") return "check_circle";
  if (type === "activity_reminder") return "notifications";
  return "task_alt";
}
