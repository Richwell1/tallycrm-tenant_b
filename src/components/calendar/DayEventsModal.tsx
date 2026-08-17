import { format } from "date-fns";
import { CalendarPlus, Clock, MapPin, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useModalA11y } from "@/components/common/use-modal-a11y";
import { cn } from "@/lib/utils";
import type { CalendarItem } from "./calendar-types";
import { eventTypeClasses } from "./calendar-styles";
import { eventsForDay } from "./calendar-utils";

interface DayEventsModalProps {
  day: Date | null;
  items: CalendarItem[];
  onClose: () => void;
  onAdd: (day: Date) => void;
}

export function DayEventsModal({ day, items, onClose, onAdd }: DayEventsModalProps) {
  const open = !!day;
  const modal = useModalA11y(open, () => onClose());
  if (!day) return null;
  const dayItems = eventsForDay(items, day);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="day-events-title"
      ref={modal.ref}
      onKeyDown={modal.onKeyDown}
    >
      <section className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <header className="flex items-start justify-between border-b border-border bg-muted px-6 py-5">
          <div>
            <h2 id="day-events-title" className="text-xl font-semibold text-foreground">
              {format(day, "EEEE, d MMMM yyyy")}
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              {dayItems.length} {dayItems.length === 1 ? "scheduled item" : "scheduled items"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-2 text-text-secondary hover:bg-card hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          {dayItems.length ? (
            <div className="space-y-3">
              {dayItems.map((item) => (
                <article key={item.id} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                            eventTypeClasses[item.eventType],
                          )}
                        >
                          {item.eventType}
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                          {item.source}
                        </span>
                        {item.status ? (
                          <span className="text-[10px] font-semibold uppercase text-text-muted">
                            {item.status.replaceAll("_", " ")}
                          </span>
                        ) : null}
                      </div>
                      <h3 className="mt-2 font-semibold text-foreground">{item.title}</h3>
                    </div>
                    <span className="flex items-center gap-1 text-xs font-medium text-text-secondary">
                      <Clock className="h-3.5 w-3.5" />
                      {item.allDay ? "All day" : format(new Date(item.startsAt), "HH:mm")}
                    </span>
                  </div>
                  {item.description ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-text-secondary">
                      {item.description}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
                    {item.companyName || item.contactName ? (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {[item.companyName, item.contactName].filter(Boolean).join(" · ")}
                      </span>
                    ) : null}
                    {item.assigneeName ? (
                      <span className="flex items-center gap-1">
                        <UserRound className="h-3.5 w-3.5" /> {item.assigneeName}
                      </span>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
              <p className="font-semibold text-foreground">Nothing scheduled</p>
              <p className="mt-1 text-sm text-text-secondary">Add an event for this day.</p>
            </div>
          )}
        </div>

        <footer className="flex justify-end gap-3 border-t border-border bg-muted/50 px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button type="button" onClick={() => onAdd(day)}>
            <CalendarPlus /> Add event
          </Button>
        </footer>
      </section>
    </div>
  );
}
