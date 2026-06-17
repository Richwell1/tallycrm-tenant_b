import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";

export type AutomationStatus = "active" | "inactive" | "draft";
export type AutomationTriggerType =
  | "new_lead"
  | "lead_status"
  | "lead_score"
  | "conversion"
  | "deal_stage"
  | "deal_status"
  | "time_elapsed"
  | "sla_monitor"
  | "digest";
export type AutomationActionType = "task" | "notification" | "email" | "field_update" | "digest";
export type AutomationRunResult = "success" | "failed" | "skipped";

export interface AutomationStep {
  type: AutomationActionType;
  label: string;
  detail: string;
  dueOffset?: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  triggerType: AutomationTriggerType;
  triggerLabel: string;
  triggerIcon: string;
  object: "Lead" | "Deal" | "Contact" | "Task" | "Digest";
  condition: string;
  actions: AutomationStep[];
  status: AutomationStatus;
  isDefault: boolean;
  owner: string;
  runs: number;
  successRate: number;
  lastRunAt: string | null;
  lastEditedAt: string;
  auditLogged: boolean;
}

export interface AutomationRun {
  id: string;
  ruleId: string;
  timestamp: string;
  recordName: string;
  recordType: "Lead" | "Deal" | "Contact" | "System";
  actionTaken: string;
  result: AutomationRunResult;
  durationMs: number;
  auditActor: "System/Automation";
  message?: string;
}

export interface AutomationStats {
  active: number;
  total: number;
  monthlyRuns: number;
  weeklyHoursSaved: number;
  successRate: number;
}

export interface AutomationTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  rule: Omit<AutomationRule, "id" | "runs" | "lastRunAt" | "lastEditedAt">;
}

export const automationsKey = ["automations"] as const;
type AutomationRuleRow = Database["public"]["Tables"]["automation_rules"]["Row"];
type AutomationRunRow = Database["public"]["Tables"]["automation_runs"]["Row"];

