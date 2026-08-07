import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

const TASK_STATUS = ["pending", "in_progress", "done", "cancelled"] as const;

export default defineTool({
  name: "list_tasks",
  title: "List tasks",
  description: "List CRM tasks visible to the signed-in user, soonest due first.",
  inputSchema: {
    status: z.enum(TASK_STATUS).optional().describe("Filter by task status."),
    limit: z.number().int().optional().describe("Max rows to return (default 20, max 100)."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };

    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("tasks")
      .select("id, title, status, priority, type, due_at, notes, deal_id, contact_id, created_at")
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(Math.min(Math.max(limit ?? 20, 1), 100));

    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { tasks: data ?? [] },
    };
  },
});
