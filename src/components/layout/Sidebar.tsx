import { Link, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  to: string;
  icon: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
  {
    label: "Main Menu",
    items: [{ label: "Dashboard", to: "/app", icon: "dashboard" }],
  },
  {
    label: "CRM",
    items: [
      { label: "Contacts", to: "/app/contacts", icon: "contacts" },
      { label: "Companies", to: "/app/companies", icon: "corporate_fare" },
      { label: "Deals", to: "/app/deals", icon: "handshake" },
      { label: "Leads", to: "/app/leads", icon: "person_search" },
      { label: "Pipeline", to: "/app/pipeline", icon: "account_tree" },
      { label: "Activities", to: "/app/activities", icon: "history" },
      { label: "Tasks", to: "/app/tasks", icon: "task_alt" },
      { label: "Analytics", to: "/app/analytics", icon: "analytics" },
    ],
  },
  {
    label: "Admin",
    items: [{ label: "Settings", to: "/app/settings", icon: "settings" }],
  },
];

export function Sidebar() {
  const { user, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside className="fixed left-0 top-0 z-50 flex h-screen w-[260px] flex-col bg-sidebar px-4 py-6 text-sidebar-foreground">
      {/* Logo */}
      <div className="mb-8 px-2">
        <h1 className="text-2xl font-black tracking-tight text-white">
          Tally <span className="text-accent">CRM</span>
        </h1>
        <p className="mt-0.5 text-[11px] font-medium text-sidebar-item/70">Sales Enterprise</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
        {SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="mt-4 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-sidebar-section">
              {section.label}
            </p>
            {section.items.map((item) => {
              const active =
                item.to === "/app"
                  ? pathname === "/app" || pathname === "/app/"
                  : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                    active
                      ? "border-l-4 border-accent bg-primary pl-2 text-white shadow-[var(--shadow-sm)]"
                      : "text-sidebar-item hover:bg-white/5 hover:text-white",
                  )}
                >
                  <span className="material-symbols-outlined">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="mt-4 space-y-2 border-t border-sidebar-border pt-4">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
            {user ? initials(user.fullName) : "—"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-white">
              {user?.fullName ?? "Signed out"}
            </p>
            <p className="truncate text-[11px] uppercase tracking-wider text-sidebar-item">
              {user?.role ?? ""}
            </p>
          </div>
          <button
            onClick={() => signOut()}
            title="Sign out"
            className="rounded-md p-1.5 text-sidebar-item hover:bg-white/5 hover:text-white"
          >
            <span className="material-symbols-outlined">logout</span>
          </button>
        </div>
        <p className="px-2 pt-2 text-center text-[10px] uppercase tracking-widest text-sidebar-item/40">
          Powered by <span className="font-bold text-sidebar-item/70">TallyPrime</span>
        </p>
      </div>
    </aside>
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
