import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common";
import { PageHeader, SectionCard, ToolbarButton } from "@/components/layout";
import {
  AUTOMATION_TEMPLATES,
  type AutomationRule,
  type AutomationRun,
  type AutomationStatus,
  type AutomationTriggerType,
  createRuleFromTemplate,
  useAutomations,
  useDeleteAutomation,
  useSaveAutomation,
  useToggleAutomation,
} from "@/lib/automations-data";
import { useCurrentRole } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/settings/")({
  component: SettingsPage,
});

type SettingsTab =
  | "general"
  | "pipeline"
  | "users"
  | "leadAssignment"
  | "automations"
  | "email"
  | "lossReasons"
  | "auditLog"
  | "landingIntegration";
type ViewMode = "list" | "builder" | "detail" | "empty" | "error";
type SortKey = "recent" | "runs" | "success";

const EMPTY_RULES: AutomationRule[] = [];
const EMPTY_RUNS: AutomationRun[] = [];

const TRIGGER_OPTIONS: Array<{
  label: string;
  type: AutomationTriggerType;
  icon: string;
  object: AutomationRule["object"];
}> = [
  { label: "New Lead", type: "new_lead", icon: "person_add", object: "Lead" },
  { label: "Lead Status", type: "lead_status", icon: "assignment_turned_in", object: "Lead" },
  { label: "Lead Score", type: "lead_score", icon: "filter_alt", object: "Lead" },
  { label: "Convert", type: "conversion", icon: "sync_alt", object: "Deal" },
  { label: "Deal Stage", type: "deal_stage", icon: "handshake", object: "Deal" },
  { label: "Closed Won", type: "deal_status", icon: "sell", object: "Deal" },
  { label: "Closed Lost", type: "deal_status", icon: "event_repeat", object: "Deal" },
  { label: "SLA Monitor", type: "sla_monitor", icon: "timer", object: "Task" },
  { label: "Daily Digest", type: "digest", icon: "summarize", object: "Digest" },
];

const TRIGGER_FILTERS: Array<{ label: string; value: "all" | AutomationTriggerType }> = [
  { label: "All Triggers", value: "all" },
  { label: "New Lead", value: "new_lead" },
  { label: "Lead Status", value: "lead_status" },
  { label: "Deal Stage", value: "deal_stage" },
  { label: "SLA Monitor", value: "sla_monitor" },
];

const STATUS_FILTERS: Array<{ label: string; value: "all" | AutomationStatus }> = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
  { label: "Draft", value: "draft" },
];

const SETTINGS_TABS: Array<{ id: SettingsTab; label: string; icon: string }> = [
  { id: "general", label: "General", icon: "settings" },
  { id: "pipeline", label: "Pipeline Config", icon: "view_kanban" },
  { id: "users", label: "Users & Roles", icon: "group" },
  { id: "leadAssignment", label: "Lead Assignment", icon: "assignment_ind" },
  { id: "automations", label: "Automations", icon: "auto_mode" },
  { id: "email", label: "Email & Notifications", icon: "mail" },
  { id: "lossReasons", label: "Loss Reasons", icon: "report_off" },
  { id: "auditLog", label: "Audit Log", icon: "history_edu" },
  { id: "landingIntegration", label: "Landing Page Integration", icon: "extension" },
];

const PIPELINE_STAGES = [
  { name: "New Lead", color: "bg-primary", sla: 2, closed: false, locked: false },
  { name: "Contacted", color: "bg-info", sla: 3, closed: false, locked: false },
  { name: "Qualified", color: "bg-primary-mid", sla: 5, closed: false, locked: false },
  { name: "Demo / Proposal", color: "bg-accent", sla: 10, closed: false, locked: false },
  { name: "Negotiation", color: "bg-warning", sla: 7, closed: false, locked: false },
  { name: "Closed-Won", color: "bg-success", sla: 0, closed: true, locked: true },
  { name: "Closed-Lost", color: "bg-danger", sla: 0, closed: true, locked: true },
];

const SETTINGS_USERS = [
  {
    name: "Alexander Pierce",
    initials: "AP",
    email: "a.pierce@tallycrm.com",
    role: "Admin",
    status: "Active",
    mfa: "Enrolled",
    lastLogin: "2 mins ago",
  },
  {
    name: "Sarah Jenkins",
    initials: "SJ",
    email: "s.jenkins@tallycrm.com",
    role: "Sales Manager",
    status: "Active",
    mfa: "Enrolled",
    lastLogin: "45 mins ago",
  },
  {
    name: "Michael Ross",
    initials: "MR",
    email: "m.ross@tallycrm.com",
    role: "Sales Rep",
    status: "Pending",
    mfa: "Pending",
    lastLogin: "Never",
  },
];

const ASSIGNMENT_REPS = [
  { name: "David Chen", title: "Senior Account Executive", initials: "DC", load: 12, active: true },
  { name: "Sarah Jenkins", title: "Sales Specialist", initials: "SJ", load: 8, active: true },
  { name: "Marcus Rivera", title: "Regional Lead", initials: "MR", load: 15, active: false },
  { name: "Elena Kostas", title: "Junior Rep", initials: "EK", load: 5, active: true },
];

const LOSS_REASONS = [
  "Price too high",
  "Chose competitor",
  "No budget",
  "Timing",
  "Unresponsive",
  "Poor product fit",
];

const AUDIT_LOG_ROWS = [
  {
    actor: "Sarah Jenkins",
    email: "sarah.j@tallycrm.com",
    initials: "SJ",
    action: "Closed Won",
    entity: "Deal",
    entityName: "Acme Corp Expansion",
    timestamp: "Oct 24, 2024, 14:22:10",
    ip: "192.168.1.45",
    tone: "success" as const,
  },
  {
    actor: "Michael Chen",
    email: "m.chen@tallycrm.com",
    initials: "MC",
    action: "Update",
    entity: "Lead",
    entityName: "Globex Retail Solutions",
    timestamp: "Oct 24, 2024, 13:58:04",
    ip: "10.0.4.122",
    tone: "primary" as const,
  },
  {
    actor: "System / Automation",
    email: "Automated Task",
    initials: "SYS",
    action: "Task Created",
    entity: "Task",
    entityName: "Make first contact",
    timestamp: "Oct 24, 2024, 12:00:00",
    ip: "172.16.254.1",
    tone: "warning" as const,
  },
  {
    actor: "Jane Doe",
    email: "admin@tallycrm.com",
    initials: "JD",
    action: "Delete",
    entity: "API Key",
    entityName: "Inactive Landing Page Token",
    timestamp: "Oct 24, 2024, 09:15:22",
    ip: "82.112.4.9",
    tone: "danger" as const,
  },
];

const NOTIFICATION_ROWS = [
  {
    label: "New Lead Assigned",
    detail: "When a lead is manually or auto-assigned.",
    email: true,
    app: true,
  },
  {
    label: "Deal Stage Change",
    detail: "When a deal progresses or stalls.",
    email: true,
    app: true,
  },
  {
    label: "SLA Breach Escalation",
    detail: "When a lead or deal breaches its stage SLA.",
    email: true,
    app: true,
  },
  {
    label: "Daily Digest",
    detail: "Morning task, overdue, and new-lead summary.",
    email: true,
    app: false,
  },
];

