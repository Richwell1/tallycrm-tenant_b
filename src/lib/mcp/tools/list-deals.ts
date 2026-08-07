import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_deals",
  title: "List deals",
  description: "List CRM deals visible to the signed-in user with their pipeline stage.",
  inputSchema: {
    search: z.string().optional().describe("Match the deal name."),
    limit: z.number().int().optional().describe("Max rows to return (default 20, max 100)."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };

    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("deals")
      .select(
        "id, name, value, currency, probability, expected_close_date, created_at, pipeline_stages(name)",
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit ?? 20, 1), 100));

    if (search?.trim()) query = query.ilike("name", `%${search.trim()}%`);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { deals: data ?? [] },
    };
  },
});
