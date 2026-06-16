import { Navigate, createFileRoute } from "@tanstack/react-router";
import { corsHeaders, handleLeadCapturePost, redirectHome } from "@/lib/lead-capture.server";

export const Route = createFileRoute("/api/public/leads-capture")({
  server: {
    handlers: {
      GET: async ({ request }) => redirectHome(request),
      OPTIONS: async ({ request }) =>
        new Response(null, { status: 204, headers: corsHeaders(request) }),
      POST: async ({ request }) => handleLeadCapturePost(request),
    },
  },
  component: () => <Navigate to="/" replace />,
});
