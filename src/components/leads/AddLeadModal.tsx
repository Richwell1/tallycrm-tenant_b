import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { z } from "zod";
import { useCreateLead, useAssignableUsers, type LeadStatus } from "@/lib/leads-data";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SOURCES = ["Landing Page", "Manual", "Referral", "LinkedIn"] as const;

// UI status options. "Lost" maps to the existing "disqualified" enum value.
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
  status: z.enum(["new", "contacted", "qualified", "disqualified"]),
  source: z.enum(SOURCES),
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
  source: (typeof SOURCES)[number];
  assigned_to: string; // "self" | "unassigned" | profile uuid
  expected_close_date: string;
  message: string;
};

const initial: FormState = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  company_name: "",
  value: "",
  currency: "GHS",
  status: "new",
  source: "Manual",
  assigned_to: "self",
  expected_close_date: "",
  message: "",
};

export function AddLeadModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const create = useCreateLead();
  const users = useAssignableUsers();
  const [v, setV] = useState<FormState>(initial);
  const [errs, setErrs] = useState<Record<string, string>>({});

  function set<K extends keyof FormState>(k: K, val: FormState[K]) {
    setV((s) => ({ ...s, [k]: val }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const p = schema.safeParse(v);
    if (!p.success) {
      const e2: Record<string, string> = {};
      for (const i of p.error.issues) e2[i.path[0] as string] = i.message;
      setErrs(e2);
      return;
    }
    setErrs({});

    let assigned: string | null = null;
    if (v.assigned_to === "self") {
      const { data } = await supabase.auth.getUser();
      assigned = data.user?.id ?? null;
    } else if (v.assigned_to === "unassigned") {
      assigned = null;
    } else {
      assigned = v.assigned_to;
    }

    try {
      await create.mutateAsync({
        first_name: v.first_name.trim(),
        last_name: v.last_name.trim(),
        email: v.email.trim(),
        phone: v.phone.trim() || undefined,
        company_name: v.company_name.trim() || undefined,
        message: v.message.trim() || undefined,
        status: v.status,
        source: v.source,
        assigned_to: assigned,
        value: v.value ? Number(v.value) : null,
        currency: v.currency,
        expected_close_date: v.expected_close_date || null,
      });
      toast.success("Lead saved");
      setV(initial);
      onOpenChange(false);
    } catch (err) {
      toast.error("Could not save lead", { description: (err as Error).message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add New Lead</DialogTitle>
          <p className="text-sm text-text-secondary">
            Capture professional details for your potential prospect.
          </p>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="First Name *" error={errs.first_name}>
              <input className="input" value={v.first_name} onChange={(e) => set("first_name", e.target.value)} />
            </Field>
            <Field label="Last Name *" error={errs.last_name}>
              <input className="input" value={v.last_name} onChange={(e) => set("last_name", e.target.value)} />
            </Field>
          </div>

          <Field label="Email Address *" error={errs.email}>
            <input
              type="email"
              placeholder="name@company.com"
              className="input"
              value={v.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Phone Number">
              <input className="input" value={v.phone} onChange={(e) => set("phone", e.target.value)} />
            </Field>
            <Field label="Company Name">
              <input className="input" value={v.company_name} onChange={(e) => set("company_name", e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Lead Source">
              <select
                className="input"
                value={v.source}
                onChange={(e) => set("source", e.target.value as FormState["source"])}
              >
                {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Assigned To">
              <select
                className="input"
                value={v.assigned_to}
                onChange={(e) => set("assigned_to", e.target.value)}
              >
                <option value="self">Self (Me)</option>
                {(users.data ?? []).map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name ?? "Unnamed user"}</option>
                ))}
                <option value="unassigned">Unassigned</option>
              </select>
            </Field>
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Saving..." : "Save Lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-text-secondary">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
}
