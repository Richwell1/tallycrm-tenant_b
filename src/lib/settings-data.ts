import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];
type UserStatus = Database["public"]["Enums"]["user_status"];

// ── App Settings (singleton row) ───────────────────────────────────────────────

export type AppSettings = Database["public"]["Tables"]["app_settings"]["Row"];

const SETTINGS_ROW_ID = "00000000-0000-0000-0000-000000000001";

export function useAppSettings() {
  return useQuery({
    queryKey: ["app_settings"],
    queryFn: async (): Promise<AppSettings> => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .eq("id", SETTINGS_ROW_ID)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function useSaveAppSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Omit<AppSettings, "id" | "updated_at">>) => {
      const { error } = await supabase.from("app_settings").update(patch).eq("id", SETTINGS_ROW_ID);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["app_settings"] }),
  });
}

// ── User Role Update ───────────────────────────────────────────────────────────

export function useUpdateUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase.from("user_roles").update({ role }).eq("user_id", userId);
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
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, status")
        .in("id", userIds);
      if (profilesError) throw profilesError;

      const leads = leadsRes.data ?? [];
      const leadCountMap = new Map<string, number>();
      for (const lead of leads) {
        if (lead.assigned_to) {
          leadCountMap.set(lead.assigned_to, (leadCountMap.get(lead.assigned_to) ?? 0) + 1);
        }
      }

      return (profiles ?? []).map((p) => ({
        id: p.id,
        name: p.full_name ?? "Unknown",
        initials: nameInitials(p.full_name),
        avatar_url: p.avatar_url,
        role: (roles.find((r) => r.user_id === p.id)?.role as AppRole) ?? "rep",
        openLeads: leadCountMap.get(p.id) ?? 0,
        active: p.status === "active",
      }));
    },
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

export function useAuditLog(limit = 50) {
  return useQuery({
    queryKey: ["settings", "audit_log", limit],
    queryFn: async (): Promise<AuditLogEntry[]> => {
      const { data: logRows, error } = await supabase
        .from("audit_log")
        .select("id, actor_id, action, entity, entity_name, created_at, ip")
        .order("created_at", { ascending: false })
        .limit(limit);
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
