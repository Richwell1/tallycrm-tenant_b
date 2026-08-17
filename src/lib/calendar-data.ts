import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { CalendarEventType, CalendarItem } from "@/components/calendar/calendar-types";
import { activityCalendarType } from "@/components/calendar/calendar-utils";

type CalendarEventRow = Database["public"]["Tables"]["calendar_events"]["Row"];
type CalendarEventInsert = Database["public"]["Tables"]["calendar_events"]["Insert"];
type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
type ActivityRow = Database["public"]["Tables"]["activities"]["Row"];
type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];
type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export interface CalendarFormOptions {
  companies: CompanyRow[];
  contacts: ContactRow[];
  profiles: ProfileRow[];
}

export interface CreateCalendarEventInput {
  title: string;
  description?: string | null;
  startsAt: string;
  endsAt?: string | null;
  allDay: boolean;
  eventType: CalendarEventType;
  companyId?: string | null;
  contactId?: string | null;
  assignedTo?: string | null;
}

export const calendarKey = ["calendar"] as const;

export function useCalendarItems(rangeStart: Date, rangeEnd: Date) {
  const startIso = rangeStart.toISOString();
  const endIso = rangeEnd.toISOString();

  return useQuery({
    queryKey: [...calendarKey, startIso, endIso],
    queryFn: async (): Promise<CalendarItem[]> => {
      const [eventsRes, tasksRes, activitiesRes, companiesRes, contactsRes, profilesRes] =
        await Promise.all([
          supabase
            .from("calendar_events")
            .select("*")
            .lte("starts_at", endIso)
            .or(`ends_at.gte.${startIso},and(ends_at.is.null,starts_at.gte.${startIso})`),
          supabase
            .from("tasks")
            .select("*")
            .is("deleted_at", null)
            .gte("due_at", startIso)
            .lte("due_at", endIso),
          supabase
            .from("activities")
            .select("*")
            .is("deleted_at", null)
            .gte("due_at", startIso)
            .lte("due_at", endIso),
          supabase.from("companies").select("*").is("deleted_at", null),
          supabase.from("contacts").select("*").is("deleted_at", null),
          supabase.from("profiles").select("*"),
        ]);

      if (eventsRes.error) throw eventsRes.error;
      if (tasksRes.error) throw tasksRes.error;
      if (activitiesRes.error) throw activitiesRes.error;
      if (companiesRes.error) throw companiesRes.error;
      if (contactsRes.error) throw contactsRes.error;
      if (profilesRes.error) throw profilesRes.error;

      const companies = (companiesRes.data ?? []) as CompanyRow[];
      const contacts = (contactsRes.data ?? []) as ContactRow[];
      const profiles = (profilesRes.data ?? []) as ProfileRow[];
      const context = { companies, contacts, profiles };

      return [
        ...((eventsRes.data ?? []) as CalendarEventRow[]).map((event) =>
          normalizeCalendarEvent(event, context),
        ),
        ...((tasksRes.data ?? []) as TaskRow[])
          .filter((task): task is TaskRow & { due_at: string } => !!task.due_at)
          .map((task) => normalizeTask(task, context)),
        ...((activitiesRes.data ?? []) as ActivityRow[])
          .filter((activity): activity is ActivityRow & { due_at: string } => !!activity.due_at)
          .map((activity) => normalizeActivity(activity, context)),
      ];
    },
  });
}

export function useCalendarFormOptions() {
  return useQuery({
    queryKey: ["calendar_form_options"],
    queryFn: async (): Promise<CalendarFormOptions> => {
      const [companiesRes, contactsRes, profilesRes] = await Promise.all([
        supabase.from("companies").select("*").is("deleted_at", null).order("name"),
        supabase.from("contacts").select("*").is("deleted_at", null).order("last_name"),
        supabase.from("profiles").select("*").eq("status", "active").order("full_name"),
      ]);
      if (companiesRes.error) throw companiesRes.error;
      if (contactsRes.error) throw contactsRes.error;
      if (profilesRes.error) throw profilesRes.error;
      return {
        companies: (companiesRes.data ?? []) as CompanyRow[],
        contacts: (contactsRes.data ?? []) as ContactRow[],
        profiles: (profilesRes.data ?? []) as ProfileRow[],
      };
    },
  });
}

export function useCreateCalendarEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCalendarEventInput) => {
      const payload: CalendarEventInsert = {
        title: input.title.trim(),
        description: input.description?.trim() || null,
        starts_at: input.startsAt,
        ends_at: input.endsAt || null,
        all_day: input.allDay,
        event_type: input.eventType,
        company_id: input.companyId || null,
        contact_id: input.contactId || null,
        assigned_to: input.assignedTo || null,
      };
      const { data, error } = await supabase
        .from("calendar_events")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: calendarKey }),
  });
}

interface CalendarContext {
  companies: CompanyRow[];
  contacts: ContactRow[];
  profiles: ProfileRow[];
}

function normalizeCalendarEvent(event: CalendarEventRow, context: CalendarContext): CalendarItem {
  return {
    id: `calendar:${event.id}`,
    source: "calendar",
    title: event.title,
    description: event.description,
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    allDay: event.all_day,
    eventType: event.event_type,
    companyName: context.companies.find((company) => company.id === event.company_id)?.name ?? null,
    contactName: contactName(context.contacts.find((contact) => contact.id === event.contact_id)),
    assigneeName:
      context.profiles.find((profile) => profile.id === event.assigned_to)?.full_name ?? null,
    status: null,
  };
}

function normalizeTask(task: TaskRow & { due_at: string }, context: CalendarContext): CalendarItem {
  const contact = context.contacts.find((item) => item.id === task.contact_id);
  return {
    id: `task:${task.id}`,
    source: "task",
    title: task.title,
    description: task.notes,
    startsAt: task.due_at,
    endsAt: null,
    allDay: false,
    eventType: "deadline",
    companyName:
      context.companies.find((company) => company.id === contact?.company_id)?.name ?? null,
    contactName: contactName(contact),
    assigneeName:
      context.profiles.find((profile) => profile.id === task.assigned_to)?.full_name ?? null,
    status: task.status,
  };
}

function normalizeActivity(
  activity: ActivityRow & { due_at: string },
  context: CalendarContext,
): CalendarItem {
  const contact = context.contacts.find((item) => item.id === activity.contact_id);
  const end = activity.duration_minutes
    ? new Date(
        new Date(activity.due_at).getTime() + activity.duration_minutes * 60000,
      ).toISOString()
    : null;
  return {
    id: `activity:${activity.id}`,
    source: "activity",
    title: activity.title,
    description: activity.notes,
    startsAt: activity.due_at,
    endsAt: end,
    allDay: false,
    eventType: activityCalendarType(activity.type),
    companyName:
      context.companies.find((company) => company.id === contact?.company_id)?.name ?? null,
    contactName: contactName(contact),
    assigneeName:
      context.profiles.find((profile) => profile.id === activity.owner_id)?.full_name ?? null,
    status: activity.outcome ? "completed" : null,
  };
}

function contactName(contact: ContactRow | undefined): string | null {
  if (!contact) return null;
  return `${contact.first_name} ${contact.last_name}`.trim();
}
