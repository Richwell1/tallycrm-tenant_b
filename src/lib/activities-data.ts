import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ActivityRow = Database["public"]["Tables"]["activities"]["Row"];
export type ActivityInsert = Database["public"]["Tables"]["activities"]["Insert"];
export type ActivityUpdate = Database["public"]["Tables"]["activities"]["Update"];
export type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
export type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"];
export type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];
export type DealRow = Database["public"]["Tables"]["deals"]["Row"];
export type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type ActivityType = Database["public"]["Enums"]["activity_type"] | "task";
export type ActivityStatus = "pending" | "in_progress" | "completed";

export interface ActivityItem {
  id: string;
  source: "activity" | "task";
  title: string;
  type: ActivityType;
  due_at: string | null;
  duration_minutes: number | null;
  owner_id: string | null;
  created_at: string;
  notes: string | null;
  outcome: string | null;
  status: ActivityStatus;
  locked: boolean;
  contact?: ContactRow | null;
  deal?: DealRow | null;
  company?: CompanyRow | null;
  owner?: ProfileRow | null;
  raw: ActivityRow | TaskRow;
}

export interface CreateActivityInput {
  title: string;
  type: ActivityType;
  dueDate: string;
  dueTime: string;
  durationMinutes?: number | null;
  ownerId?: string | null;
  contactId?: string | null;
  dealId?: string | null;
  notes?: string | null;
  outcome?: string | null;
  reminder?: boolean;
}

export const activitiesKey = ["activities"] as const;

export function useActivities() {
  return useQuery({
    queryKey: activitiesKey,
    queryFn: async () => {
      const [activitiesRes, tasksRes, contactsRes, dealsRes, companiesRes, profilesRes] =
        await Promise.all([
          supabase.from("activities").select("*").order("created_at", { ascending: false }),
          supabase.from("tasks").select("*").order("created_at", { ascending: false }),
          supabase.from("contacts").select("*").is("deleted_at", null),
          supabase.from("deals").select("*").is("deleted_at", null),
          supabase.from("companies").select("*").is("deleted_at", null),
          supabase.from("profiles").select("*"),
        ]);

      if (activitiesRes.error) throw activitiesRes.error;
      if (tasksRes.error) throw tasksRes.error;
      if (contactsRes.error) throw contactsRes.error;
      if (dealsRes.error) throw dealsRes.error;
      if (companiesRes.error) throw companiesRes.error;
      if (profilesRes.error) throw profilesRes.error;

      const contacts = (contactsRes.data ?? []) as ContactRow[];
      const deals = (dealsRes.data ?? []) as DealRow[];
      const companies = (companiesRes.data ?? []) as CompanyRow[];
      const profiles = (profilesRes.data ?? []) as ProfileRow[];
      const activityItems = ((activitiesRes.data ?? []) as ActivityRow[]).map((activity) =>
        normalizeActivity(activity, contacts, deals, companies, profiles),
      );
      const taskItems = ((tasksRes.data ?? []) as TaskRow[]).map((task) =>
        normalizeTask(task, contacts, deals, companies, profiles),
      );

      return [...activityItems, ...taskItems].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    },
  });
}

export function useActivityFormOptions() {
  return useQuery({
    queryKey: ["activity_form_options"],
    queryFn: async () => {
      const [contactsRes, dealsRes, profilesRes] = await Promise.all([
        supabase.from("contacts").select("*").is("deleted_at", null).order("last_name"),
        supabase.from("deals").select("*").is("deleted_at", null).order("name"),
        supabase.from("profiles").select("*").eq("status", "active").order("full_name"),
      ]);
      if (contactsRes.error) throw contactsRes.error;
      if (dealsRes.error) throw dealsRes.error;
      if (profilesRes.error) throw profilesRes.error;
      return {
        contacts: (contactsRes.data ?? []) as ContactRow[],
        deals: (dealsRes.data ?? []) as DealRow[],
        profiles: (profilesRes.data ?? []) as ProfileRow[],
      };
    },
  });
}

