import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
export type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"];
export type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"];
export type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];
export type DealRow = Database["public"]["Tables"]["deals"]["Row"];
export type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type TaskPriority = Database["public"]["Enums"]["task_priority"];
export type TaskStatus = Database["public"]["Enums"]["task_status"];
export type TaskType = "call" | "email" | "meeting" | "task";

export interface TaskItem {
  id: string;
  title: string;
  type: string | null;
  due_at: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  reminder_at: string | null;
  notes: string | null;
  assigned_to: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  locked: boolean;
  contact?: ContactRow | null;
  deal?: DealRow | null;
  company?: CompanyRow | null;
  owner?: ProfileRow | null;
  raw: TaskRow;
}

export interface TaskFormOptions {
  contacts: ContactRow[];
  deals: DealRow[];
  profiles: ProfileRow[];
}

export interface CreateTaskInput {
  title: string;
  type: TaskType;
  status: Exclude<TaskStatus, "done" | "cancelled">;
  priority: TaskPriority;
  dueDate: string;
  dueTime: string;
  ownerId?: string | null;
  contactId?: string | null;
  dealId?: string | null;
  notes?: string | null;
  reminder?: boolean;
}

export const tasksKey = ["tasks"] as const;

export function useTasks() {
  return useQuery({
    queryKey: tasksKey,
    queryFn: async () => {
      const [tasksRes, contactsRes, dealsRes, companiesRes, profilesRes] = await Promise.all([
        supabase.from("tasks").select("*").order("due_at", { ascending: true, nullsFirst: false }),
        supabase.from("contacts").select("*").is("deleted_at", null),
        supabase.from("deals").select("*").is("deleted_at", null),
        supabase.from("companies").select("*").is("deleted_at", null),
        supabase.from("profiles").select("*"),
      ]);

      if (tasksRes.error) throw tasksRes.error;
      if (contactsRes.error) throw contactsRes.error;
      if (dealsRes.error) throw dealsRes.error;
      if (companiesRes.error) throw companiesRes.error;
      if (profilesRes.error) throw profilesRes.error;

      const contacts = (contactsRes.data ?? []) as ContactRow[];
      const deals = (dealsRes.data ?? []) as DealRow[];
      const companies = (companiesRes.data ?? []) as CompanyRow[];
      const profiles = (profilesRes.data ?? []) as ProfileRow[];

      return ((tasksRes.data ?? []) as TaskRow[])
        .map((task) => normalizeTask(task, contacts, deals, companies, profiles))
        .sort((a, b) => taskSortValue(a) - taskSortValue(b));
    },
  });
}

export function useTaskFormOptions() {
  return useQuery({
    queryKey: ["task_form_options"],
    queryFn: async (): Promise<TaskFormOptions> => {
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

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      const dueAt = combineDateTime(input.dueDate, input.dueTime);
      const { data: userData } = await supabase.auth.getUser();
      const ownerId = input.ownerId || userData.user?.id || null;
      const completedAt = input.status === "done" ? new Date().toISOString() : null;

      const { data, error } = await supabase
        .from("tasks")
        .insert({
          title: input.title,
          type: input.type,
          due_at: dueAt,
          status: input.status,
          priority: input.priority,
          assigned_to: ownerId,
          contact_id: input.contactId || null,
          deal_id: input.dealId || null,
          notes: input.notes || null,
          reminder_at: input.reminder ? reminderBefore(dueAt) : null,
          completed_at: completedAt,
        } satisfies TaskInsert)
        .select("id")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tasksKey });
      qc.invalidateQueries({ queryKey: ["dashboard", "mytasks"] });
      qc.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

export function useToggleTaskCompletion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ task, completed }: { task: TaskItem; completed: boolean }) => {
      const payload: TaskUpdate = completed
        ? {
            status: "done",
            completed_at: new Date().toISOString(),
          }
        : {
            status: "pending",
            completed_at: null,
          };
      const { error } = await supabase.from("tasks").update(payload).eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tasksKey });
      qc.invalidateQueries({ queryKey: ["dashboard", "mytasks"] });
      qc.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

function normalizeTask(
  task: TaskRow,
  contacts: ContactRow[],
  deals: DealRow[],
  companies: CompanyRow[],
  profiles: ProfileRow[],
): TaskItem {
  const contact = contacts.find((item) => item.id === task.contact_id) ?? null;
  const deal = deals.find((item) => item.id === task.deal_id) ?? null;
  const company =
    companies.find((item) => item.id === (contact?.company_id ?? deal?.company_id)) ?? null;
  const completedAt = task.completed_at;
  const locked =
    task.status === "done" &&
    !!completedAt &&
    Date.now() - new Date(completedAt).getTime() > 15 * 60 * 1000;

  return {
    id: task.id,
    title: task.title,
    type: task.type,
    due_at: task.due_at,
    status: task.status,
    priority: task.priority,
    reminder_at: task.reminder_at,
    notes: task.notes,
    assigned_to: task.assigned_to,
    completed_at: task.completed_at,
    created_at: task.created_at,
    updated_at: task.updated_at,
    locked,
    contact,
    deal,
    company,
    owner: profiles.find((profile) => profile.id === task.assigned_to) ?? null,
    raw: task,
  };
}

function combineDateTime(date: string, time: string) {
  const fallbackDate = new Date().toISOString().slice(0, 10);
  return new Date(`${date || fallbackDate}T${time || "09:00"}`).toISOString();
}

function reminderBefore(dueAt: string) {
  return new Date(new Date(dueAt).getTime() - 15 * 60 * 1000).toISOString();
}

function taskSortValue(task: TaskItem) {
  const base = task.due_at ? new Date(task.due_at).getTime() : Number.MAX_SAFE_INTEGER;
  const completedBias = task.status === "done" && task.completed_at
    ? new Date(task.completed_at).getTime() + 1000
    : 0;
  return base + completedBias;
}
