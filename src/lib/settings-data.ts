import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];
type UserStatus = Database["public"]["Enums"]["user_status"];

// ── App Settings (singleton row) ───────────────────────────────────────────────

export type AppSettings = Database["public"]["Tables"]["app_settings"]["Row"];

const SETTINGS_ROW_ID = "00000000-0000-0000-0000-000000000001";
const DEFAULT_APP_SETTINGS: AppSettings = {
  id: SETTINGS_ROW_ID,
  crm_name: "Tally CRM Sales",
  default_currency: "GHS",
  timezone: "GMT",
  date_format: "DD/MM/YYYY",
  language: "English (United States)",
  logo_url: null,
  email_provider: "Resend",
  from_name: "Tally CRM Sales",
  from_email: "sales@tallycrm.io",
  notif_new_lead_email: true,
  notif_new_lead_app: true,
  notif_deal_stage_email: true,
  notif_deal_stage_app: true,
  notif_sla_email: true,
  notif_sla_app: true,
  notif_digest_email: true,
  notif_digest_app: false,
  assignment_strategy: "round_robin",
  email_api_key_masked: "re_xxxxxxxxxxxxxxxxxxxx",
  landing_api_key: "sb_publishable_xxxxxxxxxxxxxxxxxxxx",
  landing_last_test_at: null,
  landing_last_test_status: null,
  landing_response_log: [],
  updated_at: new Date(0).toISOString(),
};

function normalizeAppSettings(row: Partial<AppSettings> | null | undefined): AppSettings {
  return { ...DEFAULT_APP_SETTINGS, ...(row ?? {}) };
}

function isMissingSettingsBackend(error: unknown) {
  const err = error as { code?: string; message?: string; status?: number } | null;
  const message = err?.message?.toLowerCase() ?? "";
  return (
    err?.status === 404 ||
    err?.code === "42P01" ||
    message.includes("app_settings") ||
    message.includes("failed to fetch")
  );
}

export function useAppSettings() {
  return useQuery({
    queryKey: ["app_settings"],
    retry: (failureCount, error) => !isMissingSettingsBackend(error) && failureCount < 2,
    queryFn: async (): Promise<AppSettings> => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .eq("id", SETTINGS_ROW_ID)
        .maybeSingle();
      if (error) {
        if (isMissingSettingsBackend(error)) return DEFAULT_APP_SETTINGS;
        throw error;
      }
      if (data) return normalizeAppSettings(data);

      const { data: created, error: createError } = await supabase
        .from("app_settings")
        .insert({ id: SETTINGS_ROW_ID })
        .select("*")
        .maybeSingle();
      if (createError) return DEFAULT_APP_SETTINGS;
      return normalizeAppSettings(created);
    },
  });
}

export function useSaveAppSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Omit<AppSettings, "id" | "updated_at">>) => {
      const { data, error } = await supabase
        .from("app_settings")
        .update(patch)
        .eq("id", SETTINGS_ROW_ID)
        .select("id")
        .maybeSingle();
      if (!error && data) return;
      if (error && isMissingSettingsBackend(error)) {
        throw new Error(
          "The app_settings table is missing in Supabase. Apply the settings migration before saving General settings.",
        );
      }

      const { error: insertError } = await supabase
        .from("app_settings")
        .insert({ id: SETTINGS_ROW_ID, ...patch });
      if (insertError && isMissingSettingsBackend(insertError)) {
        throw new Error(
          "The app_settings table is missing in Supabase. Apply the settings migration before saving General settings.",
        );
      }
      if (insertError) throw insertError;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["app_settings"] }),
  });
}

// ── User Role Update ───────────────────────────────────────────────────────────

export function useUpdateUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (auth.user?.id === userId) {
        throw new Error("Admins cannot change their own role.");
      }

      const { error } = await supabase.rpc("set_user_role", {
        target_user_id: userId,
        target_role: role,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings", "users"] }),
  });
}