function SettingsPage() {
  const role = useCurrentRole();
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");

  if (role !== "admin") {
    return (
      <ErrorState
        title="Admin access required"
        description="Settings are available to administrators only."
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Settings"
        count="Admin"
        breadcrumbs={[
          { label: "Admin", to: "/app" },
          { label: "Settings" },
          { label: SETTINGS_TABS.find((tab) => tab.id === activeTab)?.label ?? "General" },
        ]}
        actions={
          <>
            <ToolbarButton icon="history">View Audit</ToolbarButton>
            <ToolbarButton icon="save" variant="primary">
              Save Changes
            </ToolbarButton>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)]">
        <nav className="h-fit overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
          {SETTINGS_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex w-full items-center gap-3 border-l-4 px-4 py-3 text-left text-sm font-semibold transition-colors",
                activeTab === tab.id
                  ? "border-primary bg-primary-light text-primary"
                  : "border-transparent text-text-secondary hover:bg-muted",
              )}
            >
              <span className="material-symbols-outlined text-[20px]">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="min-w-0">
          {activeTab === "general" ? <GeneralSettingsPanel /> : null}
          {activeTab === "pipeline" ? <PipelineSettingsPanel /> : null}
          {activeTab === "users" ? <UsersSettingsPanel /> : null}
          {activeTab === "leadAssignment" ? <LeadAssignmentPanel /> : null}
          {activeTab === "automations" ? <AutomationsSettingsPanel /> : null}
          {activeTab === "email" ? <EmailNotificationsPanel /> : null}
          {activeTab === "lossReasons" ? <LossReasonsPanel /> : null}
          {activeTab === "auditLog" ? <AuditLogPanel /> : null}
          {activeTab === "landingIntegration" ? <LandingIntegrationPanel /> : null}
        </div>
      </div>
    </>
  );
}

