import { format, isSameMonth } from "date-fns";
import { cn } from "@/lib/utils";
import type { CalendarItem } from "./calendar-types";
import { eventTypeClasses } from "./calendar-styles";
import { eventsForDay, isToday } from "./calendar-utils";

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface CalendarGridProps {
  month: Date;
  days: Date[];
  items: CalendarItem[];
  onSelectDay: (day: Date) => void;
}

export function CalendarGrid({ month, days, items, onSelectDay }: CalendarGridProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-[var(--shadow-xs)]">
      <div className="min-w-[840px]">
        <div className="grid grid-cols-7 border-b border-border bg-muted">
          {weekdays.map((weekday) => (
            <div
              key={weekday}
              className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-text-secondary"
            >
              {weekday}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const dayItems = eventsForDay(items, day);
            const overflow = Math.max(0, dayItems.length - 3);
            return (
              <button
                type="button"
                key={day.toISOString()}
                onClick={() => onSelectDay(day)}
                aria-label={`${format(day, "EEEE, d MMMM")}, ${dayItems.length} events`}
                className={cn(
                  "min-h-32 border-b border-r border-border p-2 text-left align-top transition-colors hover:bg-muted/60 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  !isSameMonth(day, month) && "bg-muted/30 text-text-muted",
                )}
              >
                <span
                  className={cn(
                    "mb-2 flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold",
                    isToday(day) && "bg-primary text-primary-foreground",
                  )}
                >
                  {format(day, "d")}
                </span>
                <span className="block space-y-1">
                  {dayItems.slice(0, 3).map((item) => (
                    <span
                      key={item.id}
                      className={cn(
                        "block truncate rounded px-1.5 py-1 text-[11px] font-semibold",
                        eventTypeClasses[item.eventType],
                      )}
                      title={item.title}
                    >
                      {!item.allDay ? `${format(new Date(item.startsAt), "HH:mm")} ` : ""}
                      {item.title}
                    </span>
                  ))}
                  {overflow ? (
                    <span className="block px-1 text-[11px] font-semibold text-text-secondary">
                      +{overflow} more
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
