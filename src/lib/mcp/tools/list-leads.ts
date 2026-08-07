import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

const LEAD_STATUS = ["new", "contacted", "qualified", "converted", "disqualified"] as const;

export default defineTool({
  name: "list_leads",
  title: "List leads",
  description: "List CRM leads visible to the signed-in user, newest first.",
  inputSchema: {
    status: z.enum(LEAD_STATUS).optional().describe("Filter by lead status."),
    search: z.string().optional().describe("Match name, email or company."),
    limit: z.number().int().optional().describe("Max rows to return (default 20, max 100)."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ status, search, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };

    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("leads")
      .select(
        "id, first_name, last_name, email, phone, company_name, status, source, value, currency, created_at",
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit ?? 20, 1), 100));

    if (status) query = query.eq("status", status);
    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(
        `first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term},company_name.ilike.${term}`,
      );
    }

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { leads: data ?? [] },
    };
  },
});
