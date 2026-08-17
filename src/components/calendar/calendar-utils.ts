import {
  addDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  isSameDay,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { Database } from "@/integrations/supabase/types";
import type { CalendarEventType, CalendarItem } from "./calendar-types";

const WEEK_OPTIONS = { weekStartsOn: 1 as const };

export function buildMonthDays(month: Date): Date[] {
  const first = startOfWeek(startOfMonth(month), WEEK_OPTIONS);
  const last = endOfWeek(endOfMonth(month), WEEK_OPTIONS);
  const naturalLength =
    Math.round((startOfDay(last).getTime() - startOfDay(first).getTime()) / 86400000) + 1;
  const length = Math.max(35, naturalLength);
  return Array.from({ length }, (_, index) => addDays(first, index));
}

export function eventOccursOnDay(item: CalendarItem, day: Date): boolean {
  const eventStart = new Date(item.startsAt);
  const eventEnd = new Date(item.endsAt ?? item.startsAt);
  return eventStart <= endOfDay(day) && eventEnd >= startOfDay(day);
}

export function eventsForDay(items: CalendarItem[], day: Date): CalendarItem[] {
  return items.filter((item) => eventOccursOnDay(item, day)).sort(compareCalendarItems);
}

export function compareCalendarItems(a: CalendarItem, b: CalendarItem): number {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  return (
    new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime() ||
    a.title.localeCompare(b.title)
  );
}

export function activityCalendarType(
  type: Database["public"]["Enums"]["activity_type"],
): CalendarEventType {
  if (type === "meeting" || type === "call" || type === "demo") return type;
  return "other";
}

export function isToday(day: Date): boolean {
  return isSameDay(day, new Date());
}
