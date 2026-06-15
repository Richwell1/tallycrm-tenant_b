import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/layout";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  // Feature 9 (Auth + 2FA) will wrap this in an MFA-verified guard; the
  // shell stays identical.
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