function GeneralSettingsPanel() {
  return (
    <div className="space-y-6">
      <SectionCard
        title="Organization Identity"
        description="Workspace name and branding used across the CRM and automated email signatures."
        actions={<Badge>Enterprise Plan</Badge>}
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_180px]">
          <div className="space-y-4">
            <InputControl label="CRM Instance Name" value="Tally CRM Sales" onChange={() => {}} />
            <p className="text-sm text-text-secondary">
              This name appears in browser titles, notifications, and system-generated messages.
            </p>
          </div>
          <label className="group flex h-36 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted text-center transition-colors hover:border-primary hover:bg-primary-light">
            <span className="material-symbols-outlined text-[34px] text-text-muted group-hover:text-primary">
              cloud_upload
            </span>
            <span className="mt-2 text-xs font-semibold text-text-secondary group-hover:text-primary">
              Replace Logo
            </span>
            <input type="file" className="sr-only" />
          </label>
        </div>
      </SectionCard>

      <SectionCard title="Regional Preferences" description="Defaults follow the PRD: GHS first.">
        <div className="grid gap-4 md:grid-cols-2">
          <SelectControl
            label="Default Currency"
            value="GHS - Ghanaian Cedi"
            onChange={() => {}}
            options={[
              "GHS - Ghanaian Cedi",
              "USD - US Dollar",
              "EUR - Euro",
              "GBP - British Pound",
            ]}
          />
          <SelectControl
            label="Timezone"
            value="GMT - Greenwich Mean Time"
            onChange={() => {}}
            options={[
              "GMT - Greenwich Mean Time",
              "UTC - Coordinated Universal Time",
              "Africa/Accra",
            ]}
          />
          <SelectControl
            label="Date Format"
            value="DD/MM/YYYY"
            onChange={() => {}}
            options={["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]}
          />
          <SelectControl
            label="System Language"
            value="English (United States)"
            onChange={() => {}}
            options={["English (United States)", "French", "Spanish"]}
          />
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-3">
        <InfoPanel icon="verified" title="Subscription Status" body="Plan: Sales Professional" />
        <InfoPanel
          icon="info"
          title="Regional Impact"
          body="Currency and date settings affect reports, dashboards, and exported values."
        />
        <InfoPanel
          icon="admin_panel_settings"
          title="Admin Only"
          body="Per the URD, managers and reps cannot access system settings."
        />
      </div>
    </div>
  );
}

function PipelineSettingsPanel() {
  return (
    <div className="space-y-6">
      <SectionCard
        title="Sales Pipeline Configuration"
        description="Seven canonical stages from the PRD. Closed stages are locked; total stages cannot drop below three."
        actions={
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-primary hover:bg-primary-light">
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            Add Stage
          </button>
        }
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left">
            <thead className="border-b border-border bg-muted">
              <tr>
                {["Order", "Stage Name", "Color", "SLA Days", "Closed", "Actions"].map(
                  (heading) => (
                    <th
                      key={heading}
                      className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-text-muted"
                    >
                      {heading}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {PIPELINE_STAGES.map((stage, index) => (
                <tr key={stage.name} className="hover:bg-muted/40">
                  <td className="px-5 py-4">
                    <span className="material-symbols-outlined text-text-muted">
                      drag_indicator
                    </span>
                    <span className="ml-2 text-sm font-semibold">{index + 1}</span>
                  </td>
                  <td className="px-5 py-4">
                    <input
                      value={stage.name}
                      readOnly
                      className="w-full max-w-[260px] rounded-lg border border-transparent bg-transparent px-2 py-2 text-sm font-semibold outline-none focus:border-primary focus:bg-card"
                    />
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={cn(
                        "inline-flex h-7 w-7 rounded-full border-2 border-white shadow-[var(--shadow-xs)] ring-1 ring-border",
                        stage.color,
                      )}
                    />
                  </td>
                  <td className="px-5 py-4">
                    <input
                      value={stage.sla}
                      readOnly
                      className="h-10 w-16 rounded-lg border border-border bg-card text-center text-sm font-semibold"
                    />
                  </td>
                  <td className="px-5 py-4">
                    <AutomationSwitch checked={stage.closed} disabled onChange={() => {}} />
                  </td>
                  <td className="px-5 py-4">
                    <IconButton
                      icon={stage.locked ? "lock" : "delete"}
                      label={stage.locked ? "Locked default stage" : "Remove stage"}
                      danger={!stage.locked}
                      onClick={() => {}}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          icon="speed"
          label="Avg. Velocity"
          value="24.2d"
          tone="bg-primary-light text-primary"
        />
        <StatCard
          icon="trending_up"
          label="Conversion Rate"
          value="18.5%"
          tone="bg-accent-light text-accent-dark"
        />
        <InfoPanel
          icon="tips_and_updates"
          title="AI Optimizer"
          body="System suggests a 2-day SLA for Negotiation based on historical closure speed."
        />
      </div>
    </div>
  );
}

function UsersSettingsPanel() {
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-xs)] lg:flex-row lg:items-end">
        <div className="grid flex-1 gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px]">
          <label className="block space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              Search
            </span>
            <input className="input" placeholder="Filter by name or email..." />
          </label>
          <SelectField
            label="Role"
            value="all"
            onChange={() => {}}
            options={[
              { label: "All Roles", value: "all" },
              { label: "Admin", value: "admin" },
              { label: "Sales Manager", value: "manager" },
              { label: "Sales Rep", value: "rep" },
            ]}
          />
          <SelectField
            label="Status"
            value="all"
            onChange={() => {}}
            options={[
              { label: "All Statuses", value: "all" },
              { label: "Active", value: "active" },
              { label: "Pending", value: "pending" },
            ]}
          />
        </div>
        <ToolbarButton icon="person_add" variant="cta" onClick={() => setInviteOpen(true)}>
          Invite User
        </ToolbarButton>
      </div>

      <SectionCard
        title="Users & Roles"
        description="Admin can invite users, assign one of the three CRM roles, and monitor mandatory 2FA enrollment."
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead className="border-b border-border bg-muted">
              <tr>
                {["User", "Email", "Role", "Status", "2FA Status", "Last Login", "Actions"].map(
                  (heading) => (
                    <th
                      key={heading}
                      className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-text-muted"
                    >
                      {heading}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {SETTINGS_USERS.map((user) => (
                <tr key={user.email} className="hover:bg-muted/40">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                        {user.initials}
                      </span>
                      <span className="font-semibold">{user.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-text-secondary">{user.email}</td>
                  <td className="px-5 py-4">
                    <select className="input h-9 min-w-[150px]" defaultValue={user.role}>
                      <option>Admin</option>
                      <option>Sales Manager</option>
                      <option>Sales Rep</option>
                    </select>
                  </td>
                  <td className="px-5 py-4">
                    <StatusPill tone={user.status === "Active" ? "success" : "warning"}>
                      {user.status}
                    </StatusPill>
                  </td>
                  <td className="px-5 py-4">
                    <StatusPill tone={user.mfa === "Enrolled" ? "primary" : "warning"}>
                      {user.mfa}
                    </StatusPill>
                  </td>
                  <td className="px-5 py-4 text-sm text-text-secondary">{user.lastLogin}</td>
                  <td className="px-5 py-4">
                    <IconButton icon="more_vert" label="User actions" onClick={() => {}} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="grid gap-4 md:grid-cols-3">
        <RoleOverview icon="admin_panel_settings" title="Administrators" users="1 User" />
        <RoleOverview icon="groups" title="Sales Managers" users="1 User" />
        <RoleOverview icon="person" title="Sales Reps" users="1 User" />
      </div>

      {inviteOpen ? <InviteUserDialog onClose={() => setInviteOpen(false)} /> : null}
    </div>
  );
}

function AutomationsSettingsPanel() {
  const role = useCurrentRole();
  const { data, isLoading, isError, error, refetch } = useAutomations();
  const toggleAutomation = useToggleAutomation();
  const saveAutomation = useSaveAutomation();
  const deleteAutomation = useDeleteAutomation();
  const [view, setView] = useState<ViewMode>("list");
  const [search, setSearch] = useState("");
  const [triggerFilter, setTriggerFilter] = useState<"all" | AutomationTriggerType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | AutomationStatus>("all");
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [selectedId, setSelectedId] = useState("new-lead-auto-assign");
  const [draft, setDraft] = useState<AutomationRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AutomationRule | null>(null);

  const rules = data?.rules ?? EMPTY_RULES;
  const runs = data?.runs ?? EMPTY_RUNS;
  const selectedRule = rules.find((rule) => rule.id === selectedId) ?? rules[0] ?? null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = rules.filter((rule) => {
      const triggerMatch = triggerFilter === "all" || rule.triggerType === triggerFilter;
      const statusMatch = statusFilter === "all" || rule.status === statusFilter;
      const searchMatch =
        !q ||
        [
          rule.name,
          rule.description,
          rule.triggerLabel,
          rule.condition,
          rule.actions.map((a) => a.label).join(" "),
        ].some((value) => value.toLowerCase().includes(q));
      return triggerMatch && statusMatch && searchMatch;
    });

    return list.sort((a, b) => {
      if (sortKey === "runs") return b.runs - a.runs;
      if (sortKey === "success") return b.successRate - a.successRate;
      return new Date(b.lastEditedAt).getTime() - new Date(a.lastEditedAt).getTime();
    });
  }, [rules, search, sortKey, statusFilter, triggerFilter]);

  if (role !== "admin") {
    return (
      <ErrorState
        title="Admin access required"
        description="Automation settings are available to administrators only."
      />
    );
  }

  async function handleToggle(rule: AutomationRule, checked: boolean) {
    try {
      await toggleAutomation.mutateAsync({ rule, checked });
      toast.success(checked ? "Automation activated" : "Automation paused");
    } catch (err) {
      toast.error("Could not update automation", { description: (err as Error).message });
    }
  }

  function startCreate(template?: (typeof AUTOMATION_TEMPLATES)[number]) {
    setDraft(template ? createRuleFromTemplate(template) : buildBlankRule());
    setView("builder");
  }

  function startEdit(rule: AutomationRule) {
    setSelectedId(rule.id);
    setDraft(rule);
    setView("builder");
  }

  async function saveDraft(status: AutomationStatus) {
    if (!draft) return;
    if (!draft.name.trim() || draft.actions.length === 0) {
      toast.error("Validation failure", {
        description: "Automation rules require a name and at least one executable action.",
      });
      setView("error");
      return;
    }
    const saved = { ...draft, status };
    await saveAutomation.mutateAsync(saved);
    setSelectedId(saved.id);
    setDraft(null);
    setView("detail");
    toast.success(status === "active" ? "Automation activated" : "Automation saved");
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await deleteAutomation.mutateAsync(deleteTarget.id);
    toast.success("Automation deleted", {
      description: `${deleteTarget.name} has been removed from the visible list for this session.`,
    });
    if (selectedId === deleteTarget.id)
      setSelectedId(rules.find((rule) => rule.id !== deleteTarget.id)?.id ?? "");
    setDeleteTarget(null);
    setView("list");
  }

  return (
    <>
      <PageHeader
        title="Automations"
        count={isLoading ? "Loading" : `${data?.stats.active ?? 0} Active`}
        breadcrumbs={[
          { label: "Admin", to: "/app" },
          { label: "Settings" },
          { label: "Automations" },
        ]}
        actions={
          <>
            <ToolbarButton icon="refresh" onClick={() => refetch()}>
              Refresh
            </ToolbarButton>
            <ToolbarButton icon="add" variant="cta" onClick={() => startCreate()}>
              Create Automation
            </ToolbarButton>
          </>
        }
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2 shadow-[var(--shadow-xs)]">
          {(["list", "builder", "detail", "empty", "error"] as ViewMode[]).map((item) => (
            <button
              key={item}
              onClick={() => setView(item)}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold capitalize transition-colors",
                view === item
                  ? "bg-primary text-primary-foreground"
                  : "text-text-secondary hover:bg-muted",
              )}
            >
              <span className="material-symbols-outlined text-[17px]">{viewIcon(item)}</span>
              {item}
            </button>
          ))}
        </div>
        <div className="rounded-xl border border-primary/20 bg-primary-light px-4 py-3 text-sm text-primary">
          <span className="font-semibold">Audit:</span> automated actions are shown as{" "}
          <span className="font-semibold">System/Automation</span> in run history.
        </div>
      </div>

      {view === "builder" ? (
        <RuleBuilder
          draft={draft ?? selectedRule ?? buildBlankRule()}
          onChange={setDraft}
          onCancel={() => {
            setDraft(null);
            setView("list");
          }}
          onSaveDraft={() => saveDraft("draft")}
          onActivate={() => saveDraft("active")}
        />
      ) : view === "detail" && selectedRule ? (
        <RuleDetail
          rule={selectedRule}
          runs={runs.filter((run) => run.ruleId === selectedRule.id)}
          onEdit={() => startEdit(selectedRule)}
          onDelete={() => setDeleteTarget(selectedRule)}
          onToggle={handleToggle}
        />
      ) : view === "empty" ? (
        <AutomationEmptyState onCreate={startCreate} />
      ) : view === "error" ? (
        <AutomationErrorState onBack={() => setView("builder")} />
      ) : (
        <>
          <AutomationToolbar
            search={search}
            onSearchChange={setSearch}
            triggerFilter={triggerFilter}
            onTriggerFilterChange={setTriggerFilter}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            sortKey={sortKey}
            onSortChange={setSortKey}
          />

          {isLoading ? (
            <SectionCard bodyClassName="p-0">
              <TableSkeleton rows={7} columns={7} />
            </SectionCard>
          ) : isError ? (
            <ErrorState
              description={(error as Error)?.message ?? "Could not load automations"}
              onRetry={() => refetch()}
            />
          ) : filtered.length === 0 ? (
            <AutomationEmptyState onCreate={startCreate} />
          ) : (
            <>
              <AutomationsTable
                rules={filtered}
                selectedId={selectedRule?.id}
                onOpen={(rule) => {
                  setSelectedId(rule.id);
                  setView("detail");
                }}
                onEdit={startEdit}
                onDelete={setDeleteTarget}
                onToggle={handleToggle}
              />
              <AutomationStatsPanel stats={data!.stats} />
            </>
          )}
        </>
      )}

      <DeleteAutomationDialog
        rule={deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}

function LeadAssignmentPanel() {
  return (
    <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
      <div className="space-y-4">
        <SectionCard
          title="Assignment Strategy"
          description="Incoming landing-page leads can stay manual or use round-robin assignment."
        >
          <div className="space-y-3">
            <StrategyOption
              title="Manual Assignment"
              description="Leads go to a general pool for manual selection."
            />
            <StrategyOption
              title="Round-Robin"
              description="Automatically distribute leads in a sequential loop."
              active
            />
            <div className="rounded-lg border border-border bg-muted p-4 opacity-70">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Territory-based</p>
                  <p className="mt-1 text-sm text-text-secondary">
                    Assign leads by geography or industry segment.
                  </p>
                </div>
                <Badge>Coming Soon</Badge>
              </div>
            </div>
          </div>
        </SectionCard>
        <InfoPanel
          icon="info"
          title="Round-Robin Rule"
          body="Changes to representative order or active status apply to new leads immediately."
        />
      </div>

      <SectionCard
        title="Round-Robin Queue"
        description="Drag handles indicate assignment priority; inactive reps are skipped."
        bodyClassName="p-0"
        actions={<Badge>{ASSIGNMENT_REPS.filter((rep) => rep.active).length} Active Reps</Badge>}
      >
        <div className="divide-y divide-border">
          {ASSIGNMENT_REPS.map((rep, index) => (
            <div
              key={rep.name}
              className="grid gap-4 px-5 py-4 transition-colors hover:bg-muted/50 md:grid-cols-[auto_44px_minmax(0,1fr)_120px_auto]"
            >
              <span className="material-symbols-outlined self-center text-text-muted">
                drag_indicator
              </span>
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                {rep.initials}
              </span>
              <div className="min-w-0">
                <p className="font-semibold">{rep.name}</p>
                <p className="text-sm text-text-secondary">{rep.title}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                  Current Load
                </p>
                <p className="text-[16px] font-semibold text-primary">{rep.load} Leads</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-text-muted">#{index + 1}</span>
                <AutomationSwitch checked={rep.active} onChange={() => {}} />
              </div>
            </div>
          ))}
        </div>
        <footer className="flex flex-col justify-between gap-3 border-t border-border bg-muted px-5 py-4 sm:flex-row sm:items-center">
          <button className="text-sm font-semibold text-text-secondary hover:text-primary">
            Reset Queue Order
          </button>
          <button
            onClick={() => toast.success("Lead assignment rules saved")}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
          >
            Save Assignment Logic
          </button>
        </footer>
      </SectionCard>
    </div>
  );
}

function EmailNotificationsPanel() {
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
      <div className="space-y-6">
        <SectionCard
          title="Provider Configuration"
          description="Provider secrets stay server-side."
        >
          <div className="space-y-4">
            <SelectControl
              label="Email Provider"
              value="Resend"
              onChange={() => {}}
              options={["Resend", "SendGrid", "SMTP"]}
            />
            <label className="block space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                API Key
              </span>
              <div className="relative">
                <input
                  value="re_xxxxxxxxxxxxxxxxxxxx"
                  readOnly
                  type={showKey ? "text" : "password"}
                  className="input pr-10"
                />
                <button
                  onClick={() => setShowKey((value) => !value)}
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-text-muted hover:text-primary"
                  title={showKey ? "Hide key" : "Reveal key"}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showKey ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <InputControl label="From Name" value="Tally CRM Sales" onChange={() => {}} />
              <InputControl label="From Email" value="sales@tallycrm.io" onChange={() => {}} />
            </div>
            <div className="flex gap-2 border-t border-border pt-4">
              <button className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">
                Save Provider Settings
              </button>
              <button
                onClick={() => toast.success("Test email queued")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">send</span>
                Test
              </button>
            </div>
          </div>
        </SectionCard>
        <InfoPanel
          icon="dns"
          title="Deliverability Tip"
          body="Configure SPF and DKIM records for the sending domain before enabling outbound sequences."
        />
      </div>

      <SectionCard
        title="Notification Matrix"
        description="Configure email and in-app mirrors for assignments, escalations, and digests."
        bodyClassName="p-0"
      >
        <div className="divide-y divide-border">
          {NOTIFICATION_ROWS.map((row) => (
            <div
              key={row.label}
              className="grid gap-4 px-5 py-4 transition-colors hover:bg-muted/50 md:grid-cols-[minmax(0,1fr)_160px]"
            >
              <div>
                <p className="font-semibold">{row.label}</p>
                <p className="text-sm text-text-secondary">{row.detail}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <ToggleWithLabel label="Email" checked={row.email} />
                <ToggleWithLabel label="In-App" checked={row.app} />
              </div>
            </div>
          ))}
        </div>
        <footer className="flex items-center justify-between border-t border-border bg-muted px-5 py-4">
          <p className="text-sm text-text-secondary">Changes are saved automatically.</p>
          <button className="text-sm font-semibold text-danger hover:underline">
            Reset to Default
          </button>
        </footer>
      </SectionCard>
    </div>
  );
}

function LossReasonsPanel() {
  const [reasons, setReasons] = useState(LOSS_REASONS);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <SectionCard
        title="Loss Reasons"
        description="Closed-Lost deals require a reason so win/loss reporting stays consistent."
        actions={
          <button
            onClick={() => setReasons((items) => [...items, "Custom reason"])}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-primary hover:bg-primary-light"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            Add Reason
          </button>
        }
      >
        <div className="space-y-3">
          {reasons.map((reason, index) => (
            <div
              key={`${reason}-${index}`}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-[var(--shadow-xs)] hover:border-primary/40"
            >
              <span className="material-symbols-outlined text-text-muted">drag_indicator</span>
              <input
                value={reason}
                onChange={(event) =>
                  setReasons((items) =>
                    items.map((item, itemIndex) =>
                      itemIndex === index ? event.target.value : item,
                    ),
                  )
                }
                className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-medium outline-none focus:ring-0"
              />
              {index === 0 ? <Badge>System</Badge> : null}
              <IconButton
                icon="delete"
                label="Delete reason"
                danger
                onClick={() =>
                  setReasons((items) => items.filter((_, itemIndex) => itemIndex !== index))
                }
              />
            </div>
          ))}
        </div>
      </SectionCard>
      <InfoPanel
        icon="bar_chart"
        title="Loss Reason Reporting"
        body="These labels feed Deal Analytics. Keep them general and use deal notes for specific details."
      />
    </div>
  );
}

function AuditLogPanel() {
  return (
    <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
      <SectionCard title="Filter Panel" description="Filter admin and automated system events.">
        <div className="space-y-4">
          <SelectControl
            label="Actor"
            value="All Users"
            onChange={() => {}}
            options={["All Users", "Sarah Jenkins", "Michael Chen", "System / Automation"]}
          />
          <SelectControl
            label="Entity Type"
            value="All Entities"
            onChange={() => {}}
            options={["All Entities", "Lead", "Deal", "Task", "User Settings", "API Key"]}
          />
          <InputControl label="Start Date" value="2024-10-01" onChange={() => {}} />
          <InputControl label="End Date" value="2024-10-24" onChange={() => {}} />
          <button className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">
            Apply Filters
          </button>
        </div>
      </SectionCard>

      <SectionCard
        title="Audit Log"
        description="Actor, action, entity, timestamp, and IP address."
        actions={
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted">
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export CSV
          </button>
        }
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead className="border-b border-border bg-muted">
              <tr>
                {["Actor", "Action", "Entity", "Entity Name", "Timestamp", "IP Address"].map(
                  (heading) => (
                    <th
                      key={heading}
                      className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-text-muted"
                    >
                      {heading}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {AUDIT_LOG_ROWS.map((row) => (
                <tr key={`${row.actor}-${row.timestamp}`} className="hover:bg-muted/40">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-light text-xs font-bold text-primary">
                        {row.initials}
                      </span>
                      <span>
                        <span className="block text-sm font-semibold">{row.actor}</span>
                        <span className="block text-xs text-text-muted">{row.email}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <StatusPill tone={row.tone === "danger" ? "warning" : row.tone}>
                      {row.action}
                    </StatusPill>
                  </td>
                  <td className="px-5 py-4 text-sm">{row.entity}</td>
                  <td className="px-5 py-4 text-sm font-semibold">{row.entityName}</td>
                  <td className="px-5 py-4 whitespace-nowrap text-sm text-text-secondary">
                    {row.timestamp}
                  </td>
                  <td className="px-5 py-4 font-mono text-sm text-text-secondary">{row.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

function LandingIntegrationPanel() {
  const endpoint = "POST {SUPABASE_URL}/functions/v1/leads-capture";

  return (
    <div className="space-y-6">
      <SectionCard
        title="Landing Page Integration"
        description="Public landing page remains write-only; CRM reads are never exposed to the browser."
        actions={<Badge>Last test passed</Badge>}
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="space-y-4">
            <CopyField label="Edge Function Endpoint" value={endpoint} />
            <CopyField label="Publishable API Key" value="sb_publishable_xxxxxxxxxxxxxxxxxxxx" />
            <pre className="overflow-x-auto rounded-lg border border-border bg-muted p-4 text-xs leading-6 text-text-secondary">
              {`{
  "first_name": "Ama",
  "last_name": "Mensah",
  "email": "ama@example.com",
  "phone": "+233 555 0101",
  "company_name": "Accra Retail Ltd",
  "message": "Interested in TallyPrime"
}`}
            </pre>
          </div>
          <div className="space-y-3 rounded-lg border border-primary/20 bg-primary-light p-4">
            <p className="text-sm font-semibold text-primary">Connect Lovable landing page</p>
            {[
              "Point the form POST action to the Edge Function endpoint.",
              "Send the JSON payload schema shown here.",
              "Keep service role and Resend keys inside Edge Functions only.",
              "Submit a test lead and confirm CRM appearance.",
            ].map((step, index) => (
              <div key={step} className="flex gap-2 text-sm text-text-secondary">
                <span className="font-bold text-primary">{index + 1}.</span>
                <span>{step}</span>
              </div>
            ))}
            <button
              onClick={() => toast.success("Test lead sent", { description: "Response: 200 OK" })}
              className="mt-2 w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
            >
              Send Test Lead
            </button>
          </div>
        </div>
      </SectionCard>
      <SectionCard title="Live Response Log" description="Recent endpoint health checks.">
        <div className="space-y-3 text-sm">
          <LogLine status="200 OK" detail="Lead inserted with source Tally Landing Page" />
          <LogLine status="200 OK" detail="Confirmation email queued after successful save" />
          <LogLine status="422" detail="Rejected missing required email field" muted />
        </div>
      </SectionCard>
    </div>
  );
}

function StrategyOption({
  title,
  description,
  active,
}: {
  title: string;
  description: string;
  active?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors",
        active
          ? "border-primary bg-primary-light text-primary"
          : "border-border hover:bg-muted text-foreground",
      )}
    >
      <input checked={active} readOnly type="radio" className="mt-1 text-primary" />
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-1 block text-sm text-text-secondary">{description}</span>
      </span>
    </label>
  );
}

function ToggleWithLabel({ label, checked }: { label: string; checked: boolean }) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs font-semibold text-text-secondary">
      {label}
      <AutomationSwitch checked={checked} onChange={() => {}} />
    </label>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
        {label}
      </span>
      <div className="flex overflow-hidden rounded-lg border border-border bg-muted">
        <code className="min-w-0 flex-1 truncate px-3 py-2 text-sm text-text-secondary">
          {value}
        </code>
        <button
          onClick={() => toast.success("Copied")}
          type="button"
          className="inline-flex items-center gap-1 border-l border-border bg-card px-3 text-sm font-semibold hover:bg-primary-light hover:text-primary"
        >
          <span className="material-symbols-outlined text-[17px]">content_copy</span>
          Copy
        </button>
      </div>
    </label>
  );
}

function LogLine({ status, detail, muted }: { status: string; detail: string; muted?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2",
        muted ? "bg-muted text-text-secondary" : "bg-card",
      )}
    >
      <span className="font-medium">{detail}</span>
      <span
        className={cn(
          "rounded-full px-2 py-1 text-xs font-bold",
          status.startsWith("200")
            ? "bg-success-light text-success"
            : "bg-warning-light text-warning",
        )}
      >
        {status}
      </span>
    </div>
  );
}

function InfoPanel({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-xs)]">
      <div className="mb-3 flex items-center gap-2">
        <span className="material-symbols-outlined flex h-9 w-9 items-center justify-center rounded-lg bg-primary-light text-primary">
          {icon}
        </span>
        <h3 className="text-[16px] font-semibold">{title}</h3>
      </div>
      <p className="text-sm leading-6 text-text-secondary">{body}</p>
    </div>
  );
}

function StatusPill({
  tone,
  children,
}: {
  tone: "primary" | "success" | "warning";
  children: ReactNode;
}) {
  const tones = {
    primary: "bg-primary-light text-primary",
    success: "bg-success-light text-success",
    warning: "bg-warning-light text-warning",
  };
  return (
    <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-bold", tones[tone])}>
      {children}
    </span>
  );
}

function RoleOverview({ icon, title, users }: { icon: string; title: string; users: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-xs)]">
      <div className="mb-3 flex items-center justify-between">
        <span className="material-symbols-outlined text-primary">{icon}</span>
        <span className="rounded bg-secondary px-2 py-1 text-xs font-semibold text-primary">
          {users}
        </span>
      </div>
      <h3 className="text-[16px] font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-text-secondary">
        Role permissions follow the Admin, Sales Manager, and Sales Rep matrix in the URD.
      </p>
    </div>
  );
}

function InviteUserDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-lg)]">
        <div className="border-b border-border p-6">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined flex h-11 w-11 items-center justify-center rounded-full bg-cta text-white">
              person_add
            </span>
            <div>
              <h3 className="text-[20px] font-semibold">Invite User</h3>
              <p className="text-sm text-text-secondary">
                Invitee must enroll 2FA before accessing CRM data.
              </p>
            </div>
          </div>
        </div>
        <div className="space-y-4 p-6">
          <InputControl label="Email Address" value="new.user@tallycrm.com" onChange={() => {}} />
          <SelectControl
            label="Role"
            value="Sales Rep"
            onChange={() => {}}
            options={["Admin", "Sales Manager", "Sales Rep"]}
          />
          <div className="rounded-lg border border-warning/20 bg-warning-light p-3 text-sm text-warning">
            Pending users display as 2FA Pending until their first-login enrollment is complete.
          </div>
        </div>
        <div className="flex flex-col-reverse gap-3 border-t border-border bg-muted p-4 sm:flex-row sm:justify-end">
          <button
            onClick={onClose}
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              toast.success("Invitation sent", {
                description: "The user will be required to complete 2FA enrollment.",
              });
              onClose();
            }}
            className="rounded-lg bg-cta px-4 py-2 text-sm font-semibold text-white hover:bg-cta-hover"
          >
            Send Invite
          </button>
        </div>
      </div>
    </div>
  );
}

function AutomationToolbar({
  search,
  onSearchChange,
  triggerFilter,
  onTriggerFilterChange,
  statusFilter,
  onStatusFilterChange,
  sortKey,
  onSortChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  triggerFilter: "all" | AutomationTriggerType;
  onTriggerFilterChange: (value: "all" | AutomationTriggerType) => void;
  statusFilter: "all" | AutomationStatus;
  onStatusFilterChange: (value: "all" | AutomationStatus) => void;
  sortKey: SortKey;
  onSortChange: (value: SortKey) => void;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-xs)] xl:flex-row xl:items-end">
      <label className="block min-w-[260px] flex-1 space-y-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          Search
        </span>
        <div className="relative">
          <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-text-muted">
            search
          </span>
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="input pl-10"
            placeholder="Search automations, triggers, actions..."
            type="search"
          />
        </div>
      </label>
      <SelectField
        label="Trigger Type"
        value={triggerFilter}
        onChange={(value) => onTriggerFilterChange(value as "all" | AutomationTriggerType)}
        options={TRIGGER_FILTERS}
      />
      <SelectField
        label="Status"
        value={statusFilter}
        onChange={(value) => onStatusFilterChange(value as "all" | AutomationStatus)}
        options={STATUS_FILTERS}
      />
      <SelectField
        label="Sort"
        value={sortKey}
        onChange={(value) => onSortChange(value as SortKey)}
        options={[
          { label: "Last edited", value: "recent" },
          { label: "Most runs", value: "runs" },
          { label: "Success rate", value: "success" },
        ]}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
}) {
  return (
    <label className="block min-w-[170px] space-y-1">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
        {label}
      </span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="input">
        {options.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function AutomationsTable({
  rules,
  selectedId,
  onOpen,
  onEdit,
  onDelete,
  onToggle,
}: {
  rules: AutomationRule[];
  selectedId?: string;
  onOpen: (rule: AutomationRule) => void;
  onEdit: (rule: AutomationRule) => void;
  onDelete: (rule: AutomationRule) => void;
  onToggle: (rule: AutomationRule, checked: boolean) => void;
}) {
  return (
    <SectionCard className="overflow-hidden" bodyClassName="p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left">
          <thead className="border-b border-border bg-muted">
            <tr>
              {[
                "Automation Name",
                "Trigger",
                "Summary",
                "Runs",
                "Status",
                "Last Run",
                "Actions",
              ].map((heading) => (
                <th
                  key={heading}
                  className={cn(
                    "px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-text-muted",
                    heading === "Runs" && "text-center",
                    heading === "Actions" && "text-right",
                  )}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rules.map((rule) => (
              <tr
                key={rule.id}
                className={cn(
                  "group transition-colors hover:bg-primary-light/50",
                  selectedId === rule.id && "bg-primary-light/40",
                  rule.status === "inactive" && "opacity-60",
                )}
              >
                <td className="px-5 py-4">
                  <button onClick={() => onOpen(rule)} className="block text-left">
                    <span className="inline-flex items-center gap-2 text-[15px] font-semibold text-foreground">
                      {rule.name}
                      {rule.isDefault ? <Badge>Default</Badge> : null}
                    </span>
                    <span className="mt-1 block text-xs text-text-muted">
                      Managed by {rule.owner}
                    </span>
                  </button>
                </td>
                <td className="px-5 py-4">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">
                    <span className="material-symbols-outlined text-[15px]">
                      {rule.triggerIcon}
                    </span>
                    {rule.triggerLabel}
                  </span>
                </td>
                <td className="max-w-[320px] px-5 py-4 text-sm text-text-secondary">
                  {rule.description}
                </td>
                <td className="px-5 py-4 text-center text-sm font-semibold">
                  {rule.runs.toLocaleString()}
                </td>
                <td className="px-5 py-4">
                  <AutomationSwitch
                    checked={rule.status === "active"}
                    disabled={rule.status === "draft"}
                    onChange={(checked) => onToggle(rule, checked)}
                  />
                </td>
                <td className="px-5 py-4 text-sm text-text-secondary">
                  {rule.lastRunAt ? relative(rule.lastRunAt) : "Never"}
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center justify-end gap-1 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100">
                    <IconButton icon="visibility" label="View" onClick={() => onOpen(rule)} />
                    <IconButton icon="edit" label="Edit" onClick={() => onEdit(rule)} />
                    <IconButton
                      icon="content_copy"
                      label="Duplicate"
                      onClick={() =>
                        onEdit({
                          ...rule,
                          id: `copy-${rule.id}-${Date.now()}`,
                          name: `${rule.name} Copy`,
                          isDefault: false,
                          status: "draft",
                          runs: 0,
                          lastRunAt: null,
                        })
                      }
                    />
                    <IconButton
                      icon="delete"
                      label="Delete"
                      danger
                      onClick={() => onDelete(rule)}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="flex flex-col items-center justify-between gap-3 border-t border-border bg-muted/30 px-5 py-4 text-sm text-text-secondary sm:flex-row">
        <span>
          Showing 1 to {rules.length} of {rules.length} automations
        </span>
        <div className="flex gap-1">
          {[1, 2, 3].map((page) => (
            <button
              key={page}
              className={cn(
                "h-8 w-8 rounded border border-border text-xs font-semibold",
                page === 1 ? "bg-primary text-white" : "bg-card text-text-secondary hover:bg-muted",
              )}
            >
              {page}
            </button>
          ))}
        </div>
      </footer>
    </SectionCard>
  );
}

function RuleBuilder({
  draft,
  onChange,
  onCancel,
  onSaveDraft,
  onActivate,
}: {
  draft: AutomationRule;
  onChange: (rule: AutomationRule) => void;
  onCancel: () => void;
  onSaveDraft: () => void;
  onActivate: () => void;
}) {
  const [pulse, setPulse] = useState(false);
  const summary = `When a ${draft.object} matches "${draft.condition}", ${draft.actions.map((a) => a.label.toLowerCase()).join(" and ")}.`;

  function update(patch: Partial<AutomationRule>) {
    onChange({ ...draft, ...patch });
    setPulse(true);
    window.setTimeout(() => setPulse(false), 180);
  }

  return (
    <div className="space-y-6">
      <section
        className={cn(
          "flex items-start gap-3 rounded-xl border border-primary/20 bg-primary-light p-4 transition-transform",
          pulse && "scale-[1.01]",
        )}
      >
        <span className="material-symbols-outlined flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white">
          bolt
        </span>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
            Live Summary
          </p>
          <p className="text-[15px] font-medium text-foreground">{summary}</p>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <BuilderBlock icon="play_arrow" tone="bg-primary text-white" label="WHEN" tag="Trigger">
            <div className="grid gap-4 md:grid-cols-3">
              <SelectControl
                label="Event Type"
                value={draft.triggerLabel}
                onChange={(value) => update(triggerDefaults(value))}
                options={TRIGGER_OPTIONS.map((option) => option.label)}
              />
              <SelectControl
                label="Object"
                value={draft.object}
                onChange={(value) => update({ object: value as AutomationRule["object"] })}
                options={["Lead", "Deal", "Contact", "Task", "Digest"]}
              />
              <InputControl
                label="Condition"
                value={draft.condition}
                onChange={(value) => update({ condition: value })}
              />
            </div>
          </BuilderBlock>

          <BuilderBlock icon="filter_alt" tone="bg-warning text-white" label="IF" tag="Conditions">
            <div className="rounded-lg border border-border bg-muted p-3">
              <div className="flex flex-wrap items-center gap-3">
                <SelectControl
                  label="Field"
                  value="Value"
                  onChange={() => undefined}
                  options={["Value", "Region", "Industry", "Owner"]}
                />
                <SelectControl
                  label="Operator"
                  value=">"
                  onChange={() => undefined}
                  options={[">", "<", "=", "contains"]}
                />
                <InputControl label="Value" value="5000" onChange={() => undefined} />
                <button className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  Add condition
                </button>
              </div>
            </div>
          </BuilderBlock>

          <BuilderBlock
            icon="forward_to_inbox"
            tone="bg-success text-white"
            label="THEN"
            tag="Actions"
            highlight
          >
            <div className="space-y-3">
              {draft.actions.map((action, index) => (
                <div
                  key={`${action.label}-${index}`}
                  className="grid gap-3 rounded-lg border border-border bg-muted p-3 md:grid-cols-[1fr_1fr_auto]"
                >
                  <InputControl
                    label={`Action ${index + 1}`}
                    value={action.label}
                    onChange={(value) =>
                      update({
                        actions: draft.actions.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, label: value } : item,
                        ),
                      })
                    }
                  />
                  <InputControl
                    label="Detail"
                    value={action.detail}
                    onChange={(value) =>
                      update({
                        actions: draft.actions.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, detail: value } : item,
                        ),
                      })
                    }
                  />
                  <button
                    onClick={() =>
                      update({
                        actions: draft.actions.filter((_, itemIndex) => itemIndex !== index),
                      })
                    }
                    className="mt-5 flex h-10 w-10 items-center justify-center rounded-lg text-text-muted hover:bg-danger-light hover:text-danger"
                    title="Remove action"
                  >
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                </div>
              ))}
              <button
                onClick={() =>
                  update({
                    actions: [
                      ...draft.actions,
                      {
                        type: "task",
                        label: "Create task",
                        detail: "Assign to record owner",
                        dueOffset: "+1d",
                      },
                    ],
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-primary hover:bg-primary-light"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Add action
              </button>
            </div>
          </BuilderBlock>
        </div>

        <SectionCard title="Rule Settings" description="Name, state, and audit behavior.">
          <div className="space-y-4">
            <InputControl
              label="Automation name"
              value={draft.name}
              onChange={(value) => update({ name: value })}
            />
            <label className="block space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                Description
              </span>
              <textarea
                value={draft.description}
                onChange={(e) => update({ description: e.target.value })}
                className="min-h-28 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>
            <div className="rounded-lg border border-border bg-muted p-3 text-sm">
              <p className="font-semibold text-foreground">Audit actor</p>
              <p className="mt-1 text-text-secondary">
                Every action created by this rule is logged as System/Automation.
              </p>
            </div>
          </div>
        </SectionCard>
      </div>

      <footer className="sticky bottom-0 z-20 -mx-6 flex flex-col justify-between gap-3 border-t border-border bg-card px-6 py-4 shadow-[0_-1px_3px_rgba(0,0,0,0.05)] sm:flex-row sm:items-center">
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={onSaveDraft}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
          >
            Save as Draft
          </button>
        </div>
        <button
          onClick={onActivate}
          className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white shadow-[var(--shadow-sm)] hover:bg-primary-dark"
        >
          Activate Rule
        </button>
      </footer>
    </div>
  );
}

function RuleDetail({
  rule,
  runs,
  onEdit,
  onDelete,
  onToggle,
}: {
  rule: AutomationRule;
  runs: AutomationRun[];
  onEdit: () => void;
  onDelete: () => void;
  onToggle: (rule: AutomationRule, checked: boolean) => void;
}) {
  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-xs)] md:flex-row md:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-[28px] font-semibold tracking-tight text-primary">{rule.name}</h2>
            <Badge>{rule.object} Automation</Badge>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-text-secondary">{rule.description}</p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold",
              rule.status === "active"
                ? "bg-success-light text-success"
                : "bg-muted text-text-secondary",
            )}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                rule.status === "active" ? "bg-success" : "bg-text-muted",
              )}
            />
            {capitalize(rule.status)}
          </span>
          <AutomationSwitch
            checked={rule.status === "active"}
            disabled={rule.status === "draft"}
            onChange={(checked) => onToggle(rule, checked)}
          />
          <IconButton icon="edit" label="Edit Rule" onClick={onEdit} />
          <IconButton icon="delete" label="Delete Rule" danger onClick={onDelete} />
        </div>
      </section>

      <SectionCard
        title="Rule Definition"
        description={`Last edited ${relative(rule.lastEditedAt)}`}
      >
        <div className="mx-auto max-w-3xl space-y-4">
          <DefinitionNode
            icon="bolt"
            label="WHEN (Trigger)"
            title={`${rule.object} ${rule.triggerLabel}`}
            detail={rule.condition}
            tone="primary"
          />
          <Connector />
          <DefinitionNode
            icon="filter_alt"
            label="IF (Condition)"
            title={rule.condition}
            detail="All configured conditions must pass before actions execute."
            tone="warning"
          />
          <Connector />
          <div className="space-y-3">
            {rule.actions.map((action, index) => (
              <DefinitionNode
                key={`${action.label}-${index}`}
                icon={actionIcon(action.type)}
                label={`THEN (Action ${index + 1})`}
                title={action.label}
                detail={`${action.detail}${action.dueOffset ? `, due ${action.dueOffset}` : ""}`}
                tone="success"
              />
            ))}
          </div>
        </div>
      </SectionCard>

      <RunHistory runs={runs} />
    </div>
  );
}