export function useUpdateUserStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: UserStatus }) => {
      const { error } = await supabase.from("profiles").update({ status }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings", "users"] }),
  });
}

export function useInviteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, role }: { email: string; role: AppRole }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("user_invites").insert({
        email,
        role,
        invited_by: auth.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings", "users"] }),
  });
}

// ── Settings Users ─────────────────────────────────────────────────────────────

export interface SettingsUser {
  id: string;
  full_name: string;
  initials: string;
  avatar_url: string | null;
  status: UserStatus;
  last_login_at: string | null;
  role: AppRole;
}

function nameInitials(name: string | null | undefined): string {
  if (!name) return "??";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function useSettingsUsers() {
  return useQuery({
    queryKey: ["settings", "users"],
    queryFn: async (): Promise<SettingsUser[]> => {
      const [profilesRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, avatar_url, status, last_login_at"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;

      const roleMap = new Map((rolesRes.data ?? []).map((r) => [r.user_id, r.role as AppRole]));

      return (profilesRes.data ?? []).map((p) => ({
        id: p.id,
        full_name: p.full_name ?? "Unknown",
        initials: nameInitials(p.full_name),
        avatar_url: p.avatar_url,
        status: p.status,
        last_login_at: p.last_login_at,
        role: roleMap.get(p.id) ?? "rep",
      }));
    },
  });
}

// ── Assignment Reps (for Lead Assignment panel) ────────────────────────────────

export interface AssignmentRep {
  id: string;
  name: string;
  initials: string;
  avatar_url: string | null;
  role: AppRole;
  openLeads: number;
  active: boolean;
  position: number;
}

export function useAssignmentReps() {
  return useQuery({
    queryKey: ["settings", "assignment_reps"],
    queryFn: async (): Promise<AssignmentRep[]> => {
      const [rolesRes, leadsRes] = await Promise.all([
        supabase.from("user_roles").select("user_id, role").in("role", ["rep", "manager"]),
        supabase
          .from("leads")
          .select("assigned_to, status")
          .is("deleted_at", null)
          .not("status", "in", '("converted","disqualified")'),
      ]);
      if (rolesRes.error) throw rolesRes.error;
      if (leadsRes.error) throw leadsRes.error;

      const roles = rolesRes.data ?? [];
      if (roles.length === 0) return [];

      const userIds = roles.map((r) => r.user_id);
      const [profilesRes, queueRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, avatar_url, status").in("id", userIds),
        supabase
          .from("lead_assignment_queue")
          .select("user_id, position, active")
          .in("user_id", userIds),
      ]);
      const { data: profiles, error: profilesError } = profilesRes;
      if (profilesError) throw profilesError;
      if (queueRes.error) throw queueRes.error;

      const leads = leadsRes.data ?? [];
      const leadCountMap = new Map<string, number>();
      const queueMap = new Map((queueRes.data ?? []).map((q) => [q.user_id, q]));
      for (const lead of leads) {
        if (lead.assigned_to) {
          leadCountMap.set(lead.assigned_to, (leadCountMap.get(lead.assigned_to) ?? 0) + 1);
        }
      }

      return (profiles ?? [])
        .map((p, index) => {
          const queue = queueMap.get(p.id);
          return {
            id: p.id,
            name: p.full_name ?? "Unknown",
            initials: nameInitials(p.full_name),
            avatar_url: p.avatar_url,
            role: (roles.find((r) => r.user_id === p.id)?.role as AppRole) ?? "rep",
            openLeads: leadCountMap.get(p.id) ?? 0,
            active: queue?.active ?? p.status === "active",
            position: queue?.position ?? index + 1,
          };
        })
        .sort((a, b) => a.position - b.position);
    },
  });
}

export function useSaveAssignmentQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (queue: Array<{ user_id: string; position: number; active: boolean }>) => {
      const { error } = await supabase.from("lead_assignment_queue").upsert(queue, {
        onConflict: "user_id",
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings", "assignment_reps"] }),
  });
}

// ── Audit Log ──────────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  actor: string;
  initials: string;
  action: string;
  entity: string;
  entity_name: string | null;
  created_at: string;
  ip: string | null;
  tone: "success" | "warning" | "danger" | "primary";
}

