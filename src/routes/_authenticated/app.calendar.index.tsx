import { createFileRoute } from "@tanstack/react-router";
import { addMonths, endOfDay, format, startOfDay, startOfMonth } from "date-fns";
import { useMemo, useState } from "react";
import { CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";
import { ErrorState } from "@/components/common";
import { PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { AddCalendarEventModal } from "@/components/calendar/AddCalendarEventModal";
import { CalendarGrid } from "@/components/calendar/CalendarGrid";
import { DayEventsModal } from "@/components/calendar/DayEventsModal";
import { buildMonthDays } from "@/components/calendar/calendar-utils";
import { useCalendarItems } from "@/lib/calendar-data";

export const Route = createFileRoute("/_authenticated/app/calendar/")({
  component: CalendarIndex,
});

function CalendarIndex() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [addDay, setAddDay] = useState<Date | null>(null);
  const days = useMemo(() => buildMonthDays(month), [month]);
  const rangeStart = startOfDay(days[0]);
  const rangeEnd = endOfDay(days[days.length - 1]);
  const calendar = useCalendarItems(rangeStart, rangeEnd);

  function showToday() {
    const today = new Date();
    setMonth(startOfMonth(today));
    setSelectedDay(today);
  }

  function openAdd(day: Date) {
    setSelectedDay(null);
    setAddDay(day);
  }

  return (
    <>
      <PageHeader
        title="Calendar"
        count={calendar.data?.length}
        actions={
          <Button type="button" onClick={() => setAddDay(new Date())}>
            <CalendarPlus /> Add event
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="icon"
            variant="outline"
            aria-label="Previous month"
            onClick={() => setMonth((current) => addMonths(current, -1))}
          >
            <ChevronLeft />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            aria-label="Next month"
            onClick={() => setMonth((current) => addMonths(current, 1))}
          >
            <ChevronRight />
          </Button>
          <Button type="button" variant="outline" onClick={showToday}>
            Today
          </Button>
        </div>
        <h2 className="text-lg font-semibold text-foreground">{format(month, "MMMM yyyy")}</h2>
      </div>

      {calendar.isError ? (
        <ErrorState
          description={(calendar.error as Error)?.message ?? "Could not load the calendar"}
          onRetry={() => calendar.refetch()}
        />
      ) : calendar.isLoading ? (
        <div
          className="h-[680px] animate-pulse rounded-xl bg-muted"
          aria-label="Loading calendar"
        />
      ) : (
        <CalendarGrid
          month={month}
          days={days}
          items={calendar.data ?? []}
          onSelectDay={setSelectedDay}
        />
      )}

      <DayEventsModal
        day={selectedDay}
        items={calendar.data ?? []}
        onClose={() => setSelectedDay(null)}
        onAdd={openAdd}
      />
      <AddCalendarEventModal
        open={!!addDay}
        initialDay={addDay ?? new Date()}
        onOpenChange={(open) => {
          if (!open) setAddDay(null);
        }}
      />
    </>
  );
}
