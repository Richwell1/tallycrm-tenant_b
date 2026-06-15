import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import {
  type CreateTaskInput,
  type TaskPriority,
  type TaskStatus,
  type TaskType,
  useCreateTask,
  useTaskFormOptions,
} from "@/lib/tasks-data";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const activityTypes: Array<{ label: string; value: TaskType; icon: string }> = [
  { label: "Meeting", value: "meeting", icon: "groups" },
  { label: "Call", value: "call", icon: "call" },
  { label: "Email", value: "email", icon: "mail" },
  { label: "Task", value: "task", icon: "check_circle" },
];

const schema = z.object({
  title: z.string().trim().min(1, "Task title is required").max(160),
  dueDate: z.string().min(1, "Due date is required"),
  dueTime: z.string().min(1, "Due time is required"),
  status: z.enum(["pending", "in_progress"]),
  priority: z.enum(["low", "medium", "high"]),
});

interface AddTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddTaskModal({ open, onOpenChange }: AddTaskModalProps) {
  const { data: options } = useTaskFormOptions();
  const createTask = useCreateTask();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<TaskType>("meeting");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("09:00");
  const [status, setStatus] = useState<TaskStatus>("pending");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [ownerId, setOwnerId] = useState("");
  const [contactId, setContactId] = useState("");
  const [dealId, setDealId] = useState("");
  const [notes, setNotes] = useState("");
  const [reminder, setReminder] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open || dueDate) return;
    setDueDate(new Date().toISOString().slice(0, 10));
  }, [dueDate, open]);

  useEffect(() => {
    if (!open) {
      setErrors({});
      setDueDate("");
      setDueTime("09:00");
      setTitle("");
      setType("meeting");
      setStatus("pending");
      setPriority("medium");
      setOwnerId("");
      setContactId("");
      setDealId("");
      setNotes("");
      setReminder(true);
    }
  }, [open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = schema.safeParse({ title, dueDate, dueTime, status, priority });
    if (!result.success) {
      const next: Record<string, string> = {};
      for (const issue of result.error.issues) next[issue.path[0] as string] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});

    const payload: CreateTaskInput = {
      title: result.data.title,
      type,
      status,
      priority,
      dueDate: result.data.dueDate,
      dueTime: result.data.dueTime,
      ownerId: ownerId || null,
      contactId: contactId || null,
      dealId: dealId || null,
      notes: notes || null,
      reminder,
    };

    try {
      await createTask.mutateAsync(payload);
      toast.success("Task saved");
      onOpenChange(false);
      setTitle("");
      setNotes("");
      setContactId("");
      setDealId("");
      setOwnerId("");
    } catch (error) {
      toast.error("Could not save task", { description: (error as Error).message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-hidden border-border bg-card p-0">
        <form onSubmit={handleSubmit} className="flex max-h-[92vh] flex-col">
          <DialogHeader className="border-b border-border px-6 py-5 text-left">
            <DialogTitle className="text-[20px] font-semibold text-foreground">
              Add New Task
            </DialogTitle>
            <DialogDescription className="text-sm text-text-secondary">
              Capture follow-up work with due date, owner, priority, and optional reminder.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-text-secondary">Task Title</span>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input"
                placeholder="e.g. Schedule Product Demo"
              />
              {errors.title ? <p className="text-xs text-danger">{errors.title}</p> : null}
            </label>

            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-text-secondary">Activity Type</span>
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted p-2 sm:grid-cols-4">
                {activityTypes.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setType(item.value)}
                    className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold transition-all ${
                      type === item.value
                        ? "bg-primary text-white"
                        : "text-text-secondary hover:text-foreground"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-text-secondary">Due Date</span>
                <input
                  required
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="input"
                />
                {errors.dueDate ? <p className="text-xs text-danger">{errors.dueDate}</p> : null}
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-text-secondary">Time</span>
                <input
                  required
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  className="input"
                />
                {errors.dueTime ? <p className="text-xs text-danger">{errors.dueTime}</p> : null}
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-text-secondary">Status</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className="input"
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                </select>
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-text-secondary">Priority</span>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className="input"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-text-secondary">Assigned To</span>
                <select
                  value={ownerId}
                  onChange={(e) => setOwnerId(e.target.value)}
                  className="input"
                >
                  <option value="">Current user</option>
                  {options?.profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.full_name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-text-secondary">Link to Contact</span>
                <select
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  className="input"
                >
                  <option value="">Search contacts...</option>
                  {options?.contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.first_name} {contact.last_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-text-secondary">Link to Deal</span>
                <select
                  value={dealId}
                  onChange={(e) => setDealId(e.target.value)}
                  className="input"
                >
                  <option value="">Search deals...</option>
                  {options?.deals.map((deal) => (
                    <option key={deal.id} value={deal.id}>
                      {deal.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-text-secondary">Description</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input min-h-28 resize-none"
                placeholder="Task context, agenda, or follow-up notes..."
              />
            </label>

            <div className="flex items-center justify-between rounded-lg border border-border bg-muted px-4 py-4">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-light text-primary">
                  <span className="material-symbols-outlined">notifications</span>
                </div>
                <div>
                  <p className="text-[16px] font-semibold text-foreground">Set Reminder</p>
                  <p className="text-sm text-text-secondary">
                    Create a reminder 15 minutes before the due time
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
                    reminder ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          </div>

          <DialogFooter className="border-t border-border bg-card px-6 py-4 sm:justify-end">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg px-6 py-2 text-[16px] font-semibold text-text-secondary transition-colors hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createTask.isPending}
              className="rounded-lg bg-primary px-6 py-2 text-[16px] font-semibold text-white shadow-[var(--shadow-sm)] transition-all hover:bg-primary-dark active:scale-95 disabled:opacity-60"
            >
              {createTask.isPending ? "Saving..." : "Save Task"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
