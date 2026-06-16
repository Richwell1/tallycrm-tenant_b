import type { ReactNode } from "react";
import { MobileBottomNav, Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

interface AppShellProps {
  children: ReactNode;
}

/**
 * Global CRM shell. Fixed 260px sidebar + 64px topbar, main scroll area at
 * 24px padding. Every protected /app/* route renders inside this shell.
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar />
      <Topbar />
      <main className="min-h-[calc(100vh-64px)] px-4 pb-24 pt-5 sm:px-6 md:ml-[260px] md:pb-6">
        {children}
      </main>
      <MobileBottomNav />
    </div>
  );
}