const RULES: AutomationRule[] = [
  {
    id: "new-lead-auto-assign",
    name: "New Lead Manual Intake",
    description:
      "When a new lead is captured, keep it in the manager queue until a specific rep is assigned.",
    triggerType: "new_lead",
    triggerLabel: "New Lead",
    triggerIcon: "person_add",
    object: "Lead",
    condition: "Lead is created from landing page or manual entry",
    actions: [
      {
        type: "notification",
        label: "Notify managers",
        detail: "New landing-page lead is awaiting assignment",
      },
      {
        type: "task",
        label: "Create task: Make first contact",
        detail: "Create when the lead is assigned to a rep",
        dueOffset: "+4h",
      },
      {
        type: "notification",
        label: "Notify assigned representative",
        detail: "In-app alert after manual assignment",
      },
    ],
    status: "active",
    isDefault: true,
    owner: "Admin",
    runs: 1245,
    successRate: 99.8,
    lastRunAt: minutesAgo(2),
    lastEditedAt: daysAgo(4),
    auditLogged: true,
  },
  {
    id: "lead-contacted-bant",
    name: "Lead Contacted Qualification",
    description:
      "When a lead moves to Contacted, create the BANT qualification task due in two days.",
    triggerType: "lead_status",
    triggerLabel: "Lead Status",
    triggerIcon: "assignment_turned_in",
    object: "Lead",
    condition: "Lead status changes to Contacted",
    actions: [
      {
        type: "task",
        label: "Create task: Qualify (BANT)",
        detail: "Assign to lead owner",
        dueOffset: "+2d",
      },
    ],
    status: "active",
    isDefault: true,
    owner: "Admin",
    runs: 716,
    successRate: 99.4,
    lastRunAt: hoursAgo(3),
    lastEditedAt: daysAgo(7),
    auditLogged: true,
  },
  {
    id: "lead-qualified-demo",
    name: "Qualified Lead Demo Prep",
    description:
      "When a lead becomes Qualified, create demo preparation and conversion work for the owner.",
    triggerType: "lead_status",
    triggerLabel: "Lead Status",
    triggerIcon: "workspace_premium",
    object: "Lead",
    condition: "Lead status changes to Qualified",
    actions: [
      {
        type: "task",
        label: "Create task: Prepare demo / convert",
        detail: "Assign to lead owner",
        dueOffset: "+1d",
      },
    ],
    status: "active",
    isDefault: true,
    owner: "Admin",
    runs: 438,
    successRate: 98.9,
    lastRunAt: hoursAgo(5),
    lastEditedAt: daysAgo(9),
    auditLogged: true,
  },
  {
    id: "convert-to-demo",
    name: "Converted Lead Demo Scheduler",
    description: "When a qualified lead converts into a deal, create a Tally demo scheduling task.",
    triggerType: "conversion",
    triggerLabel: "Convert",
    triggerIcon: "sync_alt",
    object: "Deal",
    condition: "Lead conversion creates a Deal",
    actions: [
      {
        type: "task",
        label: "Create task: Schedule Tally demo",
        detail: "Link to converted deal",
        dueOffset: "+2d",
      },
    ],
    status: "active",
    isDefault: true,
    owner: "Admin",
    runs: 281,
    successRate: 99.1,
    lastRunAt: hoursAgo(8),
    lastEditedAt: daysAgo(5),
    auditLogged: true,
  },
  {
    id: "deal-proposal-follow-up",
    name: "Demo / Proposal Follow-up",
    description:
      "When a deal reaches Demo/Proposal, create proposal work and a follow-up reminder.",
    triggerType: "deal_stage",
    triggerLabel: "Deal Stage",
    triggerIcon: "handshake",
    object: "Deal",
    condition: "Deal stage changes to Demo/Proposal",
    actions: [
      {
        type: "task",
        label: "Create task: Send proposal",
        detail: "Assign to deal owner",
        dueOffset: "+1d",
      },
      {
        type: "notification",
        label: "Create follow-up reminder",
        detail: "Reminder to confirm proposal receipt",
        dueOffset: "+3d",
      },
    ],
    status: "active",
    isDefault: true,
    owner: "Admin",
    runs: 528,
    successRate: 99.8,
    lastRunAt: hoursAgo(21),
    lastEditedAt: daysAgo(2),
    auditLogged: true,
  },
  {
    id: "deal-negotiation-terms",
    name: "Negotiation Terms Follow-up",
    description: "When a deal enters Negotiation, create a terms follow-up task due in two days.",
    triggerType: "deal_stage",
    triggerLabel: "Deal Stage",
    triggerIcon: "contract",
    object: "Deal",
    condition: "Deal stage changes to Negotiation",
    actions: [
      {
        type: "task",
        label: "Create task: Follow up on terms",
        detail: "Assign to deal owner",
        dueOffset: "+2d",
      },
    ],
    status: "active",
    isDefault: false,
    owner: "Admin",
    runs: 89,
    successRate: 100,
    lastRunAt: daysAgo(1),
    lastEditedAt: daysAgo(3),
    auditLogged: true,
  },
  {
    id: "closed-won-welcome",
    name: "Closed-Won Welcome Sequence",
    description: "When a deal closes won, create welcome and renewal tasks and notify management.",
    triggerType: "deal_status",
    triggerLabel: "Closed Won",
    triggerIcon: "sell",
    object: "Deal",
    condition: "Deal stage changes to Closed-Won",
    actions: [
      {
        type: "task",
        label: "Create task: Welcome customer",
        detail: "Assign to account owner",
        dueOffset: "+1d",
      },
      {
        type: "task",
        label: "Create task: Renewal check-in",
        detail: "Assign to account owner",
        dueOffset: "+11mo",
      },
      {
        type: "notification",
        label: "Notify Manager/Admin",
        detail: "Include actual value and close date",
      },
    ],
    status: "active",
    isDefault: true,
    owner: "Admin",
    runs: 196,
    successRate: 99.5,
    lastRunAt: daysAgo(2),
    lastEditedAt: daysAgo(6),
    auditLogged: true,
  },
  {
    id: "closed-lost-reengage",
    name: "Closed-Lost Re-engagement",
    description:
      "When a deal closes lost with a reason, create a re-engagement task due in ninety days.",
    triggerType: "deal_status",
    triggerLabel: "Closed Lost",
    triggerIcon: "event_repeat",
    object: "Deal",
    condition: "Deal stage changes to Closed-Lost and lost reason exists",
    actions: [
      {
        type: "task",
        label: "Create task: Re-engage lost deal",
        detail: "Assign to deal owner",
        dueOffset: "+90d",
      },
    ],
    status: "active",
    isDefault: true,
    owner: "Admin",
    runs: 74,
    successRate: 98.6,
    lastRunAt: daysAgo(4),
    lastEditedAt: daysAgo(8),
    auditLogged: true,
  },
  {
    id: "sla-stale-escalation",
    name: "SLA Stale Deal Escalation",
    description: "Monitor overdue or stale leads and deals, then escalate them to Managers.",
    triggerType: "sla_monitor",
    triggerLabel: "SLA Monitor",
    triggerIcon: "timer",
    object: "Task",
    condition: "Lead or deal has no activity past stage SLA",
    actions: [
      {
        type: "notification",
        label: "Flag stale record",
        detail: "Mark record as requiring attention",
      },
      {
        type: "notification",
        label: "Escalate to Manager",
        detail: "Send in-app escalation with record owner",
      },
    ],
    status: "active",
    isDefault: true,
    owner: "Admin",
    runs: 412,
    successRate: 97.8,
    lastRunAt: hoursAgo(6),
    lastEditedAt: daysAgo(1),
    auditLogged: true,
  },
  {
    id: "daily-digest",
    name: "Daily Sales Digest",
    description:
      "Deliver each user a daily digest of new leads, overdue tasks, reminders, and stage changes.",
    triggerType: "digest",
    triggerLabel: "Daily Digest",
    triggerIcon: "summarize",
    object: "Digest",
    condition: "Every weekday at 8:00 AM",
    actions: [
      { type: "digest", label: "Send digest", detail: "In-app summary with optional email mirror" },
    ],
    status: "draft",
    isDefault: false,
    owner: "Admin",
    runs: 0,
    successRate: 0,
    lastRunAt: null,
    lastEditedAt: hoursAgo(2),
    auditLogged: true,
  },
  {
    id: "cold-lead-sweep",
    name: "Cold Lead Re-engagement Sweep",
    description: "Surface cold leads and lost deals for re-engagement review before archiving.",
    triggerType: "lead_score",
    triggerLabel: "Lead Score",
    triggerIcon: "filter_alt",
    object: "Lead",
    condition: "Lead score below 20 for 30 days or lost deal older than 90 days",
    actions: [
      {
        type: "task",
        label: "Create task: Review cold record",
        detail: "Assign to record owner",
        dueOffset: "+1d",
      },
      {
        type: "notification",
        label: "Notify manager",
        detail: "Include re-engagement queue count",
      },
    ],
    status: "inactive",
    isDefault: false,
    owner: "Admin",
    runs: 0,
    successRate: 0,
    lastRunAt: null,
    lastEditedAt: daysAgo(10),
    auditLogged: true,
  },
];

