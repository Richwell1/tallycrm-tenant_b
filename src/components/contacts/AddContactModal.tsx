import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCreateContact } from "@/lib/contacts-data";
import { useAssignableUsers, useCompaniesLite } from "@/lib/leads-data";

const schema = z.object({
  first_name: z.string().trim().min(1, "Required").max(80),
  last_name: z.string().trim().min(1, "Required").max(80),
  email: z.string().trim().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional(),
  job_title: z.string().trim().max(120).optional(),
  company_id: z.string().optional(),
  source: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

interface FormState {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  job_title: string;
  company_id: string;
  source: string;
  assigned_to: string;
  notes: string;
}

const initial: FormState = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  job_title: "",
  company_id: "",
  source: "Manual",
  assigned_to: "self",
  notes: "",
};

export function AddContactModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const create = useCreateContact();
  const companies = useCompaniesLite();
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
        email: v.email.trim() || null,
        phone: v.phone.trim() || null,
        job_title: v.job_title.trim() || null,
        company_id: v.company_id || null,
        source: v.source || null,
        assigned_to: assigned,
        notes: v.notes.trim() || null,
      });
      toast.success("Contact saved");
      setV(initial);
      onOpenChange(false);
    } catch (err) {
      toast.error("Could not save contact", { description: (err as Error).message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add New Contact</DialogTitle>
          <p className="text-sm text-text-secondary">
            Capture details for a person record inside the CRM.
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Email Address" error={errs.email}>
              <input
                type="email"
                className="input"
                value={v.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </Field>
            <Field label="Phone Number">
              <input className="input" value={v.phone} onChange={(e) => set("phone", e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Job Title">
              <input className="input" value={v.job_title} onChange={(e) => set("job_title", e.target.value)} />
            </Field>
            <Field label="Company">
              <select
                className="input"
                value={v.company_id}
                onChange={(e) => set("company_id", e.target.value)}
              >
                <option value="">— None —</option>
                {(companies.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Source">
              <select
                className="input"
                value={v.source}
                onChange={(e) => set("source", e.target.value)}
              >
                <option value="Manual">Manual</option>
                <option value="Landing Page">Landing Page</option>
                <option value="Referral">Referral</option>
                <option value="LinkedIn">LinkedIn</option>
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
                  <option key={u.id} value={u.id}>
                    {u.full_name ?? "Unnamed user"}
                  </option>
                ))}
                <option value="unassigned">Unassigned</option>
              </select>
            </Field>
          </div>

          <Field label="Notes">
            <textarea className="input" rows={3} value={v.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Saving..." : "Save Contact"}
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
