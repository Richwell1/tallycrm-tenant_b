import { useEffect, useState } from "react";
import { z } from "zod";
import { type LeadRow, type LeadStatus, useAssignableUsers, useUpdateLead } from "@/lib/leads-data";
import { useAuth, useCurrentRole } from "@/lib/auth-context";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const SOURCES = ["Landing Page", "Manual", "Referral", "LinkedIn", "Tally Landing Page"] as const;

const STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: "new", label: "New Lead" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "disqualified", label: "Lost" },
];

const schema = z.object({
  first_name: z.string().trim().min(1, "Required").max(80),
  last_name: z.string().trim().min(1, "Required").max(80),
  email: z.string().trim().email("Invalid email").max(255),
  phone: z.string().trim().max(40).optional(),
  company_name: z.string().trim().max(120).optional(),
  value: z.string().trim().optional(),
  currency: z.enum(["GHS", "USD"]),
  status: z.enum(["new", "contacted", "qualified", "converted", "disqualified"]),
  source: z.string().trim().min(1, "Required").max(80),
  assigned_to: z.string().optional(),
  expected_close_date: z.string().optional(),
  message: z.string().trim().max(1000).optional(),
});

type FormState = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company_name: string;
  value: string;
  currency: "GHS" | "USD";
  status: LeadStatus;
  source: string;
  assigned_to: string;
  expected_close_date: string;
  message: string;
};

export function EditLeadModal({
  lead,
  open,
  onOpenChange,
}: {
  lead: LeadRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const update = useUpdateLead();
  const users = useAssignableUsers();
  const { user } = useAuth();
  const role = useCurrentRole();
  const canAssignLead = role === "admin" || role === "manager";
  const [v, setV] = useState<FormState>(() => fromLead(lead));
  const [errs, setErrs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setV(fromLead(lead));
      setErrs({});
    }
  }, [lead, open]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setV((state) => ({ ...state, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!lead) return;

    const parsed = schema.safeParse(v);
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        nextErrors[issue.path[0] as string] = issue.message;
      }
      setErrs(nextErrors);
      return;
    }
    setErrs({});

    let assignedTo = lead.assigned_to;
    if (canAssignLead) {
      assignedTo = v.assigned_to === "unassigned" ? null : v.assigned_to || null;
    } else {
      assignedTo = lead.assigned_to ?? user?.id ?? null;
    }

    try {
      await update.mutateAsync({
        id: lead.id,
        patch: {
          first_name: v.first_name.trim(),
          last_name: v.last_name.trim(),
          email: v.email.trim(),
          phone: v.phone.trim() || null,
          company_name: v.company_name.trim() || null,
          message: v.message.trim() || null,
          status: v.status,
          source: v.source.trim(),
          assigned_to: assignedTo,
          value: v.value ? Number(v.value) : null,
          currency: v.currency,
          expected_close_date: v.expected_close_date || null,
          qualified:
            v.status === "qualified" ? true : v.status === "disqualified" ? false : lead.qualified,
        },
      });
      toast.success("Lead updated");
      onOpenChange(false);
    } catch (err) {
      toast.error("Could not update lead", { description: (err as Error).message });
    }
  }

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:w-[min(96vw,80rem)] sm:max-w-none">
        <DialogHeader>
          <DialogTitle>Edit Lead</DialogTitle>
          <p className="text-sm text-text-secondary">
            Update lead details, status, value, and assignment.
          </p>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Field label="First Name *" error={errs.first_name}>
              <input
                className="input"
                value={v.first_name}
                onChange={(e) => set("first_name", e.target.value)}
              />
            </Field>
            <Field label="Last Name *" error={errs.last_name}>
              <input
                className="input"
                value={v.last_name}
                onChange={(e) => set("last_name", e.target.value)}
              />
            </Field>
          </div>

          <Field label="Email Address *" error={errs.email}>
            <input
              type="email"
              className="input"
              value={v.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Field label="Phone Number">
              <input
                className="input"
                value={v.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </Field>
            <Field label="Company Name">
              <input
                className="input"
                value={v.company_name}
                onChange={(e) => set("company_name", e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Field label="Lead Value">
              <div className="flex">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input rounded-r-none"
                  value={v.value}
                  onChange={(e) => set("value", e.target.value)}
                />
                <select
                  className="input w-24 rounded-l-none border-l-0"
                  value={v.currency}
                  onChange={(e) => set("currency", e.target.value as FormState["currency"])}
                >
                  <option value="GHS">GHS</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </Field>
            <Field label="Lead Status">
              <select
                className="input"
                value={v.status}
                onChange={(e) => set("status", e.target.value as LeadStatus)}
                disabled={lead.status === "converted"}
              >
                {lead.status === "converted" ? (
                  <option value="converted">Converted</option>
                ) : (
                  STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))
                )}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Lead Source" error={errs.source}>
              <input
                className="input"
                list="lead-source-options"
                value={v.source}
                onChange={(e) => set("source", e.target.value)}
              />
              <datalist id="lead-source-options">
                {SOURCES.map((source) => (
                  <option key={source} value={source} />
                ))}
              </datalist>
            </Field>
            {canAssignLead ? (
              <Field label="Assigned To">
                <select
                  className="input"
                  value={v.assigned_to}
                  onChange={(e) => set("assigned_to", e.target.value)}
                >
                  <option value="unassigned">Unassigned</option>
                  {(users.data ?? []).map((assignee) => (
                    <option key={assignee.id} value={assignee.id}>
                      {assignee.full_name ?? "Unnamed user"}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <Field label="Assigned To">
                <input className="input" value="Self (Me)" readOnly />
              </Field>
            )}
          </div>

          <Field label="Expected Close Date">
            <input
              type="date"
              className="input"
              value={v.expected_close_date}
              onChange={(e) => set("expected_close_date", e.target.value)}
            />
          </Field>

          <Field label="Internal Notes" error={errs.message}>
            <textarea
              className="input"
              rows={3}
              value={v.message}
              onChange={(e) => set("message", e.target.value)}
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function fromLead(lead: LeadRow | null): FormState {
  return {
    first_name: lead?.first_name ?? "",
    last_name: lead?.last_name ?? "",
    email: lead?.email ?? "",
    phone: lead?.phone ?? "",
    company_name: lead?.company_name ?? "",
    value: lead?.value == null ? "" : String(lead.value),
    currency: lead?.currency === "USD" ? "USD" : "GHS",
    status: lead?.status ?? "new",
    source: lead?.source ?? "Manual",
    assigned_to: lead?.assigned_to ?? "unassigned",
    expected_close_date: lead?.expected_close_date ?? "",
    message: lead?.message ?? "",
  };
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-text-secondary">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
}
