import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common";
import { PageHeader, SectionCard, ToolbarButton } from "@/components/layout";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useLossReasons } from "@/lib/leads-data";
import {
  useSettingsUsers,
  useAssignmentReps,
  useAuditLog,
  usePipelineStagesConfig,
  useUpdatePipelineStage,
  useCreateLossReason,
  useUpdateLossReason,
  useDeleteLossReason,
  useUpdateUserRole,
  useUpdateUserStatus,
  useDeleteUser,
  useInviteUser,
  useSaveAssignmentQueue,
  useAppSettings,
  useSaveAppSettings,
  type AuditLogEntry,
  type SettingsUser,
} from "@/lib/settings-data";
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

const AUTOMATION_ICON_BOX_CLASS =
  "material-symbols-outlined flex h-10 w-10 shrink-0 select-none items-center justify-center rounded-lg text-[20px] leading-none";
const AUTOMATION_ICON_GLYPH_BASE_CLASS =
  "material-symbols-outlined flex shrink-0 select-none items-center justify-center leading-none";
const AUTOMATION_ICON_GLYPH_CLASS =
  "material-symbols-outlined flex h-5 w-5 shrink-0 select-none items-center justify-center text-[18px] leading-none";
const AUTOMATION_CONTROL_CLASS = "h-10 rounded-lg px-3 py-0 text-sm leading-none";

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
  const { data: settings, isLoading, isError, error, refetch } = useAppSettings();
  const saveSettings = useSaveAppSettings();

  const [crmName, setCrmName] = useState("");
  const [currency, setCurrency] = useState("");
  const [timezone, setTimezone] = useState("");
  const [dateFormat, setDateFormat] = useState("");
  const [language, setLanguage] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  useEffect(() => {
    if (!settings) return;
    setCrmName(settings.crm_name);
    setCurrency(settings.default_currency);
    setTimezone(settings.timezone);
    setDateFormat(settings.date_format);
    setLanguage(settings.language);
    setLogoUrl(settings.logo_url ?? "");
  }, [settings]);

  async function handleSave() {
    try {
      await saveSettings.mutateAsync({
        crm_name: crmName,
        default_currency: currency,
        timezone,
        date_format: dateFormat,
        language,
        logo_url: logoUrl || null,
      });
      toast.success("General settings saved");
    } catch (err) {
      toast.error("Could not save settings", { description: (err as Error).message });
    }
  }

  if (isLoading) return <TableSkeleton rows={6} columns={2} />;
  if (isError)
    return (
      <ErrorState
        description={(error as Error)?.message ?? "Could not load settings"}
        onRetry={() => refetch()}
      />
    );

  return (
    <div className="space-y-6">
      <SectionCard
        title="Organization Identity"
        description="Workspace name and branding used across the CRM and automated email signatures."
        actions={<Badge>Enterprise Plan</Badge>}
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_180px]">
          <div className="space-y-4">
            <InputControl label="CRM Instance Name" value={crmName} onChange={setCrmName} />
            <p className="text-sm text-text-secondary">
              This name appears in browser titles, notifications, and system-generated messages.
            </p>
          </div>
          <div className="space-y-3">
            <InputControl label="Logo URL" value={logoUrl} onChange={setLogoUrl} />
            <div className="flex h-24 items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted text-center">
              {logoUrl ? (
                <img src={logoUrl} alt="CRM logo preview" className="max-h-16 max-w-full" />
              ) : (
                <span className="text-xs font-semibold text-text-secondary">No logo URL set</span>
              )}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Regional Preferences" description="Defaults follow the PRD: GHS first.">
        <div className="grid gap-4 md:grid-cols-2">
          <SelectControl
            label="Default Currency"
            value={currency}
            onChange={setCurrency}
            options={["GHS", "USD", "EUR", "GBP"]}
          />
          <SelectControl
            label="Timezone"
            value={timezone}
            onChange={setTimezone}
            options={["GMT", "UTC", "Africa/Accra"]}
          />
          <SelectControl
            label="Date Format"
            value={dateFormat}
            onChange={setDateFormat}
            options={["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]}
          />
          <SelectControl
            label="System Language"
            value={language}
            onChange={setLanguage}
            options={["English (United States)", "French", "Spanish"]}
          />
        </div>
        <div className="mt-4 flex justify-end border-t border-border pt-4">
          <button
            onClick={handleSave}
            disabled={saveSettings.isPending}
            className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {saveSettings.isPending ? "Saving…" : "Save General Settings"}
          </button>
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
  const { data: stages = [], isLoading, isError, error, refetch } = usePipelineStagesConfig();
  const updateStage = useUpdatePipelineStage();
  const [edits, setEdits] = useState<
    Record<string, { name?: string; color?: string; sla_days?: number }>
  >({});

  function patchEdit(id: string, patch: { name?: string; color?: string; sla_days?: number }) {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function saveAllStages() {
    const entries = Object.entries(edits);
    if (entries.length === 0) {
      toast.info("No changes to save");
      return;
    }
    try {
      await Promise.all(entries.map(([id, patch]) => updateStage.mutateAsync({ id, ...patch })));
      setEdits({});
      toast.success("Pipeline configuration saved");
    } catch (err) {
      toast.error("Could not save pipeline config", { description: (err as Error).message });
    }
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Sales Pipeline Configuration"
        description="Closed stages are locked; total stages cannot drop below three."
        actions={
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-primary hover:bg-primary-light">
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            Add Stage
          </button>
        }
        bodyClassName="p-0"
      >
        {isLoading ? (
          <TableSkeleton rows={7} columns={6} />
        ) : isError ? (
          <ErrorState
            description={(error as Error)?.message ?? "Could not load stages"}
            onRetry={() => refetch()}
          />
        ) : (
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
                {stages.map((stage, index) => (
                  <tr key={stage.id} className="hover:bg-muted/40">
                    <td className="px-5 py-4">
                      <span className="material-symbols-outlined text-text-muted">
                        drag_indicator
                      </span>
                      <span className="ml-2 text-sm font-semibold">{index + 1}</span>
                    </td>
                    <td className="px-5 py-4">
                      <input
                        defaultValue={stage.name}
                        disabled={stage.is_closed}
                        onBlur={(e) => {
                          if (e.target.value !== stage.name) {
                            patchEdit(stage.id, { name: e.target.value });
                          }
                        }}
                        className="w-full max-w-[260px] rounded-lg border border-transparent bg-transparent px-2 py-2 text-sm font-semibold outline-none focus:border-primary focus:bg-card disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </td>
                    <td className="px-5 py-4">
                      <input
                        defaultValue={stage.color}
                        disabled={stage.is_closed}
                        onBlur={(e) => {
                          if (e.target.value !== stage.color) {
                            patchEdit(stage.id, { color: e.target.value });
                          }
                        }}
                        className="h-8 w-12 rounded border border-border bg-card p-1 disabled:cursor-not-allowed disabled:opacity-60"
                        type="color"
                      />
                    </td>
                    <td className="px-5 py-4">
                      <input
                        defaultValue={stage.sla_days}
                        type="number"
                        min={1}
                        onBlur={(e) => {
                          const val = Number(e.target.value);
                          if (!isNaN(val) && val !== stage.sla_days) {
                            patchEdit(stage.id, { sla_days: val });
                          }
                        }}
                        className="h-10 w-16 rounded-lg border border-border bg-card text-center text-sm font-semibold"
                      />
                    </td>
                    <td className="px-5 py-4">
                      <AutomationSwitch checked={stage.is_closed} disabled onChange={() => {}} />
                    </td>
                    <td className="px-5 py-4">
                      <IconButton
                        icon={stage.is_closed ? "lock" : "delete"}
                        label={stage.is_closed ? "Locked default stage" : "Remove stage"}
                        danger={!stage.is_closed}
                        onClick={() => {}}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <footer className="flex justify-between items-center border-t border-border bg-muted px-5 py-4">
              <p className="text-sm text-text-secondary">
                {Object.keys(edits).length > 0
                  ? `${Object.keys(edits).length} unsaved change(s)`
                  : "No pending changes"}
              </p>
              <button
                onClick={saveAllStages}
                disabled={updateStage.isPending}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {updateStage.isPending ? "Saving…" : "Save Pipeline Config"}
              </button>
            </footer>
          </div>
        )}
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
  const [deleteTarget, setDeleteTarget] = useState<SettingsUser | null>(null);
  const { data: users = [], isLoading, isError, error, refetch } = useSettingsUsers();
  const updateRole = useUpdateUserRole();
  const updateStatus = useUpdateUserStatus();
  const deleteUser = useDeleteUser();

  const adminCount = users.filter((u) => u.role === "admin").length;
  const managerCount = users.filter((u) => u.role === "manager").length;
  const repCount = users.filter((u) => u.role === "rep").length;

  async function handleRoleChange(userId: string, role: "admin" | "manager" | "rep") {
    try {
      await updateRole.mutateAsync({ userId, role });
      toast.success("Role updated");
    } catch (err) {
      toast.error("Could not update role", {
        description: (err as Error).message,
      });
    }
  }

  async function handleStatusChange(userId: string, status: "active" | "inactive") {
    try {
      await updateStatus.mutateAsync({ userId, status });
      toast.success("User status updated");
    } catch (err) {
      toast.error("Could not update status", {
        description: (err as Error).message,
      });
    }
  }

  async function confirmDeleteUser() {
    if (!deleteTarget) return;
    try {
      await deleteUser.mutateAsync({ userId: deleteTarget.id });
      toast.success("User deleted");
      setDeleteTarget(null);
    } catch (err) {
      toast.error("Could not delete user", {
        description: (err as Error).message,
      });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-xs)] lg:flex-row lg:items-end">
        <div className="grid flex-1 gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px]">
          <label className="block space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              Search
            </span>
            <input className="input" placeholder="Filter by name..." />
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
              { label: "Invited", value: "invited" },
              { label: "Inactive", value: "inactive" },
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
        {isLoading ? (
          <TableSkeleton rows={3} columns={6} />
        ) : isError ? (
          <ErrorState
            description={(error as Error)?.message ?? "Could not load users"}
            onRetry={() => refetch()}
          />
        ) : users.length === 0 ? (
          <EmptyState
            icon={<span className="material-symbols-outlined text-[28px]">group</span>}
            title="No users found"
            description="Invite team members to get started."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead className="border-b border-border bg-muted">
                <tr>
                  {["User", "Role", "Status", "Last Login", "Actions"].map((heading) => (
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
                {users.map((user) => {
                  const statusTone: "success" | "warning" =
                    user.status === "active" ? "success" : "warning";
                  return (
                    <tr key={user.id} className="hover:bg-muted/40">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                            {user.initials}
                          </span>
                          <span className="font-semibold">{user.full_name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <select
                          className="input h-9 min-w-[150px]"
                          defaultValue={user.role}
                          onChange={async (e) => {
                            await handleRoleChange(
                              user.id,
                              e.target.value as "admin" | "manager" | "rep",
                            );
                          }}
                        >
                          <option value="admin">Admin</option>
                          <option value="manager">Sales Manager</option>
                          <option value="rep">Sales Rep</option>
                        </select>
                      </td>
                      <td className="px-5 py-4">
                        <StatusPill tone={statusTone}>{user.status}</StatusPill>
                      </td>
                      <td className="px-5 py-4 text-sm text-text-secondary">
                        {user.last_login_at
                          ? new Date(user.last_login_at).toLocaleDateString()
                          : "Never"}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <AutomationSwitch
                            checked={user.status === "active"}
                            onChange={(checked) =>
                              void handleStatusChange(user.id, checked ? "active" : "inactive")
                            }
                          />
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              className="flex h-8 w-8 items-center justify-center rounded text-text-secondary hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                              aria-label="User actions"
                            >
                              <span className="material-symbols-outlined text-[19px]">
                                more_vert
                              </span>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuLabel className="text-xs text-text-muted">
                                {user.full_name}
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel
                                inset
                                className="text-[11px] uppercase tracking-wider text-text-muted"
                              >
                                Change role
                              </DropdownMenuLabel>
                              <DropdownMenuItem
                                onSelect={() => void handleRoleChange(user.id, "admin")}
                              >
                                Set as Admin
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => void handleRoleChange(user.id, "manager")}
                              >
                                Set as Sales Manager
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => void handleRoleChange(user.id, "rep")}
                              >
                                Set as Sales Rep
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onSelect={() =>
                                  void handleStatusChange(
                                    user.id,
                                    user.status === "active" ? "inactive" : "active",
                                  )
                                }
                              >
                                {user.status === "active" ? "Deactivate user" : "Activate user"}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-danger focus:text-danger"
                                onSelect={() => setDeleteTarget(user)}
                              >
                                Delete user
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <div className="grid gap-4 md:grid-cols-3">
        <RoleOverview
          icon="admin_panel_settings"
          title="Administrators"
          users={`${adminCount} User${adminCount !== 1 ? "s" : ""}`}
        />
        <RoleOverview
          icon="groups"
          title="Sales Managers"
          users={`${managerCount} User${managerCount !== 1 ? "s" : ""}`}
        />
        <RoleOverview
          icon="person"
          title="Sales Reps"
          users={`${repCount} User${repCount !== 1 ? "s" : ""}`}
        />
      </div>

      {inviteOpen ? <InviteUserDialog onClose={() => setInviteOpen(false)} /> : null}
      {deleteTarget ? (
        <DeleteUserDialog
          user={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void confirmDeleteUser()}
        />
      ) : null}
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
          {(["list", "builder", "detail"] as ViewMode[]).map((item) => (
            <button
              key={item}
              onClick={() => setView(item)}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-lg px-3 text-[12px] font-semibold capitalize transition-colors",
                view === item
                  ? "bg-primary text-primary-foreground"
                  : "text-text-secondary hover:bg-muted",
              )}
            >
              <span className={AUTOMATION_ICON_GLYPH_CLASS}>{viewIcon(item)}</span>
              {item}
            </button>
          ))}
        </div>
        <div className="flex min-h-14 items-center rounded-xl border border-primary/20 bg-primary-light px-4 py-3 text-sm text-primary">
          <p>
            <span className="font-semibold">Audit:</span> automated actions are shown as{" "}
            <span className="font-semibold">System/Automation</span> in run history.
          </p>
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
  const { data: reps = [], isLoading } = useAssignmentReps();
  const { data: settings } = useAppSettings();
  const saveSettings = useSaveAppSettings();
  const saveQueue = useSaveAssignmentQueue();

  const [strategy, setStrategy] = useState<string>("manual");
  const [queue, setQueue] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (settings) setStrategy(settings.assignment_strategy);
  }, [settings]);

  useEffect(() => {
    setQueue(Object.fromEntries(reps.map((rep) => [rep.id, rep.active])));
  }, [reps]);

  const activeCount = reps.filter((r) => queue[r.id] ?? r.active).length;

  async function handleSaveStrategy() {
    try {
      await saveSettings.mutateAsync({ assignment_strategy: strategy });
      await saveQueue.mutateAsync(
        reps.map((rep, index) => ({
          user_id: rep.id,
          position: index + 1,
          active: queue[rep.id] ?? rep.active,
        })),
      );
      toast.success("Lead assignment logic saved");
    } catch (err) {
      toast.error("Could not save assignment logic", { description: (err as Error).message });
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
      <div className="space-y-4">
        <SectionCard
          title="Assignment Strategy"
          description="Incoming landing-page leads stay unassigned until an admin or sales manager assigns them."
        >
          <div className="space-y-3">
            <StrategyOption
              title="Manual Assignment"
              description="Admins and managers review the private queue, then assign each lead to a specific rep."
              active={strategy === "manual"}
              onClick={() => setStrategy("manual")}
            />
            <div className="rounded-lg border border-border bg-muted p-4 opacity-70">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Automated routing</p>
                  <p className="mt-1 text-sm text-text-secondary">
                    Rules-based distribution is disabled so reps only see assigned or self-created
                    leads.
                  </p>
                </div>
                <Badge>Disabled</Badge>
              </div>
            </div>
          </div>
        </SectionCard>
        <InfoPanel
          icon="info"
          title="Manual Queue"
          body="Unassigned landing-page leads are visible to admins and sales managers only."
        />
      </div>

      <SectionCard
        title="Assignment Queue"
        description="Use this list to review eligible reps and current assigned workload before assigning leads."
        bodyClassName="p-0"
        actions={
          <Badge>
            {activeCount} Active Rep{activeCount !== 1 ? "s" : ""}
          </Badge>
        }
      >
        {isLoading ? (
          <TableSkeleton rows={4} columns={4} />
        ) : reps.length === 0 ? (
          <EmptyState
            icon={<span className="material-symbols-outlined text-[28px]">group</span>}
            title="No reps found"
            description="Invite team members and assign the Sales Rep role to populate this queue."
          />
        ) : (
          <div className="divide-y divide-border">
            {reps.map((rep, index) => (
              <div
                key={rep.id}
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
                  <p className="text-sm text-text-secondary capitalize">{rep.role}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                    Open Leads
                  </p>
                  <p className="text-[16px] font-semibold text-primary">{rep.openLeads} Leads</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-text-muted">#{index + 1}</span>
                  <AutomationSwitch
                    checked={queue[rep.id] ?? rep.active}
                    onChange={(checked) => setQueue((prev) => ({ ...prev, [rep.id]: checked }))}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        <footer className="flex flex-col justify-between gap-3 border-t border-border bg-muted px-5 py-4 sm:flex-row sm:items-center">
          <button className="text-sm font-semibold text-text-secondary hover:text-primary">
            Reset Queue Order
          </button>
          <button
            onClick={handleSaveStrategy}
            disabled={saveSettings.isPending || saveQueue.isPending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {saveSettings.isPending || saveQueue.isPending ? "Saving…" : "Save Assignment Logic"}
          </button>
        </footer>
      </SectionCard>
    </div>
  );
}

function EmailNotificationsPanel() {
  const { data: settings } = useAppSettings();
  const saveSettings = useSaveAppSettings();
  const [showKey, setShowKey] = useState(false);
  const [provider, setProvider] = useState("Resend");
  const [apiKeyMasked, setApiKeyMasked] = useState("re_xxxxxxxxxxxxxxxxxxxx");
  const [fromName, setFromName] = useState("Tally CRM Sales");
  const [fromEmail, setFromEmail] = useState("sales@tallycrm.io");
  const [notifs, setNotifs] = useState({
    newLeadEmail: true,
    newLeadApp: true,
    dealStageEmail: true,
    dealStageApp: true,
    slaEmail: true,
    slaApp: true,
    digestEmail: true,
    digestApp: false,
  });

  useEffect(() => {
    if (!settings) return;
    setProvider(settings.email_provider);
    setApiKeyMasked(settings.email_api_key_masked);
    setFromName(settings.from_name);
    setFromEmail(settings.from_email);
    setNotifs({
      newLeadEmail: settings.notif_new_lead_email,
      newLeadApp: settings.notif_new_lead_app,
      dealStageEmail: settings.notif_deal_stage_email,
      dealStageApp: settings.notif_deal_stage_app,
      slaEmail: settings.notif_sla_email,
      slaApp: settings.notif_sla_app,
      digestEmail: settings.notif_digest_email,
      digestApp: settings.notif_digest_app,
    });
  }, [settings]);

  async function saveProvider() {
    try {
      await saveSettings.mutateAsync({
        email_provider: provider,
        email_api_key_masked: apiKeyMasked,
        from_name: fromName,
        from_email: fromEmail,
      });
      toast.success("Provider settings saved");
    } catch (err) {
      toast.error("Could not save provider settings", { description: (err as Error).message });
    }
  }

  async function saveNotifToggle(patch: Partial<typeof notifs>) {
    const next = { ...notifs, ...patch };
    setNotifs(next);
    try {
      await saveSettings.mutateAsync({
        notif_new_lead_email: next.newLeadEmail,
        notif_new_lead_app: next.newLeadApp,
        notif_deal_stage_email: next.dealStageEmail,
        notif_deal_stage_app: next.dealStageApp,
        notif_sla_email: next.slaEmail,
        notif_sla_app: next.slaApp,
        notif_digest_email: next.digestEmail,
        notif_digest_app: next.digestApp,
      });
      toast.success("Notification settings saved");
    } catch (err) {
      toast.error("Could not save notification settings", { description: (err as Error).message });
    }
  }

  const matrixRows: Array<{
    label: string;
    detail: string;
    emailKey: keyof typeof notifs;
    appKey: keyof typeof notifs;
  }> = [
    {
      label: "New Lead Assigned",
      detail: "When a lead is assigned by an admin or sales manager.",
      emailKey: "newLeadEmail",
      appKey: "newLeadApp",
    },
    {
      label: "Deal Stage Change",
      detail: "When a deal progresses or stalls.",
      emailKey: "dealStageEmail",
      appKey: "dealStageApp",
    },
    {
      label: "SLA Breach Escalation",
      detail: "When a lead or deal breaches its stage SLA.",
      emailKey: "slaEmail",
      appKey: "slaApp",
    },
    {
      label: "Daily Digest",
      detail: "Morning task, overdue, and new-lead summary.",
      emailKey: "digestEmail",
      appKey: "digestApp",
    },
  ];

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
              value={provider}
              onChange={setProvider}
              options={["Resend", "SendGrid", "SMTP"]}
            />
            <label className="block space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                API Key
              </span>
              <div className="relative">
                <input
                  value={apiKeyMasked}
                  onChange={(e) => setApiKeyMasked(e.target.value)}
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
              <InputControl label="From Name" value={fromName} onChange={setFromName} />
              <InputControl label="From Email" value={fromEmail} onChange={setFromEmail} />
            </div>
            <div className="flex gap-2 border-t border-border pt-4">
              <button
                onClick={saveProvider}
                disabled={saveSettings.isPending}
                className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saveSettings.isPending ? "Saving…" : "Save Provider Settings"}
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
          {matrixRows.map((row) => (
            <div
              key={row.label}
              className="grid gap-4 px-5 py-4 transition-colors hover:bg-muted/50 md:grid-cols-[minmax(0,1fr)_160px]"
            >
              <div>
                <p className="font-semibold">{row.label}</p>
                <p className="text-sm text-text-secondary">{row.detail}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <ToggleWithLabel
                  label="Email"
                  checked={notifs[row.emailKey]}
                  onChange={(val) => saveNotifToggle({ [row.emailKey]: val })}
                />
                <ToggleWithLabel
                  label="In-App"
                  checked={notifs[row.appKey]}
                  onChange={(val) => saveNotifToggle({ [row.appKey]: val })}
                />
              </div>
            </div>
          ))}
        </div>
        <footer className="flex items-center justify-between border-t border-border bg-muted px-5 py-4">
          <p className="text-sm text-text-secondary">Notification toggles save immediately.</p>
          <button
            onClick={() =>
              saveNotifToggle({
                newLeadEmail: true,
                newLeadApp: true,
                dealStageEmail: true,
                dealStageApp: true,
                slaEmail: true,
                slaApp: true,
                digestEmail: true,
                digestApp: false,
              })
            }
            className="text-sm font-semibold text-danger hover:underline"
          >
            Reset to Default
          </button>
        </footer>
      </SectionCard>
    </div>
  );
}

function LossReasonsPanel() {
  const { data: reasons = [], isLoading, isError, error, refetch } = useLossReasons();
  const createReason = useCreateLossReason();
  const updateReason = useUpdateLossReason();
  const deleteReason = useDeleteLossReason();

  async function handleCreate() {
    try {
      await createReason.mutateAsync("New reason");
      toast.success("Loss reason added");
    } catch (err) {
      toast.error("Could not add reason", { description: (err as Error).message });
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteReason.mutateAsync(id);
      toast.success("Loss reason deleted");
    } catch (err) {
      toast.error("Could not delete reason", { description: (err as Error).message });
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <SectionCard
        title="Loss Reasons"
        description="Closed-Lost deals require a reason so win/loss reporting stays consistent."
        actions={
          <button
            onClick={handleCreate}
            disabled={createReason.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-primary hover:bg-primary-light disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            Add Reason
          </button>
        }
      >
        {isLoading ? (
          <TableSkeleton rows={6} columns={2} />
        ) : isError ? (
          <ErrorState
            description={(error as Error)?.message ?? "Could not load loss reasons"}
            onRetry={() => refetch()}
          />
        ) : (
          <div className="space-y-3">
            {reasons.map((reason, index) => (
              <div
                key={reason.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-[var(--shadow-xs)] hover:border-primary/40"
              >
                <span className="material-symbols-outlined text-text-muted">drag_indicator</span>
                <input
                  defaultValue={reason.label}
                  onBlur={(e) => {
                    if (e.target.value !== reason.label) {
                      updateReason
                        .mutateAsync({ id: reason.id, label: e.target.value })
                        .then(() => toast.success("Loss reason saved"))
                        .catch((err) =>
                          toast.error("Could not save", { description: (err as Error).message }),
                        );
                    }
                  }}
                  className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-medium outline-none focus:ring-0"
                />
                {index === 0 ? <Badge>System</Badge> : null}
                <IconButton
                  icon="delete"
                  label="Delete reason"
                  danger
                  onClick={() => handleDelete(reason.id)}
                />
              </div>
            ))}
          </div>
        )}
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
  const [entity, setEntity] = useState("All Entities");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({
    entity: "All Entities",
    startDate: "",
    endDate: "",
  });
  const { data: rows = [], isLoading, isError, error, refetch } = useAuditLog(50, appliedFilters);

  function exportCsv() {
    const headers = ["Actor", "Action", "Entity", "Entity Name", "Timestamp", "IP Address"];
    const csvRows = rows.map((row) =>
      [row.actor, row.action, row.entity, row.entity_name ?? "", row.created_at, row.ip ?? ""]
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(","),
    );
    const blob = new Blob([[headers.join(","), ...csvRows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Audit log exported");
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
      <SectionCard title="Filter Panel" description="Filter admin and automated system events.">
        <div className="space-y-4">
          <SelectControl
            label="Entity Type"
            value={entity}
            onChange={setEntity}
            options={["All Entities", "Lead", "Deal", "Task", "Contact", "Company"]}
          />
          <InputControl label="Start Date" value={startDate} onChange={setStartDate} />
          <InputControl label="End Date" value={endDate} onChange={setEndDate} />
          <button
            onClick={() => setAppliedFilters({ entity, startDate, endDate })}
            className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
          >
            Apply Filters
          </button>
        </div>
      </SectionCard>

      <SectionCard
        title="Audit Log"
        description="Actor, action, entity, timestamp, and IP address."
        actions={
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export CSV
          </button>
        }
        bodyClassName="p-0"
      >
        {isLoading ? (
          <TableSkeleton rows={6} columns={6} />
        ) : isError ? (
          <ErrorState
            description={(error as Error)?.message ?? "Could not load audit log"}
            onRetry={() => refetch()}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<span className="material-symbols-outlined text-[28px]">history_edu</span>}
            title="No audit entries"
            description="System and user actions will be logged here as they occur."
          />
        ) : (
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
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/40">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-light text-xs font-bold text-primary">
                          {row.initials}
                        </span>
                        <span className="block text-sm font-semibold">{row.actor}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <StatusPill tone={row.tone === "danger" ? "warning" : row.tone}>
                        {row.action}
                      </StatusPill>
                    </td>
                    <td className="px-5 py-4 text-sm">{row.entity}</td>
                    <td className="px-5 py-4 text-sm font-semibold">{row.entity_name ?? "—"}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm text-text-secondary">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="px-5 py-4 font-mono text-sm text-text-secondary">
                      {row.ip ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function LandingIntegrationPanel() {
  const { data: settings } = useAppSettings();
  const saveSettings = useSaveAppSettings();
  const endpoint = "POST {APP_URL}/api/public/leads-capture";
  const [apiKey, setApiKey] = useState("sb_publishable_xxxxxxxxxxxxxxxxxxxx");
  const [responseLog, setResponseLog] = useState<Array<{ status: string; detail: string }>>([]);

  useEffect(() => {
    if (!settings) return;
    setApiKey(settings.landing_api_key);
    setResponseLog(
      Array.isArray(settings.landing_response_log)
        ? (settings.landing_response_log as Array<{ status: string; detail: string }>)
        : [],
    );
  }, [settings]);

  async function regenerateKey() {
    const next = `sb_publishable_${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}`;
    try {
      await saveSettings.mutateAsync({ landing_api_key: next });
      setApiKey(next);
      toast.success("Landing page API key regenerated");
    } catch (err) {
      toast.error("Could not regenerate key", { description: (err as Error).message });
    }
  }

  async function sendTestLead() {
    try {
      const res = await fetch("/api/public/leads-capture", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          first_name: "Ama",
          last_name: "Mensah",
          email: `landing-test-${Date.now()}@example.com`,
          phone: "+233 555 0101",
          company_name: "Accra Retail Ltd",
          message: "Interested in TallyPrime",
          website: "",
        }),
      });
      const entry = {
        status: `${res.status} ${res.ok ? "OK" : "Error"}`,
        detail: res.ok
          ? "Lead inserted with source Tally Landing Page"
          : "Lead capture endpoint rejected the test payload",
      };
      if (!res.ok) throw new Error(entry.status);

      const nextLog = [entry, ...responseLog].slice(0, 5);
      await saveSettings.mutateAsync({
        landing_last_test_at: new Date().toISOString(),
        landing_last_test_status: entry.status,
        landing_response_log: nextLog,
      });
      setResponseLog(nextLog);
      toast.success("Test lead sent", { description: `Response: ${entry.status}` });
    } catch (err) {
      toast.error("Could not send test lead", { description: (err as Error).message });
    }
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Landing Page Integration"
        description="Public landing page remains write-only; CRM reads are never exposed to the browser."
        actions={<Badge>{settings?.landing_last_test_status ?? "Not tested"}</Badge>}
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="space-y-4">
            <CopyField label="Edge Function Endpoint" value={endpoint} />
            <CopyField label="Publishable API Key" value={apiKey} />
            <button
              onClick={regenerateKey}
              disabled={saveSettings.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">key</span>
              Regenerate API Key
            </button>
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
              onClick={sendTestLead}
              disabled={saveSettings.isPending}
              className="mt-2 w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
            >
              {saveSettings.isPending ? "Sending…" : "Send Test Lead"}
            </button>
            {settings?.landing_last_test_at ? (
              <p className="text-xs text-text-secondary">
                Last test: {new Date(settings.landing_last_test_at).toLocaleString()}
              </p>
            ) : null}
          </div>
        </div>
      </SectionCard>
      <SectionCard title="Live Response Log" description="Recent endpoint health checks.">
        <div className="space-y-3 text-sm">
          {responseLog.length === 0 ? (
            <LogLine status="Pending" detail="No test responses recorded yet" muted />
          ) : (
            responseLog.map((line, index) => (
              <LogLine
                key={`${line.status}-${index}`}
                status={line.status}
                detail={line.detail}
                muted={!line.status.startsWith("200")}
              />
            ))
          )}
        </div>
      </SectionCard>
    </div>
  );
}

function StrategyOption({
  title,
  description,
  active,
  onClick,
}: {
  title: string;
  description: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <label
      onClick={onClick}
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

function ToggleWithLabel({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs font-semibold text-text-secondary">
      {label}
      <AutomationSwitch checked={checked} onChange={onChange ?? (() => {})} />
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
  const inviteUser = useInviteUser();
  const [email, setEmail] = useState("new.user@tallycrm.com");
  const [role, setRole] = useState<"admin" | "manager" | "rep">("rep");
  const [deliveryMode, setDeliveryMode] = useState<"invite_link" | "temporary_password">(
    "invite_link",
  );

  async function handleInvite() {
    try {
      await inviteUser.mutateAsync({
        email,
        role,
        deliveryMode,
        redirectTo:
          typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined,
      });
      toast.success("Invitation sent", {
        description:
          deliveryMode === "invite_link"
            ? "The user can set their own password from the email invite."
            : "A temporary password was emailed to the user.",
      });
      onClose();
    } catch (err) {
      toast.error("Could not send invitation", { description: (err as Error).message });
    }
  }

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
          <InputControl label="Email Address" value={email} onChange={setEmail} />
          <SelectControl
            label="Role"
            value={role}
            onChange={(value) => setRole(value as "admin" | "manager" | "rep")}
            options={["admin", "manager", "rep"]}
          />
          <label className="block space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              Password Delivery
            </span>
            <select
              value={deliveryMode}
              onChange={(e) =>
                setDeliveryMode(e.target.value as "invite_link" | "temporary_password")
              }
              className="input"
            >
              <option value="invite_link">Invite link (set password)</option>
              <option value="temporary_password">Temporary password</option>
            </select>
          </label>
          <div className="rounded-lg border border-warning/20 bg-warning-light p-3 text-sm text-warning">
            Invite links let the user set their own password. Temporary passwords are emailed
            directly and should be changed after first sign-in.
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
            onClick={handleInvite}
            disabled={inviteUser.isPending}
            className="rounded-lg bg-cta px-4 py-2 text-sm font-semibold text-white hover:bg-cta-hover"
          >
            {inviteUser.isPending ? "Sending…" : "Send Invite"}
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
    <div className="mb-6 flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-xs)] xl:flex-row xl:items-end">
      <label className="block min-w-[260px] flex-1 space-y-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          Search
        </span>
        <div className="relative">
          <span
            className={cn(
              AUTOMATION_ICON_GLYPH_CLASS,
              "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted",
            )}
          >
            search
          </span>
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className={cn("input", AUTOMATION_CONTROL_CLASS, "pl-10")}
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
    <label className="block min-w-[170px] space-y-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn("input", AUTOMATION_CONTROL_CLASS)}
      >
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
                    <span className="inline-flex min-h-6 items-center gap-2 text-[15px] font-semibold leading-6 text-foreground">
                      {rule.name}
                      {rule.isDefault ? <Badge>Default</Badge> : null}
                    </span>
                    <span className="mt-1 block text-xs text-text-muted">
                      Managed by {rule.owner}
                    </span>
                  </button>
                </td>
                <td className="px-5 py-4">
                  <span className="inline-flex h-7 items-center gap-2 rounded-full bg-secondary px-3 text-xs font-semibold text-primary">
                    <span className={cn(AUTOMATION_ICON_GLYPH_BASE_CLASS, "h-4 w-4 text-[15px]")}>
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
                  <div className="flex items-center justify-end gap-2 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100">
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
          "flex items-start gap-4 rounded-xl border border-primary/20 bg-primary-light p-4 transition-transform",
          pulse && "scale-[1.01]",
        )}
      >
        <span className={cn(AUTOMATION_ICON_BOX_CLASS, "bg-primary text-white")}>bolt</span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
            Live Summary
          </p>
          <p className="break-words text-[15px] font-medium leading-6 text-foreground">{summary}</p>
        </div>
      </section>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
        <div className="space-y-5">
          <BuilderBlock icon="play_arrow" tone="bg-primary text-white" label="WHEN" tag="Trigger">
            <div className="grid min-w-0 gap-4 md:grid-cols-2 2xl:grid-cols-3">
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
            <div className="rounded-lg border border-border bg-muted p-4">
              <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_152px_minmax(0,1fr)_auto] xl:items-end">
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
                <button className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-primary transition-colors hover:bg-primary-light">
                  <span className={AUTOMATION_ICON_GLYPH_CLASS}>add</span>
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
                  className="grid min-w-0 gap-4 rounded-lg border border-border bg-muted p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end"
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
                    className="flex h-10 w-full shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-danger-light hover:text-danger md:w-10"
                    title="Remove action"
                  >
                    <span className={AUTOMATION_ICON_GLYPH_CLASS}>delete</span>
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
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold text-primary hover:bg-primary-light"
              >
                <span className={AUTOMATION_ICON_GLYPH_CLASS}>add</span>
                Add action
              </button>
            </div>
          </BuilderBlock>
        </div>

        <SectionCard
          className="xl:sticky xl:top-24 xl:self-start"
          title="Rule Settings"
          description="Name, state, and audit behavior."
        >
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
                className="min-h-28 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm leading-6 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
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

      <footer className="sticky bottom-3 z-20 flex flex-col justify-between gap-3 rounded-xl border border-border bg-card/95 p-4 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:flex-row sm:items-center">
        <div className="grid gap-2 sm:flex">
          <button
            onClick={onCancel}
            className="h-10 rounded-lg border border-border px-4 text-sm font-semibold hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={onSaveDraft}
            className="h-10 rounded-lg border border-border px-4 text-sm font-semibold hover:bg-muted"
          >
            Save as Draft
          </button>
        </div>
        <button
          onClick={onActivate}
          className="h-10 rounded-lg bg-primary px-5 text-sm font-semibold text-white shadow-[var(--shadow-sm)] hover:bg-primary-dark"
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
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-[28px] font-semibold tracking-tight text-primary">{rule.name}</h2>
            <Badge>{rule.object} Automation</Badge>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-text-secondary">{rule.description}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span
            className={cn(
              "inline-flex h-8 items-center gap-2 rounded-full px-3 text-xs font-semibold",
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
                    icon={
                      <span className={cn(AUTOMATION_ICON_GLYPH_BASE_CLASS, "h-7 w-7 text-[28px]")}>
                        history
                      </span>
                    }
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
        icon={
          <span className={cn(AUTOMATION_ICON_GLYPH_BASE_CLASS, "h-9 w-9 text-[32px]")}>
            auto_mode
          </span>
        }
        title="No automations yet"
        description="Streamline sales work with rule-based triggers, tasks, reminders, notifications, and audit-visible execution history."
        action={
          <button
            onClick={() => onCreate()}
            className="h-10 rounded-lg bg-cta px-5 text-sm font-semibold text-white shadow-[var(--shadow-sm)] hover:bg-cta-hover"
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
              className="flex min-h-24 items-start gap-4 rounded-lg border border-border bg-muted p-4 text-left transition-colors hover:border-primary hover:bg-primary-light"
            >
              <span className={cn(AUTOMATION_ICON_BOX_CLASS, "bg-card text-primary")}>
                {template.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-5 text-foreground">
                  {template.name}
                </span>
                <span className="mt-1 block text-xs leading-5 text-text-secondary">
                  {template.description}
                </span>
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
        <span className={AUTOMATION_ICON_GLYPH_CLASS} style={{ fontVariationSettings: "'FILL' 1" }}>
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
        className="mt-6 h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-white"
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
            <span className={cn(AUTOMATION_ICON_BOX_CLASS, "bg-danger-light text-danger")}>
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
            className="h-10 rounded-lg border border-border bg-card px-4 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="h-10 rounded-lg bg-danger px-4 text-sm font-semibold text-white"
          >
            Delete Rule
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteUserDialog({
  user,
  onCancel,
  onConfirm,
}: {
  user: SettingsUser | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!user) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-lg)]">
        <div className="space-y-4 p-6">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined flex h-12 w-12 items-center justify-center rounded-full bg-danger-light text-danger">
              person_remove
            </span>
            <h3 className="text-[20px] font-semibold">Delete User?</h3>
          </div>
          <p className="text-sm leading-6 text-text-secondary">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-foreground">"{user.full_name}"</span>? This will
            remove their account access and role assignment.
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
            Delete User
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
        "min-w-0 rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-xs)]",
        highlight && "border-l-4 border-l-primary",
      )}
    >
      <header className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <span className={cn(AUTOMATION_ICON_BOX_CLASS, tone)}>{icon}</span>
          <h3 className="text-[16px] font-semibold leading-6">{label}</h3>
          <Badge>{tag}</Badge>
        </div>
        <button
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-muted hover:text-primary"
          title="Add block"
        >
          <span className={AUTOMATION_ICON_GLYPH_CLASS}>add_circle</span>
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
    <label className="block space-y-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn("input", AUTOMATION_CONTROL_CLASS)}
      />
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
    <label className="block space-y-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn("input", AUTOMATION_CONTROL_CLASS)}
      >
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
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-muted hover:text-primary",
        danger && "hover:bg-danger-light hover:text-danger",
      )}
    >
      <span className={AUTOMATION_ICON_GLYPH_CLASS}>{icon}</span>
    </button>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-6 items-center rounded bg-secondary px-2 text-[11px] font-semibold leading-none text-secondary-foreground">
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
    <div className="flex min-h-24 items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-xs)]">
      <span className={cn(AUTOMATION_ICON_BOX_CLASS, tone)}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[20px] font-semibold leading-7 text-foreground">{value}</p>
        <p className="text-xs font-semibold leading-5 text-text-secondary">{label}</p>
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
      <span className={cn(AUTOMATION_ICON_BOX_CLASS, "bg-card")}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider">{label}</p>
        <p className="mt-1 text-[16px] font-semibold leading-6 text-foreground">{title}</p>
        <p className="text-sm leading-6 text-text-secondary">{detail}</p>
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
        "inline-flex h-7 items-center gap-2 rounded-full px-2.5 text-xs font-semibold",
        styles[result],
      )}
    >
      <span className={cn(AUTOMATION_ICON_GLYPH_BASE_CLASS, "h-4 w-4 text-[14px]")}>
        {icons[result]}
      </span>
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
