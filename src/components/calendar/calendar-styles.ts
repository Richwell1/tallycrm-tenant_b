import type { CalendarEventType } from "./calendar-types";

export const eventTypeClasses: Record<CalendarEventType, string> = {
  meeting: "bg-blue-100 text-blue-800",
  call: "bg-emerald-100 text-emerald-800",
  demo: "bg-violet-100 text-violet-800",
  deadline: "bg-amber-100 text-amber-900",
  other: "bg-slate-100 text-slate-700",
};