function RunHistory({ runs }: { runs: AutomationRun[] }) {
  return (
    <SectionCard
      title="Run History"
      description="Recent automation executions and audit results."
      bodyClassName="p-0"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[780px] text-left">
          <thead className="border-b border-border bg-muted">
            <tr>
              {[
                "Timestamp",
                "Triggering Record",
                "Action Taken",
                "Result",
                "Duration",
                "Actor",
              ].map((heading) => (
                <th
                  key={heading}
                  className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-text-muted"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {runs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8">
                  <EmptyState
                    icon={<span className="material-symbols-outlined text-[28px]">history</span>}
                    title="No runs yet"
                    description="Run history will appear after this automation is activated and triggered."
                  />
                </td>
              </tr>
            ) : (
              runs.map((run) => (
                <tr key={run.id} className="hover:bg-muted/40">
                  <td className="px-5 py-4 text-sm text-text-secondary">
                    {relative(run.timestamp)}
                  </td>
                  <td className="px-5 py-4">
                    <span className="font-semibold text-primary">{run.recordName}</span>
                    <span className="ml-2 text-xs text-text-muted">{run.recordType}</span>
                  </td>
                  <td className="px-5 py-4 text-sm text-text-secondary">
                    <span className="block font-medium text-foreground">{run.actionTaken}</span>
                    {run.message ? (
                      <span className="text-xs text-danger">{run.message}</span>
                    ) : null}
                  </td>
                  <td className="px-5 py-4">
                    <ResultBadge result={run.result} />
                  </td>
                  <td className="px-5 py-4 text-sm text-text-secondary">
                    {(run.durationMs / 1000).toFixed(1)}s
                  </td>
                  <td className="px-5 py-4 text-sm font-semibold text-text-secondary">
                    {run.auditActor}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function AutomationStatsPanel({
  stats,
}: {
  stats: { monthlyRuns: number; weeklyHoursSaved: number; successRate: number };
}) {
  return (
    <div className="mt-6 grid gap-6 md:grid-cols-3">
      <StatCard
        icon="bolt"
        label="Total Executions (This Month)"
        value={stats.monthlyRuns.toLocaleString()}
        tone="bg-primary-light text-primary"
      />
      <StatCard
        icon="schedule"
        label="Time Saved Weekly"
        value={`${stats.weeklyHoursSaved} hrs`}
        tone="bg-accent-light text-accent-dark"
      />
      <StatCard
        icon="check_circle"
        label="Automation Success Rate"
        value={`${stats.successRate.toFixed(1)}%`}
        tone="bg-success-light text-success"
      />
    </div>
  );
}

function AutomationEmptyState({
  onCreate,
}: {
  onCreate: (template?: (typeof AUTOMATION_TEMPLATES)[number]) => void;
}) {
  return (
    <SectionCard>
      <EmptyState
        icon={<span className="material-symbols-outlined text-[36px]">auto_mode</span>}
        title="No automations yet"
        description="Streamline sales work with rule-based triggers, tasks, reminders, notifications, and audit-visible execution history."
        action={
          <button
            onClick={() => onCreate()}
            className="rounded-lg bg-cta px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-sm)] hover:bg-cta-hover"
          >
            Create your first automation
          </button>
        }
      />
      <div className="mt-8 border-t border-border pt-6">
        <h3 className="mb-3 text-[16px] font-semibold">Try a template</h3>
        <div className="grid gap-3 md:grid-cols-3">
          {AUTOMATION_TEMPLATES.map((template) => (
            <button
              key={template.id}
              onClick={() => onCreate(template)}
              className="flex items-start gap-3 rounded-lg border border-border bg-muted p-4 text-left transition-colors hover:border-primary hover:bg-primary-light"
            >
              <span className="material-symbols-outlined rounded-lg bg-card p-2 text-primary">
                {template.icon}
              </span>
              <span>
                <span className="block text-sm font-semibold text-foreground">{template.name}</span>
                <span className="block text-xs text-text-secondary">{template.description}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}

function AutomationErrorState({ onBack }: { onBack: () => void }) {
  return (
    <SectionCard title="Rule Builder">
      <div className="mb-6 flex items-start gap-3 rounded-lg border border-danger/20 bg-danger-light p-4 text-danger">
        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
          error
        </span>
        <div>
          <p className="font-semibold">Validation Failure</p>
          <p className="text-sm">
            The automation requires at least one executable action and a valid trigger event.
          </p>
        </div>
      </div>
      <div className="space-y-4 opacity-60">
        <div className="rounded-lg border border-border bg-muted p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-text-muted">Trigger</p>
          <div className="rounded border border-border bg-card px-3 py-2 text-sm">
            When Lead Status is updated...
          </div>
        </div>
        <div className="relative rounded-lg border border-danger/40 bg-muted p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-danger">
            Action (Invalid)
          </p>
          <div className="rounded border border-danger/30 bg-card px-3 py-2 text-sm text-danger">
            No action selected
          </div>
        </div>
      </div>
      <button
        onClick={onBack}
        className="mt-6 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
      >
        Return to builder
      </button>
    </SectionCard>
  );
}

function DeleteAutomationDialog({
  rule,
  onCancel,
  onConfirm,
}: {
  rule: AutomationRule | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!rule) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-lg)]">
        <div className="space-y-4 p-6">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined flex h-12 w-12 items-center justify-center rounded-full bg-danger-light text-danger">
              delete_forever
            </span>
            <h3 className="text-[20px] font-semibold">Delete Automation?</h3>
          </div>
          <p className="text-sm leading-6 text-text-secondary">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-foreground">"{rule.name}"</span>? This will halt
            scheduled tasks associated with the automation.
          </p>
        </div>
        <div className="flex flex-col-reverse gap-3 border-t border-border bg-muted p-4 sm:flex-row sm:justify-end">
          <button
            onClick={onCancel}
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white"
          >
            Delete Rule
          </button>
        </div>
      </div>
    </div>
  );
}

function BuilderBlock({
  icon,
  tone,
  label,
  tag,
  highlight,
  children,
}: {
  icon: string;
  tone: string;
  label: string;
  tag: string;
  highlight?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-xs)]",
        highlight && "border-l-4 border-l-primary",
      )}
    >
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "material-symbols-outlined flex h-9 w-9 items-center justify-center rounded-lg",
              tone,
            )}
          >
            {icon}
          </span>
          <h3 className="text-[16px] font-semibold">{label}</h3>
          <Badge>{tag}</Badge>
        </div>
        <button className="rounded p-1 text-text-muted hover:bg-muted" title="Add block">
          <span className="material-symbols-outlined">add_circle</span>
        </button>
      </header>
      {children}
    </section>
  );
}

function InputControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
        {label}
      </span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="input" />
    </label>
  );
}

