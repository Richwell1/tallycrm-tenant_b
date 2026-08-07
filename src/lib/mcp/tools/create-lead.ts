import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_lead",
  title: "Create lead",
  description: "Create a new CRM lead owned by the signed-in user.",
  inputSchema: {
    first_name: z.string().trim().describe("Lead first name."),
    last_name: z.string().trim().describe("Lead last name."),
    email: z.string().trim().describe("Lead email address."),
    phone: z.string().trim().optional(),
    company_name: z.string().trim().optional(),
    source: z.string().trim().optional().describe("Lead source, e.g. referral or website."),
    message: z.string().trim().optional().describe("Notes or the lead's enquiry text."),
    value: z.number().optional().describe("Estimated deal value."),
  },
  annotations: { readOnlyHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };

    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("leads")
      .insert({
        first_name: input.first_name,
        last_name: input.last_name,
        email: input.email,
        phone: input.phone ?? null,
        company_name: input.company_name ?? null,
        source: input.source ?? "mcp",
        message: input.message ?? null,
        value: input.value ?? null,
        assigned_to: ctx.getUserId(),
      })
      .select("id, first_name, last_name, email, status, created_at")
      .single();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { lead: data },
    };
  },
});
