import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
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

const DEMO_PROFILE = {
  id: "demo-admin",
  full_name: "Demo Admin",
  avatar_url: null,
  email: "admin@example.com",
  status: "active",
} as ProfileRow;

const DEMO_CONTACT = {
  id: "demo-contact-1",
  first_name: "Ama",
  last_name: "Mensah",
  company_id: "demo-company-1",
} as ContactRow;

const DEMO_COMPANY = {
  id: "demo-company-1",
  name: "Accra Foods",
} as CompanyRow;

const DEMO_DEAL = {
  id: "demo-deal-1",
  name: "Accra Foods Expansion",
  company_id: "demo-company-1",
} as DealRow;

const DEMO_TASKS: TaskItem[] = [
  buildDemoTask({
    id: "demo-task-1",
    title: "Make first contact with Ama Mensah",
    type: "call",
    dueOffsetHours: -2,
    status: "pending",
    priority: "high",
    notes: "New landing-page lead. Confirm branch count and timeline.",
    contact: DEMO_CONTACT,
    company: DEMO_COMPANY,
  }),
  buildDemoTask({
    id: "demo-task-2",
    title: "Send proposal follow-up",
    type: "email",
    dueOffsetHours: 26,
    status: "in_progress",
    priority: "medium",
    notes: "Attach implementation checklist and pricing summary.",
    deal: DEMO_DEAL,
    company: DEMO_COMPANY,
  }),
  buildDemoTask({
    id: "demo-task-3",
    title: "Prepare demo agenda",
    type: "meeting",
    dueOffsetHours: 52,
    status: "pending",
    priority: "low",
    notes: "Focus on inventory, invoicing, and reporting workflows.",
    deal: DEMO_DEAL,
    contact: DEMO_CONTACT,
    company: DEMO_COMPANY,
  }),
  buildDemoTask({
    id: "demo-task-4",
    title: "Log completed onboarding call",
    type: "task",
    dueOffsetHours: -20,
    status: "done",
    priority: "medium",
    notes: "Customer confirmed training slots.",
    contact: DEMO_CONTACT,
    company: DEMO_COMPANY,
  }),
];

export function useTasks() {
  return useQuery({
    queryKey: tasksKey,
    queryFn: async () => {
      if (!isSupabaseConfigured()) {
        await delay(120);
        return DEMO_TASKS;
      }

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
      if (!isSupabaseConfigured()) {
        await delay(80);
        return {
          contacts: [DEMO_CONTACT],
          deals: [DEMO_DEAL],
          profiles: [DEMO_PROFILE],
        };
      }

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
      if (!isSupabaseConfigured()) {
        await delay(100);
        const dueAt = combineDateTime(input.dueDate, input.dueTime);
        const contact = input.contactId === DEMO_CONTACT.id ? DEMO_CONTACT : null;
        const deal = input.dealId === DEMO_DEAL.id ? DEMO_DEAL : null;
        return buildDemoTask({
          id: `demo-task-${Date.now()}`,
          title: input.title,
          type: input.type,
          dueAt,
          status: input.status,
          priority: input.priority,
          notes: input.notes,
          reminder: input.reminder,
          contact,
          deal,
          company: contact || deal ? DEMO_COMPANY : null,
        });
      }

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
    onSuccess: (created) => {
      if (!isSupabaseConfigured()) {
        qc.setQueryData<TaskItem[]>(tasksKey, (current = DEMO_TASKS) => [
          created as TaskItem,
          ...current,
        ]);
        return;
      }
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
      if (!isSupabaseConfigured()) {
        await delay(80);
        return {
          ...task,
          status: completed ? "done" : "pending",
          completed_at: completed ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        } satisfies TaskItem;
      }

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
    onSuccess: (updated, vars) => {
      if (!isSupabaseConfigured()) {
        qc.setQueryData<TaskItem[]>(tasksKey, (current = DEMO_TASKS) =>
          current.map((task) => (task.id === vars.task.id ? (updated as TaskItem) : task)),
        );
        return;
      }
      qc.invalidateQueries({ queryKey: tasksKey });
      qc.invalidateQueries({ queryKey: ["dashboard", "mytasks"] });
      qc.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

function buildDemoTask({
  id,
  title,
  type,
  dueOffsetHours,
  dueAt,
  status,
  priority,
  notes,
  reminder = true,
  contact = null,
  deal = null,
  company = null,
}: {
  id: string;
  title: string;
  type: TaskType;
  dueOffsetHours?: number;
  dueAt?: string;
  status: TaskStatus;
  priority: TaskPriority;
  notes?: string | null;
  reminder?: boolean;
  contact?: ContactRow | null;
  deal?: DealRow | null;
  company?: CompanyRow | null;
}): TaskItem {
  const now = new Date();
  const due =
    dueAt ?? new Date(now.getTime() + (dueOffsetHours ?? 0) * 60 * 60 * 1000).toISOString();
  const completedAt =
    status === "done" ? new Date(now.getTime() - 45 * 60 * 1000).toISOString() : null;
  const row = {
    id,
    title,
    type,
    due_at: due,
    status,
    priority,
    reminder_at: reminder ? reminderBefore(due) : null,
    notes: notes ?? null,
    assigned_to: DEMO_PROFILE.id,
    completed_at: completedAt,
    created_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: completedAt ?? now.toISOString(),
  } as TaskRow;

  return {
    id,
    title,
    type,
    due_at: due,
    status,
    priority,
    reminder_at: reminder ? reminderBefore(due) : null,
    notes: notes ?? null,
    assigned_to: DEMO_PROFILE.id,
    completed_at: completedAt,
    created_at: row.created_at,
    updated_at: row.updated_at,
    locked: false,
    contact,
    deal,
    company,
    owner: DEMO_PROFILE,
    raw: row,
  };
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
  const completedBias =
    task.status === "done" && task.completed_at ? new Date(task.completed_at).getTime() + 1000 : 0;
  return base + completedBias;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
