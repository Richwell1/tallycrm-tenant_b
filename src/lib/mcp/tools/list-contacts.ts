import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_contacts",
  title: "List contacts",
  description: "List CRM contacts visible to the signed-in user.",
  inputSchema: {
    search: z.string().optional().describe("Match name or email."),
    limit: z.number().int().optional().describe("Max rows to return (default 20, max 100)."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };

    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("contacts")
      .select(
        "id, first_name, last_name, email, phone, job_title, source, created_at, companies(name)",
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit ?? 20, 1), 100));

    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(`first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term}`);
    }

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { contacts: data ?? [] },
    };
  },
});