const RUNS: AutomationRun[] = [
  {
    id: "run-1",
    ruleId: "new-lead-auto-assign",
    timestamp: minutesAgo(2),
    recordName: "Ama Mensah - Accra Foods",
    recordType: "Lead",
    actionTaken: "Assigned rep, created first-contact task, notified owner",
    result: "success",
    durationMs: 820,
    auditActor: "System/Automation",
  },
  {
    id: "run-2",
    ruleId: "deal-proposal-follow-up",
    timestamp: hoursAgo(21),
    recordName: "Stellar Dynamics Deal",
    recordType: "Deal",
    actionTaken: "Created proposal task and follow-up reminder",
    result: "success",
    durationMs: 1100,
    auditActor: "System/Automation",
  },
  {
    id: "run-3",
    ruleId: "sla-stale-escalation",
    timestamp: hoursAgo(6),
    recordName: "Nebula Corp Expansion",
    recordType: "Deal",
    actionTaken: "Escalated stale deal to Manager",
    result: "failed",
    durationMs: 2400,
    auditActor: "System/Automation",
    message: "Manager notification target missing",
  },
  {
    id: "run-4",
    ruleId: "closed-won-welcome",
    timestamp: daysAgo(2),
    recordName: "Apex Solutions Q4",
    recordType: "Deal",
    actionTaken: "Created welcome and renewal tasks, notified Admin",
    result: "success",
    durationMs: 940,
    auditActor: "System/Automation",
  },
  {
    id: "run-5",
    ruleId: "lead-contacted-bant",
    timestamp: hoursAgo(3),
    recordName: "Kojo Asante - Ridge Clinic",
    recordType: "Lead",
    actionTaken: "Created Qualify (BANT) task",
    result: "success",
    durationMs: 510,
    auditActor: "System/Automation",
  },
  {
    id: "run-6",
    ruleId: "closed-lost-reengage",
    timestamp: daysAgo(4),
    recordName: "Titanium Logistics",
    recordType: "Deal",
    actionTaken: "Skipped re-engagement task",
    result: "skipped",
    durationMs: 320,
    auditActor: "System/Automation",
    message: "Lost reason was not provided",
  },
];

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    id: "new-lead-email",
    name: "New Lead Email",
    description: "Send a welcome email and notify managers that a lead is awaiting assignment.",
    icon: "mail",
    rule: {
      name: "New Lead Welcome Email",
      description:
        "When a new lead is created, send a welcome message and notify the assignment queue.",
      triggerType: "new_lead",
      triggerLabel: "New Lead",
      triggerIcon: "person_add",
      object: "Lead",
      condition: "Lead is created",
      actions: [
        { type: "email", label: "Send welcome email", detail: "Template: New lead welcome" },
        { type: "notification", label: "Notify managers", detail: "In-app alert" },
      ],
      status: "draft",
      isDefault: false,
      owner: "Admin",
      successRate: 0,
      auditLogged: true,
    },
  },
  {
    id: "deal-auto-task",
    name: "Deal Auto-task",
    description: "Create tasks when deals advance to proposal or close.",
    icon: "assignment_turned_in",
    rule: {
      name: "Deal Auto-task",
      description: "Create follow-up work when a deal stage changes.",
      triggerType: "deal_stage",
      triggerLabel: "Deal Stage",
      triggerIcon: "handshake",
      object: "Deal",
      condition: "Deal stage changes",
      actions: [
        {
          type: "task",
          label: "Create owner task",
          detail: "Due next business day",
          dueOffset: "+1d",
        },
      ],
      status: "draft",
      isDefault: false,
      owner: "Admin",
      successRate: 0,
      auditLogged: true,
    },
  },
  {
    id: "stale-lead-alert",
    name: "Stale Lead Alert",
    description: "Notify a manager when a lead has no activity for three days.",
    icon: "notifications_active",
    rule: {
      name: "Stale Lead Alert",
      description: "Escalate leads with no activity after three days.",
      triggerType: "sla_monitor",
      triggerLabel: "SLA Monitor",
      triggerIcon: "timer",
      object: "Lead",
      condition: "No lead activity for 3 days",
      actions: [
        { type: "notification", label: "Notify manager", detail: "Include lead owner and source" },
      ],
      status: "draft",
      isDefault: false,
      owner: "Admin",
      successRate: 0,
      auditLogged: true,
    },
  },
];