function SelectControl({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
        {label}
      </span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="input">
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function AutomationSwitch({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "relative inline-flex h-6 w-11 items-center",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      )}
    >
      <input
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        type="checkbox"
        className="peer sr-only"
      />
      <span className="absolute inset-0 rounded-full bg-border transition-colors peer-checked:bg-primary" />
      <span className="absolute left-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
    </label>
  );
}

function IconButton({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded text-text-secondary hover:bg-muted hover:text-primary",
        danger && "hover:bg-danger-light hover:text-danger",
      )}
    >
      <span className="material-symbols-outlined text-[19px]">{icon}</span>
    </button>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">
      {children}
    </span>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: string;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-xs)]">
      <span
        className={cn(
          "material-symbols-outlined flex h-12 w-12 items-center justify-center rounded-full",
          tone,
        )}
      >
        {icon}
      </span>
      <div>
        <p className="text-[20px] font-semibold text-foreground">{value}</p>
        <p className="text-xs font-semibold text-text-secondary">{label}</p>
      </div>
    </div>
  );
}

function DefinitionNode({
  icon,
  label,
  title,
  detail,
  tone,
}: {
  icon: string;
  label: string;
  title: string;
  detail: string;
  tone: "primary" | "warning" | "success";
}) {
  const tones = {
    primary: "bg-primary-light text-primary border-primary/20",
    warning: "bg-warning-light text-warning border-warning/20",
    success: "bg-success-light text-success border-success/20",
  };
  return (
    <div className={cn("flex items-start gap-4 rounded-lg border p-4", tones[tone])}>
      <span className="material-symbols-outlined flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card">
        {icon}
      </span>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider">{label}</p>
        <p className="mt-1 text-[16px] font-semibold text-foreground">{title}</p>
        <p className="text-sm text-text-secondary">{detail}</p>
      </div>
    </div>
  );
}

