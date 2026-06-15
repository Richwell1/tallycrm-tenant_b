import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { z } from "zod";
import { toast } from "sonner";
import { useCreateCompany } from "@/lib/companies-data";

const schema = z.object({
  name: z.string().trim().min(1, "Required").max(120),
  industry: z.string().trim().max(80).optional(),
  email: z.string().trim().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional(),
  website: z.string().trim().url("Invalid URL").optional().or(z.literal("")),
  linkedin: z.string().trim().optional(),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  country: z.string().trim().optional(),
  rating: z.string().optional(),
  notes: z.string().max(2000).optional(),
  logo_url: z.string().trim().optional(),
});

interface FormState {
  name: string;
  industry: string;
  email: string;
  phone: string;
  website: string;
  linkedin: string;
  address: string;
  city: string;
  country: string;
  rating: string;
  notes: string;
  logo_url: string;
}

const initial: FormState = {
  name: "",
  industry: "",
  email: "",
  phone: "",
  website: "",
  linkedin: "",
  address: "",
  city: "",
  country: "",
  rating: "",
  notes: "",
  logo_url: "",
};

export function AddCompanyModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const create = useCreateCompany();
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

    try {
      await create.mutateAsync({
        name: v.name.trim(),
        industry: v.industry.trim() || null,
        email: v.email.trim() || null,
        phone: v.phone.trim() || null,
        website: v.website.trim() || null,
        linkedin: v.linkedin.trim() || null,
        address: v.address.trim() || null,
        city: v.city.trim() || null,
        country: v.country.trim() || null,
        rating: v.rating ? Number(v.rating) : null,
        notes: v.notes.trim() || null,
        logo_url: v.logo_url.trim() || null,
      });
      toast.success("Company saved");
      setV(initial);
      onOpenChange(false);
    } catch (err) {
      toast.error("Could not save company", { description: (err as Error).message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add New Company</DialogTitle>
          <p className="text-sm text-text-secondary">
            Add an organisation record. Contacts and deals can be linked to it.
          </p>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Company Name *" error={errs.name}>
              <input className="input" value={v.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="Industry">
              <input className="input" value={v.industry} onChange={(e) => set("industry", e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Email" error={errs.email}>
              <input type="email" className="input" value={v.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field label="Phone">
              <input className="input" value={v.phone} onChange={(e) => set("phone", e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Website" error={errs.website}>
              <input
                className="input"
                placeholder="https://example.com"
                value={v.website}
                onChange={(e) => set("website", e.target.value)}
              />
            </Field>
            <Field label="LinkedIn URL">
              <input className="input" value={v.linkedin} onChange={(e) => set("linkedin", e.target.value)} />
            </Field>
          </div>

          <Field label="Address">
            <input className="input" value={v.address} onChange={(e) => set("address", e.target.value)} />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="City">
              <input className="input" value={v.city} onChange={(e) => set("city", e.target.value)} />
            </Field>
            <Field label="Country">
              <input className="input" value={v.country} onChange={(e) => set("country", e.target.value)} />
            </Field>
            <Field label="Rating (0–5)">
              <select className="input" value={v.rating} onChange={(e) => set("rating", e.target.value)}>
                <option value="">—</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Logo URL">
            <input className="input" value={v.logo_url} onChange={(e) => set("logo_url", e.target.value)} />
          </Field>

          <Field label="Notes">
            <textarea className="input" rows={3} value={v.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Saving..." : "Save Company"}
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