export function useAutomations() {
  return useQuery({
    queryKey: automationsKey,
    queryFn: async () => {
      await ensureDefaultRules();

      const rulesRes = await supabase
        .from("automation_rules")
        .select("*")
        .order("updated_at", { ascending: false });

      if (rulesRes.error) {
        const rules = [...RULES].sort(byLastEditedDesc);
        return {
          rules,
          runs: RUNS,
          stats: buildAutomationStats(rules),
        };
      }

      const runsRes = await supabase
        .from("automation_runs")
        .select("*")
        .order("created_at", { ascending: false });

      const runs = runsRes.error ? RUNS : (runsRes.data ?? []).map(runFromRow);
      const databaseRules = (rulesRes.data ?? []).map((row) => ruleFromRow(row, runs));
      const rules = mergeSystemAndDatabaseRules(databaseRules).sort(byLastEditedDesc);

      return {
        rules,
        runs,
        stats: buildAutomationStats(rules),
      };
    },
  });
}

export function useToggleAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ rule, checked }: { rule: AutomationRule; checked: boolean }) => {
      const saved = { ...rule, status: checked ? "active" : "inactive" } satisfies AutomationRule;
      const { error } = await supabase
        .from("automation_rules")
        .update(ruleToRow(saved))
        .eq("id", rule.id);
      if (error) throw error;
      return saved;
    },
    onMutate: async ({ rule, checked }) => {
      await qc.cancelQueries({ queryKey: automationsKey });
      const previous = qc.getQueryData<AutomationPayload>(automationsKey);
      if (previous) {
        qc.setQueryData<AutomationPayload>(automationsKey, {
          ...previous,
          rules: previous.rules.map((item) =>
            item.id === rule.id ? { ...item, status: checked ? "active" : "inactive" } : item,
          ),
          stats: buildAutomationStats(
            previous.rules.map((item) =>
              item.id === rule.id ? { ...item, status: checked ? "active" : "inactive" } : item,
            ),
          ),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(automationsKey, context.previous);
    },
  });
}

