import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  Building2,
  CheckSquare,
  FileText,
  Handshake,
  KanbanSquare,
  LayoutDashboard,
  LogOut,
  Search,
  Settings,
  Users,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
  {
    label: "Main Menu",
    items: [{ label: "Dashboard", to: "/app", icon: LayoutDashboard }],
  },
  {
    label: "CRM",
    items: [
      { label: "Contacts", to: "/app/contacts", icon: Users },
      { label: "Companies", to: "/app/companies", icon: Building2 },
      { label: "Deals", to: "/app/deals", icon: Handshake },
      { label: "Quotations", to: "/app/quotes", icon: FileText },
      { label: "Invoices", to: "/app/invoices", icon: ReceiptText },
      { label: "Leads", to: "/app/leads", icon: Search },
      { label: "Pipeline", to: "/app/pipeline", icon: KanbanSquare },
      { label: "Activities", to: "/app/activities", icon: Activity },
      { label: "Tasks", to: "/app/tasks", icon: CheckSquare },
      { label: "Analytics", to: "/app/analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Admin",
    items: [{ label: "Settings", to: "/app/settings", icon: Settings }],
  },
];

export function Sidebar() {
  const { user, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const sections =
    user?.role === "admin" ? SECTIONS : SECTIONS.filter((section) => section.label !== "Admin");

  return (
    <aside className="fixed left-0 top-0 z-50 hidden h-screen w-[260px] flex-col bg-sidebar px-4 py-6 text-sidebar-foreground md:flex print:hidden">
      {/* Logo */}
      <div className="mb-8 px-2">
        <h1 className="text-2xl font-black tracking-tight text-white">
          Tally <span className="text-accent">CRM</span>
        </h1>
        <p className="mt-0.5 text-[11px] font-medium text-sidebar-item/70">Sales Enterprise</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
        {sections.map((section) => (
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
                  <item.icon className="h-5 w-5 shrink-0" />
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
            <LogOut className="h-5 w-5" />
          </button>
        </div>
        <p className="px-2 pt-2 text-center text-[10px] uppercase tracking-widest text-sidebar-item/40">
          Powered by <span className="font-bold text-sidebar-item/70">TallyPrime</span>
        </p>
      </div>
    </aside>
  );
}

export function MobileBottomNav() {
  const { user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = [
    { label: "Home", to: "/app", icon: LayoutDashboard },
    { label: "Leads", to: "/app/leads", icon: Search },
    { label: "Deals", to: "/app/deals", icon: Handshake },
    { label: "Activity", to: "/app/activities", icon: Activity },
    { label: "More", to: user?.role === "admin" ? "/app/settings" : "/app/tasks", icon: Settings },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 shadow-[var(--shadow-lg)] backdrop-blur md:hidden print:hidden">
      <div className="grid grid-cols-5 gap-1">
        {items.map((item) => {
          const active =
            item.to === "/app"
              ? pathname === "/app" || pathname === "/app/"
              : pathname.startsWith(item.to);
          return (
            <Link
              key={item.label}
              to={item.to}
              className={cn(
                "flex min-h-12 flex-col items-center justify-center gap-1 rounded-md text-[10px] font-semibold transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-text-secondary hover:bg-muted hover:text-primary",
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
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
