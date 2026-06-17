import { Link } from "@tanstack/react-router";
import { MessageCircle, Moon, Plus, Search, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { NotificationCenter } from "./NotificationCenter";

export function Topbar() {
  const { user } = useAuth();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("tally-crm-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const nextDark = saved ? saved === "dark" : prefersDark;
    setDark(nextDark);
    document.documentElement.classList.toggle("dark", nextDark);
    document.documentElement.style.colorScheme = nextDark ? "dark" : "light";
  }, []);

  function toggleTheme() {
    const nextDark = !dark;
    setDark(nextDark);
    document.documentElement.classList.toggle("dark", nextDark);
    document.documentElement.style.colorScheme = nextDark ? "dark" : "light";
    localStorage.setItem("tally-crm-theme", nextDark ? "dark" : "light");
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-card px-4 shadow-[var(--shadow-xs)] md:ml-[260px] md:px-6">
      {/* Search */}
      <div className="hidden flex-1 items-center sm:flex">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="search"
            placeholder="Search leads, accounts, or activities..."
            className="h-[38px] w-full rounded-md border border-border bg-muted pl-10 pr-3 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Right cluster */}
      <div className="flex flex-1 items-center justify-end gap-2 sm:flex-none md:gap-4">
        <Link
          to="/app/tasks"
          className="hidden items-center gap-1.5 rounded-md bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground transition-all hover:bg-primary-dark md:inline-flex"
        >
          <Plus className="h-4 w-4" />
          Create Task
        </Link>
        <div className="ml-0 flex items-center gap-1 text-text-secondary sm:gap-2 md:border-l md:border-border md:pl-4">
          <button
            onClick={toggleTheme}
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            title={dark ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <NotificationCenter />
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted hover:text-primary"
            title="Messages"
          >
            <MessageCircle className="h-5 w-5" />
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
