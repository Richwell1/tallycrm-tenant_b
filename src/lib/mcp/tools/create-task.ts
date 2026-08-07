import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_task",
  title: "Create task",
  description: "Create a follow-up task assigned to the signed-in user.",
  inputSchema: {
    title: z.string().trim().describe("Task title."),
    due_at: z.string().trim().optional().describe("Due date/time as an ISO 8601 timestamp."),
    priority: z.enum(["low", "medium", "high"]).optional().describe("Task priority."),
    type: z.string().trim().optional().describe("Task type, e.g. call, email, meeting."),
    notes: z.string().trim().optional(),
    deal_id: z.string().trim().optional().describe("Related deal id."),
    contact_id: z.string().trim().optional().describe("Related contact id."),
  },
  annotations: { readOnlyHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };

    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: input.title,
        due_at: input.due_at ?? null,
        priority: input.priority ?? "medium",
        type: input.type ?? null,
        notes: input.notes ?? null,
        deal_id: input.deal_id ?? null,
        contact_id: input.contact_id ?? null,
        assigned_to: ctx.getUserId(),
      })
      .select("id, title, status, priority, due_at, created_at")
      .single();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { task: data },
    };
  },
});