function actionTone(action: string): AuditLogEntry["tone"] {
  const a = action.toLowerCase();
  if (a.includes("won") || a.includes("create") || a.includes("convert")) return "success";
  if (a.includes("delete") || a.includes("lost") || a.includes("remove")) return "danger";
  if (a.includes("update") || a.includes("change") || a.includes("escalat")) return "warning";
  return "primary";
}

export interface AuditLogFilters {
  entity?: string;
  startDate?: string;
  endDate?: string;
}

export function useAuditLog(limit = 50, filters: AuditLogFilters = {}) {
  return useQuery({
    queryKey: ["settings", "audit_log", limit, filters],
    queryFn: async (): Promise<AuditLogEntry[]> => {
      let query = supabase
        .from("audit_log")
        .select("id, actor_id, action, entity, entity_name, created_at, ip")
        .order("created_at", { ascending: false });

      if (filters.entity && filters.entity !== "All Entities") {
        query = query.eq("entity", filters.entity.toLowerCase());
      }
      if (filters.startDate) query = query.gte("created_at", filters.startDate);
      if (filters.endDate) query = query.lte("created_at", `${filters.endDate}T23:59:59`);

      const { data: logRows, error } = await query.limit(limit);
      if (error) throw error;

      const actorIds = [
        ...new Set((logRows ?? []).map((r) => r.actor_id).filter(Boolean) as string[]),
      ];

      let profileMap = new Map<string, string>();
      if (actorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", actorIds);
        profileMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? "Unknown"]));
      }

      return (logRows ?? []).map((row) => {
        const actorName = row.actor_id
          ? (profileMap.get(row.actor_id) ?? "System / Automation")
          : "System / Automation";
        return {
          id: row.id,
          actor: actorName,
          initials: nameInitials(actorName),
          action: row.action,
          entity: row.entity,
          entity_name: row.entity_name,
          created_at: row.created_at,
          ip: row.ip,
          tone: actionTone(row.action),
        };
      });
    },
  });
}

// ── Pipeline Stages (settings view, includes color + sla_days) ─────────────────

export interface PipelineStageConfig {
  id: string;
  name: string;
  color: string;
  sla_days: number;
  is_closed: boolean;
  is_won: boolean;
  position: number;
  default_probability: number;
}

export function usePipelineStagesConfig() {
  return useQuery({
    queryKey: ["pipeline_stages", "config"],
    queryFn: async (): Promise<PipelineStageConfig[]> => {
      const { data, error } = await supabase
        .from("pipeline_stages")
        .select("id, name, color, sla_days, is_closed, is_won, position, default_probability")
        .order("position");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useUpdatePipelineStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      name,
      color,
      sla_days,
    }: {
      id: string;
      name?: string;
      color?: string;
      sla_days?: number;
    }) => {
      const { error } = await supabase
        .from("pipeline_stages")
        .update({ name, color, sla_days, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipeline_stages"] });
    },
  });
}

// ── Loss Reason Mutations ──────────────────────────────────────────────────────

export function useUpdateLossReason() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, label }: { id: string; label: string }) => {
      const { error } = await supabase
        .from("loss_reasons")
        .update({ label, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["loss_reasons"] }),
  });
}

export function useCreateLossReason() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (label: string) => {
      const { data: existing } = await supabase
        .from("loss_reasons")
        .select("position")
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      const position = (existing?.position ?? 0) + 1;
      const { error } = await supabase.from("loss_reasons").insert({ label, position });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["loss_reasons"] }),
  });
}

export function useDeleteLossReason() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("loss_reasons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["loss_reasons"] }),
  });
}
