import { Navigate, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/leads-capture")({
  component: () => <Navigate to="/" replace />,
});
