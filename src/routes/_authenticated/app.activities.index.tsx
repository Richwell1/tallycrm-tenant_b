import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common";
import { PageHeader, ToolbarButton, CrmToolbar } from "@/components/layout";
import { ActivityDetailPanel } from "@/components/activities/ActivityDetailPanel";
import { AddActivityModal } from "@/components/activities/AddActivityModal";
import { type ActivityItem, type ActivityType, useActivities } from "@/lib/activities-data";
import { formatRelative } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/activities/")({
  component: ActivitiesIndex,
});

type Filter = "all" | "call" | "email" | "task" | "meeting";
type ActivitySort = "due" | "recent" | "owner";

const filters: Array<{ label: string; value: Filter }> = [
  { label: "All Activities", value: "all" },
  { label: "Calls", value: "call" },
  { label: "Emails", value: "email" },
  { label: "Tasks", value: "task" },
  { label: "Meetings", value: "meeting" },
];

function ActivitiesIndex() {
  const { data: activities, isLoading, isError, error, refetch } = useActivities();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<ActivitySort>("due");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeItem, setActiveItem] = useState<ActivityItem | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (activities ?? []).filter((item) => {
      const typeMatch = filter === "all" || item.type === filter;
      const searchMatch =
        !q ||
        [
          item.title,
          item.notes,
          item.outcome,
          item.contact ? `${item.contact.first_name} ${item.contact.last_name}` : null,
          item.deal?.name,
          item.company?.name,
          item.owner?.full_name,
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(q));
      return typeMatch && searchMatch;
    });

    return list.sort((a, b) => {
      if (sortKey === "owner")
        return (a.owner?.full_name ?? "").localeCompare(b.owner?.full_name ?? "");
      if (sortKey === "recent") return dateRank(b.created_at) - dateRank(a.created_at);
      return dateRank(a.due_at) - dateRank(b.due_at);
    });
  }, [activities, filter, search, sortKey]);

  const stats = useMemo(() => buildStats(activities ?? []), [activities]);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((current) =>
      current.size === filtered.length ? new Set() : new Set(filtered.map((item) => item.id)),
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <nav className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-text-muted">
              <span>CRM</span>
              <span className="material-symbols-outlined text-[12px]">chevron_right</span>
              <span className="text-primary">Activities</span>
            </nav>
            <div className="flex items-center gap-4">
              <h1 className="text-[24px] font-semibold text-foreground">Activities</h1>
              <span className="rounded-full border border-primary/20 bg-primary-light px-2 py-1 text-xs font-semibold text-primary">
                {activities?.length ?? 0} Total
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex h-10 items-center gap-2 rounded border border-border bg-card px-4 text-[16px] font-semibold text-foreground shadow-[var(--shadow-xs)] transition-all hover:bg-muted">
              <span className="material-symbols-outlined">file_download</span>
              Export
            </button>
            <button
              onClick={() => setAddOpen(true)}
              className="flex h-10 items-center gap-2 rounded bg-danger px-4 text-[16px] font-semibold text-white shadow-[var(--shadow-xs)] transition-all hover:bg-danger/90"
            >
              <span className="material-symbols-outlined">add</span>
              Add New Activity
            </button>
          </div>
        </div>

        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-xs)]">
          <div className="flex flex-col items-center border-b border-border md:flex-row">
            <div className="flex w-full overflow-x-auto md:w-auto">
              {filters.map((item) => (
                <button
                  key={item.value}
                  onClick={() => setFilter(item.value)}
                  className={`whitespace-nowrap border-b-2 px-6 py-4 text-sm transition-colors ${
                    filter === item.value
                      ? "border-primary text-[16px] font-semibold text-primary"
                      : "border-transparent text-text-muted hover:text-foreground"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="flex w-full items-center gap-2 border-t border-border px-4 py-2 md:ml-auto md:w-auto md:border-t-0">
              <div className="relative flex-1 md:w-64">
                <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-[18px] text-text-muted">
                  filter_list
                </span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 w-full border-none bg-transparent pl-8 text-sm outline-none focus:ring-0"
                  placeholder="Quick search..."
                  type="search"
                />
              </div>
              <button className="rounded p-1 text-text-muted hover:text-foreground">
                <span className="material-symbols-outlined">more_vert</span>
              </button>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as ActivitySort)}
                className="h-8 rounded-lg border border-border bg-card px-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="due">Due date</option>
                <option value="recent">Recent</option>
                <option value="owner">Owner</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <TableSkeleton rows={8} columns={8} />
          ) : isError ? (
            <div className="p-6">
              <ErrorState
                description={(error as Error)?.message ?? "Could not load activities"}
                onRetry={() => refetch()}
              />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10">
              <EmptyState
                icon={<span className="material-symbols-outlined text-[28px]">event_note</span>}
                title="No activities found"
                description="Log calls, emails, tasks, meetings, demos, proposals, and notes here."
                action={
                  <button
                    onClick={() => setAddOpen(true)}
                    className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white"
                  >
                    Add Activity
                  </button>
                }
              />
            </div>
          ) : (
            <ActivitiesTable
              activities={filtered}
              selected={selected}
              onToggle={toggle}
              onToggleAll={toggleAll}
              onOpen={setActiveItem}
            />
          )}

          <footer className="flex flex-col items-center justify-between gap-4 border-t border-border bg-card px-4 py-4 md:flex-row">
            <span className="text-sm text-text-secondary">
              Showing{" "}
              <span className="font-bold text-foreground">1-{Math.min(filtered.length, 10)}</span>{" "}
              of <span className="font-bold text-foreground">{filtered.length}</span> activities
            </span>
            <Pagination />
          </footer>
        </section>

        <section className="grid grid-cols-1 gap-6 md:grid-cols-4">
          <StatCard
            icon="check_circle"
            label="Completed"
            value={stats.completed}
            tone="bg-green-50 text-green-600"
          />
          <StatCard
            icon="warning"
            label="Overdue"
            value={stats.overdue}
            tone="bg-danger-light text-danger"
          />
          <div className="relative overflow-hidden rounded-xl border border-transparent bg-sidebar p-4 text-white shadow-[var(--shadow-xs)] md:col-span-2">
            <div className="relative z-10">
              <p className="text-[11px] font-bold uppercase tracking-wider opacity-70">
                Next Priority
              </p>
              <p className="mb-1 text-[16px] font-semibold">
                {stats.nextPriority?.title ?? "No pending work"}
              </p>
              <p className="flex items-center gap-1 text-sm opacity-70">
                <span className="material-symbols-outlined text-[14px]">alarm</span>
                {stats.nextPriority?.due_at
                  ? formatRelative(stats.nextPriority.due_at)
                  : "Clear queue"}
              </p>
            </div>
            <div className="absolute bottom-0 right-0 top-0 w-32 translate-x-16 -skew-x-12 bg-primary/20" />
            <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-[36px] text-primary-light opacity-40">
              rocket_launch
            </span>
          </div>
        </section>
      </div>

      <button
        onClick={() => setAddOpen(true)}
        className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-[var(--shadow-lg)] transition-all hover:scale-110 active:scale-95"
      >
        <span className="material-symbols-outlined text-[28px]">add</span>
      </button>

      <AddActivityModal open={addOpen} onOpenChange={setAddOpen} />
      <ActivityDetailPanel
        item={activeItem}
        open={!!activeItem}
        onOpenChange={(open) => {
          if (!open) setActiveItem(null);
        }}
      />
    </>
  );
}

function ActivitiesTable({
  activities,
  selected,
  onToggle,
  onToggleAll,
  onOpen,
}: {
  activities: ActivityItem[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onOpen: (item: ActivityItem) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead className="border-b border-border bg-muted">
          <tr>
            <th className="w-12 px-4 py-3 text-center">
              <input
                checked={selected.size === activities.length && activities.length > 0}
                onChange={onToggleAll}
                className="h-4 w-4 rounded border-border text-primary"
                type="checkbox"
              />
            </th>
            <HeaderCell>Title</HeaderCell>
            <HeaderCell>Type</HeaderCell>
            <HeaderCell>Status</HeaderCell>
            <HeaderCell>Due Date</HeaderCell>
            <HeaderCell>Owner</HeaderCell>
            <HeaderCell>Created At</HeaderCell>
            <HeaderCell align="right">Actions</HeaderCell>
          </tr>
        </thead>
        <tbody className="divide-y divide-border text-sm">
          {activities.map((item, index) => (
            <tr
              key={`${item.source}-${item.id}`}
              onClick={() => onOpen(item)}
              className={`group cursor-pointer transition-colors hover:bg-primary/5 ${
                index % 2 === 1 ? "bg-muted/40" : "bg-card"
              } ${isOverdue(item) ? "border-l-4 border-danger" : ""}`}
            >
              <td onClick={(e) => e.stopPropagation()} className="px-4 py-3 text-center">
                <input
                  checked={selected.has(item.id)}
                  onChange={() => onToggle(item.id)}
                  className="h-4 w-4 rounded border-border text-primary"
                  type="checkbox"
                />
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-col">
                  <span className="text-[16px] font-semibold text-foreground">{item.title}</span>
                  <span className="max-w-[240px] truncate text-sm text-text-muted">
                    {item.deal
                      ? `Project: ${item.deal.name}`
                      : item.contact
                        ? `Lead: ${item.contact.first_name} ${item.contact.last_name}`
                        : item.notes || "No related record"}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3">
                <TypeBadge type={item.type} />
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={item.status} />
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-col">
                  <span
                    className={isOverdue(item) ? "font-semibold text-danger" : "text-foreground"}
                  >
                    {item.due_at ? new Date(item.due_at).toLocaleDateString() : "No date"}
                  </span>
                  <span
                    className={`text-sm ${isOverdue(item) ? "text-danger" : "text-text-muted"}`}
                  >
                    {item.due_at ? formatRelative(item.due_at) : "Unscheduled"}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Avatar label={item.owner?.full_name ?? "Unassigned"} />
                  <span>{item.owner?.full_name ?? "Unassigned"}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-text-muted">
                {new Date(item.created_at).toLocaleDateString()}
              </td>
              <td onClick={(e) => e.stopPropagation()} className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button className="rounded p-1 text-text-muted hover:bg-muted hover:text-primary">
                    <span className="material-symbols-outlined">edit_square</span>
                  </button>
                  <button className="rounded p-1 text-text-muted hover:bg-muted hover:text-danger">
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HeaderCell({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-text-secondary ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function TypeBadge({ type }: { type: ActivityType }) {
  const meta = typeMeta(type);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${meta.tone}`}
    >
      <span className="material-symbols-outlined text-[14px]">{meta.icon}</span>
      {meta.label}
    </span>
  );
}

function StatusBadge({ status }: { status: ActivityItem["status"] }) {
  const meta =
    status === "completed"
      ? { label: "Completed", tone: "bg-green-100 text-green-700" }
      : status === "in_progress"
        ? { label: "In Progress", tone: "bg-amber-100 text-amber-700" }
        : { label: "Pending", tone: "bg-primary-light text-primary" };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${meta.tone}`}
    >
      {meta.label}
    </span>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: string;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-xs)]">
      <div className={`flex h-12 w-12 items-center justify-center rounded-full ${tone}`}>
        <span className="material-symbols-outlined text-[28px]">{icon}</span>
      </div>
      <div>
        <p className="text-[11px] font-bold uppercase text-text-muted">{label}</p>
        <p className="text-[20px] font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}

function Pagination() {
  return (
    <div className="flex items-center gap-2">
      <PageButton icon="chevron_left" />
      <button className="flex h-8 w-8 items-center justify-center rounded bg-primary text-xs font-semibold text-white">
        1
      </button>
      <PageButton>2</PageButton>
      <PageButton>3</PageButton>
      <span className="px-1 text-text-muted">...</span>
      <PageButton>25</PageButton>
      <PageButton icon="chevron_right" />
    </div>
  );
}

function PageButton({ children, icon }: { children?: React.ReactNode; icon?: string }) {
  return (
    <button className="flex h-8 w-8 items-center justify-center rounded border border-border text-xs font-semibold text-text-muted transition-colors hover:bg-muted">
      {icon ? <span className="material-symbols-outlined text-[18px]">{icon}</span> : children}
    </button>
  );
}

function Avatar({ label }: { label: string }) {
  const initials = label
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-light text-[10px] font-bold text-primary">
      {initials}
    </span>
  );
}

function typeMeta(type: ActivityType) {
  if (type === "call") return { label: "Calls", icon: "call", tone: "bg-green-100 text-green-700" };
  if (type === "email")
    return { label: "Email", icon: "mail", tone: "bg-amber-100 text-amber-700" };
  if (type === "task")
    return { label: "Task", icon: "assignment", tone: "bg-orange-100 text-orange-700" };
  if (type === "meeting")
    return { label: "Meeting", icon: "groups", tone: "bg-primary-light text-primary" };
  if (type === "demo")
    return { label: "Demo", icon: "present_to_all", tone: "bg-blue-100 text-blue-700" };
  if (type === "proposal")
    return { label: "Proposal", icon: "description", tone: "bg-purple-100 text-purple-700" };
  return { label: "Note", icon: "edit_note", tone: "bg-muted text-text-secondary" };
}

function isOverdue(item: ActivityItem) {
  return item.status !== "completed" && item.due_at && new Date(item.due_at).getTime() < Date.now();
}

function buildStats(items: ActivityItem[]) {
  const incomplete = items
    .filter((item) => item.status !== "completed" && item.due_at)
    .sort((a, b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime());

  return {
    completed: items.filter((item) => item.status === "completed").length,
    overdue: items.filter(isOverdue).length,
    nextPriority: incomplete[0] ?? null,
  };
}

function dateRank(value: string | null | undefined) {
  return value ? new Date(value).getTime() : 0;
}
