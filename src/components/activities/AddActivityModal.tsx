import { type FormEvent, useEffect, useState } from "react";
import {
  type ActivityType,
  useActivityFormOptions,
  useCreateActivity,
} from "@/lib/activities-data";

interface AddActivityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const activityTypes: Array<{ label: string; value: ActivityType }> = [
  { label: "Meeting", value: "meeting" },
  { label: "Call", value: "call" },
  { label: "Email", value: "email" },
  { label: "Demo", value: "demo" },
  { label: "Proposal", value: "proposal" },
  { label: "Note", value: "note" },
  { label: "Task", value: "task" },
];

const durations = [
  { label: "15 minutes", value: 15 },
  { label: "30 minutes", value: 30 },
  { label: "1 hour", value: 60 },
  { label: "2 hours", value: 120 },
  { label: "All day", value: 480 },
];

export function AddActivityModal({ open, onOpenChange }: AddActivityModalProps) {
  const { data: options } = useActivityFormOptions();
  const createActivity = useCreateActivity();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ActivityType>("meeting");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("09:00");
  const [duration, setDuration] = useState("30");
  const [ownerId, setOwnerId] = useState("");
  const [contactId, setContactId] = useState("");
  const [dealId, setDealId] = useState("");
  const [notes, setNotes] = useState("");
  const [outcome, setOutcome] = useState("");
  const [reminder, setReminder] = useState(true);

  useEffect(() => {
    if (!open || dueDate) return;
    setDueDate(new Date().toISOString().slice(0, 10));
  }, [dueDate, open]);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await createActivity.mutateAsync({
      title,
      type,
      dueDate,
      dueTime,
      durationMinutes: type === "task" ? null : Number(duration),
      ownerId: ownerId || null,
      contactId: contactId || null,
      dealId: dealId || null,
      notes: notes || null,
      outcome: outcome || null,
      reminder,
    });
    onOpenChange(false);
    setTitle("");
    setNotes("");
    setOutcome("");
    setContactId("");
    setDealId("");
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/60 p-6 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[92vh] w-full max-w-[640px] flex-col overflow-hidden rounded-xl bg-card shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-[20px] font-semibold text-foreground">Add Activity</h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-full p-1 text-text-secondary transition-colors hover:bg-muted"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-text-secondary">Title</span>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="deal-input"
              placeholder="Brief summary of the activity"
            />
          </label>

          <div className="space-y-1">
            <span className="text-xs font-semibold text-text-secondary">Activity Type</span>
            <div className="flex w-full rounded-lg bg-muted p-1">
              {activityTypes.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setType(item.value)}
                  className={`flex-1 rounded-md py-2 text-xs font-semibold transition-all ${
                    type === item.value
                      ? "bg-primary text-white"
                      : "text-text-secondary hover:text-foreground"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-text-secondary">Due Date</span>
              <input
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="deal-input"
                type="date"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-text-secondary">Time</span>
              <input
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="deal-input"
                type="time"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-text-secondary">Duration</span>
              <select
                disabled={type === "task"}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="deal-input appearance-none disabled:bg-muted disabled:text-text-muted"
              >
                {durations.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-text-secondary">Owner</span>
              <div className="relative">
                <span className="material-symbols-outlined pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[18px] text-text-secondary">
                  person
                </span>
                <select
                  value={ownerId}
                  onChange={(e) => setOwnerId(e.target.value)}
                  className="deal-input appearance-none pl-9"
                >
                  <option value="">Current user</option>
                  {options?.profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.full_name}
                    </option>
                  ))}
                </select>
              </div>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-text-secondary">Link to Contact</span>
              <div className="relative">
                <span className="material-symbols-outlined pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[18px] text-text-secondary">
                  search
                </span>
                <select
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  className="deal-input appearance-none pl-9"
                >
                  <option value="">Search contacts...</option>
                  {options?.contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.first_name} {contact.last_name}
                    </option>
                  ))}
                </select>
              </div>
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-text-secondary">Link to Deal</span>
            <div className="relative">
              <span className="material-symbols-outlined pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[18px] text-text-secondary">
                handshake
              </span>
              <select
                value={dealId}
                onChange={(e) => setDealId(e.target.value)}
                className="deal-input appearance-none pl-9"
              >
                <option value="">Search deals...</option>
                {options?.deals.map((deal) => (
                  <option key={deal.id} value={deal.id}>
                    {deal.name}
                  </option>
                ))}
              </select>
            </div>
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-text-secondary">Description</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-28 w-full resize-none rounded-lg border border-border bg-card p-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="Enter details or notes about this activity..."
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-text-secondary">Outcome</span>
            <textarea
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              className="min-h-24 w-full resize-none rounded-lg border border-border bg-card p-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="Outcome required when the activity is completed..."
            />
            <p className="text-xs text-text-muted">
              Leave this blank for open work. Add it when the activity is finished.
            </p>
          </label>

          <div className="flex items-center justify-between rounded-lg border border-border bg-muted p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-light text-primary">
                <span className="material-symbols-outlined">notifications</span>
              </div>
              <div>
                <p className="text-[16px] font-semibold text-foreground">Set Reminder</p>
                <p className="text-sm text-text-secondary">
                  Get notified 15 minutes before activity
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setReminder((current) => !current)}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                reminder ? "bg-primary" : "bg-border-strong"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  reminder ? "translate-x-2.5" : "-translate-x-5"
                }`}
              />
            </button>
          </div>
        </div>

        <footer className="flex justify-end gap-4 border-t border-border bg-card px-6 py-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg px-6 py-2 text-[16px] font-semibold text-text-secondary transition-colors hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createActivity.isPending}
            className="rounded-lg bg-primary px-6 py-2 text-[16px] font-semibold text-white shadow-[var(--shadow-sm)] transition-all hover:bg-primary-dark active:scale-95 disabled:opacity-60"
          >
            {createActivity.isPending ? "Saving..." : "Save Activity"}
          </button>
        </footer>
      </form>
    </div>
  );
}
