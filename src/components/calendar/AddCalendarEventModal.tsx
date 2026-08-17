import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { format } from "date-fns";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useModalA11y } from "@/components/common/use-modal-a11y";
import { useAuth, useCurrentRole } from "@/lib/auth-context";
import { useCalendarFormOptions, useCreateCalendarEvent } from "@/lib/calendar-data";
import type { CalendarEventType } from "./calendar-types";

interface AddCalendarEventModalProps {
  open: boolean;
  initialDay: Date;
  onOpenChange: (open: boolean) => void;
}

export function AddCalendarEventModal({
  open,
  initialDay,
  onOpenChange,
}: AddCalendarEventModalProps) {
  const { data: options } = useCalendarFormOptions();
  const createEvent = useCreateCalendarEvent();
  const { user } = useAuth();
  const role = useCurrentRole();
  const canAssign = role === "admin" || role === "manager";
  const modal = useModalA11y(open, onOpenChange, { disabled: createEvent.isPending });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState<CalendarEventType>("meeting");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("10:00");
  const [allDay, setAllDay] = useState(false);
  const [companyId, setCompanyId] = useState("");
  const [contactId, setContactId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");

  useEffect(() => {
    if (!open) return;
    const date = format(initialDay, "yyyy-MM-dd");
    setStartDate(date);
    setEndDate(date);
    setAssignedTo(user?.id ?? "");
  }, [initialDay, open, user?.id]);

  useEffect(() => {
    if (!contactId || companyId) return;
    const contact = options?.contacts.find((item) => item.id === contactId);
    if (contact?.company_id) setCompanyId(contact.company_id);
  }, [companyId, contactId, options]);

  if (!open) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return toast.error("Event title is required");
    if (!startDate) return toast.error("Start date is required");

    const startsAt = localDateTime(startDate, allDay ? "00:00" : startTime);
    const endsAt = endDate ? localDateTime(endDate, allDay ? "23:59:59.999" : endTime) : null;
    if (endsAt && new Date(endsAt) < new Date(startsAt)) {
      return toast.error("End must be after start");
    }

    try {
      await createEvent.mutateAsync({
        title,
        description: description || null,
        startsAt,
        endsAt,
        allDay,
        eventType,
        companyId: companyId || null,
        contactId: contactId || null,
        assignedTo: canAssign ? assignedTo || null : user?.id || null,
      });
      toast.success("Event added");
      onOpenChange(false);
      setTitle("");
      setDescription("");
      setCompanyId("");
      setContactId("");
      setEventType("meeting");
      setAllDay(false);
    } catch (error) {
      toast.error("Could not add event", { description: (error as Error).message });
    }
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-foreground/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-calendar-event-title"
      ref={modal.ref}
      onKeyDown={modal.onKeyDown}
    >
      <section className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <header className="flex items-center justify-between border-b border-border bg-muted px-6 py-5">
          <div>
            <h2 id="add-calendar-event-title" className="text-xl font-semibold text-foreground">
              Add calendar event
            </h2>
            <p className="mt-1 text-sm text-text-secondary">Schedule a CRM event or deadline.</p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="rounded-full p-2 text-text-secondary hover:bg-card"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="space-y-5">
            <Field label="Title" required>
              <input
                autoFocus
                required
                maxLength={200}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="deal-input"
                placeholder="Customer check-in"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Event type" required>
                <select
                  value={eventType}
                  onChange={(event) => setEventType(event.target.value as CalendarEventType)}
                  className="deal-input appearance-none"
                >
                  <option value="meeting">Meeting</option>
                  <option value="call">Call</option>
                  <option value="demo">Demo</option>
                  <option value="deadline">Deadline</option>
                  <option value="other">Other</option>
                </select>
              </Field>
              <label className="flex items-end gap-3 pb-2 text-sm font-semibold text-foreground">
                <input
                  type="checkbox"
                  checked={allDay}
                  onChange={(event) => setAllDay(event.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                All-day event
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <DateTimeFields
                label="Starts"
                date={startDate}
                time={startTime}
                allDay={allDay}
                onDate={setStartDate}
                onTime={setStartTime}
                required
              />
              <DateTimeFields
                label="Ends (inclusive)"
                date={endDate}
                time={endTime}
                allDay={allDay}
                onDate={setEndDate}
                onTime={setEndTime}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Company">
                <select
                  value={companyId}
                  onChange={(event) => setCompanyId(event.target.value)}
                  className="deal-input appearance-none"
                >
                  <option value="">No company</option>
                  {options?.companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Contact">
                <select
                  value={contactId}
                  onChange={(event) => setContactId(event.target.value)}
                  className="deal-input appearance-none"
                >
                  <option value="">No contact</option>
                  {options?.contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.first_name} {contact.last_name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Assigned to">
              {canAssign ? (
                <select
                  value={assignedTo}
                  onChange={(event) => setAssignedTo(event.target.value)}
                  className="deal-input appearance-none"
                >
                  <option value="">Current user</option>
                  {options?.profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.full_name ?? "Unnamed user"}
                    </option>
                  ))}
                </select>
              ) : (
                <input readOnly value={user?.fullName ?? "Current user"} className="deal-input" />
              )}
            </Field>

            <Field label="Description">
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="min-h-24 w-full resize-y rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                placeholder="Optional notes or agenda"
              />
            </Field>
          </div>

          <footer className="mt-7 flex justify-end gap-3 border-t border-border pt-5">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createEvent.isPending}>
              {createEvent.isPending ? "Adding…" : "Add event"}
            </Button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function DateTimeFields({
  label,
  date,
  time,
  allDay,
  onDate,
  onTime,
  required,
}: {
  label: string;
  date: string;
  time: string;
  allDay: boolean;
  onDate: (value: string) => void;
  onTime: (value: string) => void;
  required?: boolean;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
        {label}
      </legend>
      <input
        type="date"
        required={required}
        value={date}
        onChange={(event) => onDate(event.target.value)}
        className="deal-input"
      />
      {!allDay ? (
        <input
          type="time"
          value={time}
          onChange={(event) => onTime(event.target.value)}
          className="deal-input"
        />
      ) : null}
    </fieldset>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
        {label}
        {required ? <span className="ml-1 text-danger">*</span> : null}
      </span>
      {children}
    </label>
  );
}

function localDateTime(date: string, time: string): string {
  return new Date(`${date}T${time}`).toISOString();
}
