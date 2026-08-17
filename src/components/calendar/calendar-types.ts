import type { Database } from "@/integrations/supabase/types";

export type CalendarEventType = Database["public"]["Enums"]["calendar_event_type"];
export type CalendarItemSource = "calendar" | "task" | "activity";

export interface CalendarItem {
  id: string;
  source: CalendarItemSource;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  eventType: CalendarEventType;
  companyName: string | null;
  contactName: string | null;
  assigneeName: string | null;
  status: string | null;
}