export function useCreateActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateActivityInput) => {
      const dueAt = combineDateTime(input.dueDate, input.dueTime);
      const { data: userData } = await supabase.auth.getUser();
      const ownerId = input.ownerId || userData.user?.id || null;

      if (input.type === "task") {
        const { data, error } = await supabase
          .from("tasks")
          .insert({
            title: input.title,
            type: "manual",
            due_at: dueAt,
            reminder_at: input.reminder ? reminderBefore(dueAt) : null,
            assigned_to: ownerId,
            contact_id: input.contactId || null,
            deal_id: input.dealId || null,
            notes: input.notes || null,
            priority: "medium",
            status: "pending",
          } satisfies TaskInsert)
          .select("id")
          .single();
        if (error) throw error;
        return data;
      }

      const { data, error } = await supabase
        .from("activities")
        .insert({
          title: input.title,
          type: input.type,
          due_at: dueAt,
          duration_minutes: input.durationMinutes ?? null,
          owner_id: ownerId,
          contact_id: input.contactId || null,
          deal_id: input.dealId || null,
          notes: input.notes || null,
          outcome: input.outcome || null,
        } satisfies ActivityInsert)
        .select("id")
        .single();
      if (error) throw error;

      if (input.reminder) {
        await supabase.from("tasks").insert({
          title: `Reminder: ${input.title}`,
          type: "activity_reminder",
          due_at: dueAt,
          reminder_at: reminderBefore(dueAt),
          assigned_to: ownerId,
          contact_id: input.contactId || null,
          deal_id: input.dealId || null,
          notes: "Auto-created follow-up reminder for activity.",
          priority: "medium",
          status: "pending",
        } satisfies TaskInsert);
      }

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: activitiesKey });
      qc.invalidateQueries({ queryKey: ["deal"] });
      qc.invalidateQueries({ queryKey: ["contact"] });
    },
  });
}

export function useCompleteActivityItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ item, outcome }: { item: ActivityItem; outcome: string }) => {
      if (item.locked) throw new Error("This record is locked and can no longer be edited.");
      if (item.source === "activity" && !outcome.trim()) {
        throw new Error("Outcome is required before completing an activity.");
      }

      if (item.source === "task") {
        const { error } = await supabase
          .from("tasks")
          .update({
            status: "done",
            completed_at: new Date().toISOString(),
            notes: outcome,
          })
          .eq("id", item.id);
        if (error) throw error;
        return;
      }

      const { error } = await supabase
        .from("activities")
        .update({
          outcome,
          locked_at: new Date().toISOString(),
        } satisfies ActivityUpdate)
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: activitiesKey });
    },
  });
}

export function canEditActivity(item: ActivityItem) {
  if (item.locked) return false;
  const createdAt = new Date(item.created_at).getTime();
  return Date.now() - createdAt <= 15 * 60 * 1000;
}

function normalizeActivity(
  activity: ActivityRow,
  contacts: ContactRow[],
  deals: DealRow[],
  companies: CompanyRow[],
  profiles: ProfileRow[],
): ActivityItem {
  const deal = deals.find((item) => item.id === activity.deal_id) ?? null;
  const contact = contacts.find((item) => item.id === activity.contact_id) ?? null;
  const company =
    companies.find((item) => item.id === (contact?.company_id ?? deal?.company_id)) ?? null;
  const lockedByTime =
    !!activity.outcome && Date.now() - new Date(activity.created_at).getTime() > 15 * 60 * 1000;

  return {
    id: activity.id,
    source: "activity",
    title: activity.title,
    type: activity.type,
    due_at: activity.due_at,
    duration_minutes: activity.duration_minutes,
    owner_id: activity.owner_id,
    created_at: activity.created_at,
    notes: activity.notes,
    outcome: activity.outcome,
    status: activity.outcome ? "completed" : dueStatus(activity.due_at),
    locked: !!activity.locked_at || lockedByTime,
    contact,
    deal,
    company,
    owner: profiles.find((profile) => profile.id === activity.owner_id) ?? null,
    raw: activity,
  };
}

function normalizeTask(
  task: TaskRow,
  contacts: ContactRow[],
  deals: DealRow[],
  companies: CompanyRow[],
  profiles: ProfileRow[],
): ActivityItem {
  const deal = deals.find((item) => item.id === task.deal_id) ?? null;
  const contact = contacts.find((item) => item.id === task.contact_id) ?? null;
  const company =
    companies.find((item) => item.id === (contact?.company_id ?? deal?.company_id)) ?? null;

  return {
    id: task.id,
    source: "task",
    title: task.title,
    type: "task",
    due_at: task.due_at,
    duration_minutes: null,
    owner_id: task.assigned_to,
    created_at: task.created_at,
    notes: task.notes,
    outcome: task.completed_at ? task.notes : null,
    status:
      task.status === "done"
        ? "completed"
        : task.status === "in_progress"
          ? "in_progress"
          : "pending",
    locked:
      task.status === "done" &&
      Date.now() - new Date(task.completed_at ?? task.updated_at).getTime() > 15 * 60 * 1000,
    contact,
    deal,
    company,
    owner: profiles.find((profile) => profile.id === task.assigned_to) ?? null,
    raw: task,
  };
}

function dueStatus(dueAt: string | null): ActivityStatus {
  if (!dueAt) return "pending";
  const due = new Date(dueAt).getTime();
  const now = Date.now();
  if (due < now) return "in_progress";
  return "pending";
}

function combineDateTime(date: string, time: string) {
  const fallbackDate = new Date().toISOString().slice(0, 10);
  return new Date(`${date || fallbackDate}T${time || "09:00"}`).toISOString();
}

function reminderBefore(dueAt: string) {
  return new Date(new Date(dueAt).getTime() - 15 * 60 * 1000).toISOString();
}
