import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
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
      <main className="ml-[260px] min-h-[calc(100vh-64px)] p-6">{children}</main>
    </div>
  );
}
