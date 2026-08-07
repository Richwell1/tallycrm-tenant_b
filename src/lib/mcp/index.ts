import { auth, defineMcp } from "@lovable.dev/mcp-js";
import createLeadTool from "./tools/create-lead";
import createTaskTool from "./tools/create-task";
import listContactsTool from "./tools/list-contacts";
import listDealsTool from "./tools/list-deals";
import listLeadsTool from "./tools/list-leads";
import listTasksTool from "./tools/list-tasks";

// The OAuth issuer must be the direct Supabase host; the project ref is the only
// Supabase value that survives publish unchanged and Vite inlines it at build time.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "crm-core-components",
  title: "CRM Core Components",
  version: "0.1.0",
  instructions:
    "Tools for the Tally CRM workspace. Read and create leads, deals, contacts and tasks as the signed-in CRM user. All access is scoped to what that user is allowed to see in the CRM.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listLeadsTool,
    createLeadTool,
    listDealsTool,
    listContactsTool,
    listTasksTool,
    createTaskTool,
  ],
});