function Connector() {
  return <div className="mx-auto h-8 w-0.5 bg-border" />;
}

function ResultBadge({ result }: { result: AutomationRun["result"] }) {
  const styles = {
    success: "bg-success-light text-success",
    failed: "bg-danger-light text-danger",
    skipped: "bg-warning-light text-warning",
  };
  const icons = { success: "check_circle", failed: "error", skipped: "pause_circle" };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        styles[result],
      )}
    >
      <span className="material-symbols-outlined text-[14px]">{icons[result]}</span>
      {capitalize(result)}
    </span>
  );
}

function buildBlankRule(): AutomationRule {
  return {
    id: `custom-${Date.now()}`,
    name: "Untitled Automation",
    description: "Describe what this automation does.",
    triggerType: "deal_stage",
    triggerLabel: "Deal Stage",
    triggerIcon: "handshake",
    object: "Deal",
    condition: "Deal stage changes to Demo/Proposal",
    actions: [
      {
        type: "task",
        label: "Create task: Send proposal",
        detail: "Assign to record owner",
        dueOffset: "+1d",
      },
    ],
    status: "draft",
    isDefault: false,
    owner: "Admin",
    runs: 0,
    successRate: 0,
    lastRunAt: null,
    lastEditedAt: new Date().toISOString(),
    auditLogged: true,
  };
}

function viewIcon(view: ViewMode) {
  return {
    list: "table_rows",
    builder: "account_tree",
    detail: "rule",
    empty: "inbox",
    error: "error",
  }[view];
}

function actionIcon(type: AutomationRule["actions"][number]["type"]) {
  return {
    task: "task_alt",
    notification: "notifications_active",
    email: "mail",
    field_update: "edit_note",
    digest: "summarize",
  }[type];
}

function triggerDefaults(
  label: string,
): Pick<AutomationRule, "triggerLabel" | "triggerType" | "triggerIcon" | "object"> {
  const option = TRIGGER_OPTIONS.find((item) => item.label === label) ?? TRIGGER_OPTIONS[0];
  return {
    triggerLabel: option.label,
    triggerType: option.type,
    triggerIcon: option.icon,
    object: option.object,
  };
}

function relative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return `${minutes} mins ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hrs ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(iso),
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
