import assert from "node:assert/strict";
import test from "node:test";
import type { CalendarItem } from "./calendar-types";
import {
  activityCalendarType,
  buildMonthDays,
  eventOccursOnDay,
  eventsForDay,
} from "./calendar-utils";

function item(patch: Partial<CalendarItem> = {}): CalendarItem {
  return {
    id: "calendar:1",
    source: "calendar",
    title: "Demo",
    description: null,
    startsAt: new Date(2026, 7, 17, 9).toISOString(),
    endsAt: null,
    allDay: false,
    eventType: "demo",
    companyName: null,
    contactName: null,
    assigneeName: null,
    status: null,
    ...patch,
  };
}

test("buildMonthDays returns complete Monday-first weeks", () => {
  const days = buildMonthDays(new Date(2026, 7, 1));
  assert.equal(days.length, 42);
  assert.equal(days[0].getDay(), 1);
  assert.equal(days.at(-1)?.getDay(), 0);
  assert.equal(days[0].getMonth(), 6);
  assert.equal(days.at(-1)?.getMonth(), 8);
});

test("an event appears on every day covered by its inclusive range", () => {
  const multiDay = item({
    startsAt: new Date(2026, 7, 17, 9).toISOString(),
    endsAt: new Date(2026, 7, 19, 17).toISOString(),
  });
  assert.equal(eventOccursOnDay(multiDay, new Date(2026, 7, 16)), false);
  assert.equal(eventOccursOnDay(multiDay, new Date(2026, 7, 17)), true);
  assert.equal(eventOccursOnDay(multiDay, new Date(2026, 7, 18)), true);
  assert.equal(eventOccursOnDay(multiDay, new Date(2026, 7, 19)), true);
  assert.equal(eventOccursOnDay(multiDay, new Date(2026, 7, 20)), false);
});

test("day items put all-day entries before timed entries", () => {
  const timed = item({ id: "calendar:timed" });
  const allDay = item({ id: "calendar:all-day", allDay: true });
  assert.deepEqual(
    eventsForDay([timed, allDay], new Date(2026, 7, 17)).map((event) => event.id),
    ["calendar:all-day", "calendar:timed"],
  );
});

test("activity types map to calendar chip types", () => {
  assert.equal(activityCalendarType("meeting"), "meeting");
  assert.equal(activityCalendarType("call"), "call");
  assert.equal(activityCalendarType("demo"), "demo");
  assert.equal(activityCalendarType("email"), "other");
  assert.equal(activityCalendarType("proposal"), "other");
  assert.equal(activityCalendarType("note"), "other");
});