export function useSaveAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rule: AutomationRule) => {
      const saved = { ...rule, lastEditedAt: new Date().toISOString() };
      const { error } = await supabase
        .from("automation_rules")
        .upsert(ruleToRow(saved), { onConflict: "id" });
      if (error) throw error;
      return saved;
    },
    onSuccess: (saved) => {
      qc.setQueryData<AutomationPayload>(automationsKey, (current) => {
        if (!current) return current;
        const exists = current.rules.some((rule) => rule.id === saved.id);
        const rules = exists
          ? current.rules.map((rule) => (rule.id === saved.id ? saved : rule))
          : [saved, ...current.rules];
        return { ...current, rules, stats: buildAutomationStats(rules) };
      });
    },
  });
}

export function useDeleteAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ruleId: string) => {
      const { error } = await supabase.from("automation_rules").delete().eq("id", ruleId);
      if (error) throw error;
      return ruleId;
    },
    onMutate: async (ruleId) => {
      await qc.cancelQueries({ queryKey: automationsKey });
      const previous = qc.getQueryData<AutomationPayload>(automationsKey);
      if (previous) {
        const rules = previous.rules.filter((rule) => rule.id !== ruleId);
        qc.setQueryData<AutomationPayload>(automationsKey, {
          ...previous,
          rules,
          runs: previous.runs.filter((run) => run.ruleId !== ruleId),
          stats: buildAutomationStats(rules),
        });
      }
      return { previous };
    },
    onError: (_err, _ruleId, context) => {
      if (context?.previous) qc.setQueryData(automationsKey, context.previous);
    },
  });
}

