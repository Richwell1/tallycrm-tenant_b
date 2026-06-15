import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { z } from "zod";
import { useCreateLead } from "@/lib/leads-data";
import { toast } from "sonner";

const schema = z.object({
  first_name: z.string().trim().min(1, "Required"),
  last_name: z.string().trim().min(1, "Required"),
  email: z.string().trim().email("Invalid email"),
  phone: z.string().trim().optional(),
  company_name: z.string().trim().optional(),
  message: z.string().trim().optional(),
});

export function AddLeadModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const create = useCreateLead();
  const [v, setV] = useState({ first_name: "", last_name: "", email: "", phone: "", company_name: "", message: "" });
  const [errs, setErrs] = useState<Record<string, string>>({});

  function set<K extends keyof typeof v>(k: K, val: string) { setV((s) => ({ ...s, [k]: val })); }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const p = schema.safeParse(v);
    if (!p.success) {
      const e2: Record<string, string> = {};
      for (const i of p.error.issues) e2[i.path[0] as string] = i.message;
      setErrs(e2); return;
    }
    setErrs({});
    try {
      await create.mutateAsync(p.data);
      toast.success("Lead created");
      setV({ first_name: "", last_name: "", email: "", phone: "", company_name: "", message: "" });
      onOpenChange(false);
    } catch (e) {
      toast.error("Could not create lead", { description: (e as Error).message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Add new lead</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name *" error={errs.first_name}>
              <input className="input" value={v.first_name} onChange={(e) => set("first_name", e.target.value)} />
            </Field>
            <Field label="Last name *" error={errs.last_name}>
              <input className="input" value={v.last_name} onChange={(e) => set("last_name", e.target.value)} />
            </Field>
          </div>
          <Field label="Email *" error={errs.email}>
            <input type="email" className="input" value={v.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone"><input className="input" value={v.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
            <Field label="Company"><input className="input" value={v.company_name} onChange={(e) => set("company_name", e.target.value)} /></Field>
          </div>
          <Field label="Message">
            <textarea className="input" rows={3} value={v.message} onChange={(e) => set("message", e.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={create.isPending}>{create.isPending ? "Saving..." : "Create lead"}</Button>
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
