import { useAuth } from "@/lib/auth-context";

export function Topbar() {
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-40 ml-[260px] flex h-16 items-center justify-between border-b border-border bg-surface px-6 shadow-[var(--shadow-xs)]">
      {/* Search */}
      <div className="flex flex-1 items-center">
        <div className="relative w-full max-w-md">
          <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
            search
          </span>
          <input
            type="search"
            placeholder="Search across Tally CRM..."
            className="h-9 w-full rounded-lg border border-border bg-background pl-10 pr-3 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-3 text-text-secondary">
          <button className="rounded-md p-1 hover:text-primary" title="Notifications">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <button className="rounded-md p-1 hover:text-primary" title="Messages">
            <span className="material-symbols-outlined">chat_bubble</span>
          </button>
        </div>
        <button className="hidden items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground transition-all hover:bg-primary-dark md:inline-flex">
          <span className="material-symbols-outlined text-[18px]">add_task</span>
          Create Task
        </button>
        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border bg-primary-light text-sm font-bold text-primary">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.fullName} className="h-full w-full object-cover" />
          ) : (
            user ? initials(user.fullName) : "?"
          )}
        </div>
      </div>
    </header>
  );
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