export function buildAutomationStats(rules: AutomationRule[]): AutomationStats {
  const totalRuns = rules.reduce((sum, rule) => sum + rule.runs, 0);
  const weightedSuccess = rules.reduce((sum, rule) => sum + rule.runs * rule.successRate, 0);
  return {
    active: rules.filter((rule) => rule.status === "active").length,
    total: rules.length,
    monthlyRuns: totalRuns,
    weeklyHoursSaved: Math.round(totalRuns * 0.21),
    successRate: totalRuns ? weightedSuccess / totalRuns : 0,
  };
}

export function createRuleFromTemplate(template: AutomationTemplate): AutomationRule {
  return {
    id: `custom-${template.id}-${Date.now()}`,
    ...template.rule,
    runs: 0,
    lastRunAt: null,
    lastEditedAt: new Date().toISOString(),
  };
}

interface AutomationPayload {
  rules: AutomationRule[];
  runs: AutomationRun[];
  stats: AutomationStats;
}

async function ensureDefaultRules() {
  const { count, error } = await supabase
    .from("automation_rules")
    .select("id", { count: "exact", head: true });
  if (error) return;
  if ((count ?? 0) > 0) return;

  const { error: insertError } = await supabase.from("automation_rules").upsert(
    RULES.map((rule) => ruleToRow(rule)),
    { onConflict: "id" },
  );
  if (insertError) return;
}

function mergeSystemAndDatabaseRules(databaseRules: AutomationRule[]) {
  const byId = new Map<string, AutomationRule>();
  for (const rule of RULES) byId.set(rule.id, rule);
  for (const rule of databaseRules) byId.set(rule.id, rule);
  return Array.from(byId.values());
}

function byLastEditedDesc(a: AutomationRule, b: AutomationRule) {
  return new Date(b.lastEditedAt).getTime() - new Date(a.lastEditedAt).getTime();
}

function ruleFromRow(row: AutomationRuleRow, runs: AutomationRun[]): AutomationRule {
  const actions = Array.isArray(row.actions) ? row.actions : [];
  const ruleRuns = runs.filter((run) => run.ruleId === row.id);
  const successfulRuns = ruleRuns.filter((run) => run.result === "success").length;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    triggerType: row.trigger_type as AutomationTriggerType,
    triggerLabel: row.trigger_label,
    triggerIcon: row.trigger_icon,
    object: row.object as AutomationRule["object"],
    condition: row.condition,
    actions: actions as unknown as AutomationStep[],
    status: row.status as AutomationStatus,
    isDefault: row.is_default,
    owner: row.owner,
    runs: ruleRuns.length,
    successRate: ruleRuns.length
      ? (successfulRuns / ruleRuns.length) * 100
      : Number(row.success_rate),
    lastRunAt: row.last_run_at ?? ruleRuns[0]?.timestamp ?? null,
    lastEditedAt: row.updated_at,
    auditLogged: row.audit_logged,
  };
}

function ruleToRow(
  rule: AutomationRule,
): Database["public"]["Tables"]["automation_rules"]["Insert"] {
  return {
    id: rule.id,
    name: rule.name,
    description: rule.description,
    trigger_type: rule.triggerType,
    trigger_label: rule.triggerLabel,
    trigger_icon: rule.triggerIcon,
    object: rule.object,
    condition: rule.condition,
    actions: rule.actions as unknown as Json,
    status: rule.status,
    is_default: rule.isDefault,
    owner: rule.owner,
    success_rate: rule.successRate,
    audit_logged: rule.auditLogged,
    last_run_at: rule.lastRunAt,
  };
}

function runFromRow(row: AutomationRunRow): AutomationRun {
  return {
    id: row.id,
    ruleId: row.rule_id ?? "",
    timestamp: row.created_at,
    recordName: row.record_name,
    recordType: row.record_type as AutomationRun["recordType"],
    actionTaken: row.action_taken,
    result: row.result as AutomationRunResult,
    durationMs: row.duration_ms,
    auditActor: "System/Automation",
    message: row.message ?? undefined,
  };
}

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}
