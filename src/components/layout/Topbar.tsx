import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";

export function Topbar() {
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-40 ml-[260px] flex h-16 items-center justify-between border-b border-border bg-card px-6 shadow-[var(--shadow-xs)]">
      {/* Search */}
      <div className="flex flex-1 items-center">
        <div className="relative w-full max-w-md">
          <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
            search
          </span>
          <input
            type="search"
            placeholder="Search leads, accounts, or activities..."
            className="h-[38px] w-full rounded-md border border-border bg-muted pl-10 pr-3 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-4">
        <Link
          to="/app/tasks"
          className="hidden items-center gap-1.5 rounded-md bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground transition-all hover:bg-primary-dark md:inline-flex"
        >
          Create Task
        </Link>
        <div className="ml-2 flex items-center gap-2 border-l border-border pl-4 text-text-secondary">
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted hover:text-primary"
            title="Notifications"
          >
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted hover:text-primary"
            title="Messages"
          >
            <span className="material-symbols-outlined">chat_bubble</span>
          </button>
        </div>
        <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-border bg-primary-light text-sm font-bold text-primary">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.fullName} className="h-full w-full object-cover" />
          ) : user ? (
            initials(user.fullName)
          ) : (
            "?"
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
