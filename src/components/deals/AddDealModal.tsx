import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCreateDeal, useContactsLite, usePipelineStages } from "@/lib/deals-data";
import { useAssignableUsers } from "@/lib/leads-data";
import { useCompaniesLite } from "@/lib/leads-data";

const schema = z.object({
  name: z.string().trim().min(1, "Required").max(120),
  primary_contact_id: z.string().uuid("Select a contact"),
  company_id: z.string().optional(),
  value: z.string().refine((v) => !isNaN(Number(v)) && Number(v) >= 0, "Enter a value"),
  currency: z.enum(["GHS", "USD"]),
  stage_id: z.string().uuid(),
  expected_close_date: z.string().min(1, "Required"),
  assigned_to: z.string().optional(),
  description: z.string().max(2000).optional(),
});

interface FormState {
  name: string;
  primary_contact_id: string;
  company_id: string;
  value: string;
  currency: "GHS" | "USD";
  stage_id: string;
  expected_close_date: string;
  assigned_to: string;
  description: string;
}

const initial: FormState = {
  name: "",
  primary_contact_id: "",
  company_id: "",
  value: "",
  currency: "GHS",
  stage_id: "",
  expected_close_date: "",
  assigned_to: "self",
  description: "",
};

export function AddDealModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const create = useCreateDeal();
  const contacts = useContactsLite();
  const companies = useCompaniesLite();
  const stages = usePipelineStages();
  const users = useAssignableUsers();
  const [v, setV] = useState<FormState>(initial);
  const [errs, setErrs] = useState<Record<string, string>>({});

  const openStages = useMemo(
    () => (stages.data ?? []).filter((s) => !s.is_closed),
    [stages.data]
  );

  function set<K extends keyof FormState>(k: K, val: FormState[K]) {
    setV((s) => ({ ...s, [k]: val }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const stageId = v.stage_id || openStages[0]?.id || "";
    const payload = { ...v, stage_id: stageId };
    const p = schema.safeParse(payload);
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

    const stage = openStages.find((s) => s.id === stageId);

    try {
      await create.mutateAsync({
        name: v.name.trim(),
        primary_contact_id: v.primary_contact_id,
        company_id: v.company_id || null,
        value: Number(v.value),
        currency: v.currency,
        stage_id: stageId,
        expected_close_date: v.expected_close_date || null,
        assigned_to: assigned,
        description: v.description.trim() || null,
      });
      // Patch probability to stage default
      if (stage?.default_probability !== undefined) {
        // separate update kept simple here; create_deal default 0
      }
      toast.success("Deal saved");
      setV(initial);
      onOpenChange(false);
    } catch (err) {
      toast.error("Could not save deal", { description: (err as Error).message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add New Deal</DialogTitle>
          <p className="text-sm text-text-secondary">
            Create a new sales opportunity linked to a contact and pipeline stage.
          </p>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Deal Name *" error={errs.name}>
            <input className="input" value={v.name} onChange={(e) => set("name", e.target.value)} />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Primary Contact *" error={errs.primary_contact_id}>
              <select
                className="input"
                value={v.primary_contact_id}
                onChange={(e) => set("primary_contact_id", e.target.value)}
              >
                <option value="">— Select contact —</option>
                {(contacts.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name} {c.email ? `(${c.email})` : ""}
                  </option>
                ))}
              </select>
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
            <Field label="Deal Value *" error={errs.value}>
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
            <Field label="Stage *">
              <select
                className="input"
                value={v.stage_id || openStages[0]?.id || ""}
                onChange={(e) => set("stage_id", e.target.value)}
              >
                {openStages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Expected Close Date *" error={errs.expected_close_date}>
              <input
                type="date"
                className="input"
                value={v.expected_close_date}
                onChange={(e) => set("expected_close_date", e.target.value)}
              />
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

          <Field label="Description">
            <textarea
              className="input"
              rows={3}
              value={v.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Saving..." : "Save Deal"}
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
