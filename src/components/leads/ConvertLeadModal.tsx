import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  useConvertLead,
  usePipelineStages,
  useCompaniesLite,
  type LeadRow,
} from "@/lib/leads-data";

type Step = 1 | 2 | 3;

export function ConvertLeadModal({
  open,
  onOpenChange,
  lead,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead: LeadRow;
}) {
  const navigate = useNavigate();
  const stages = usePipelineStages();
  const companies = useCompaniesLite();
  const convert = useConvertLead();
  const [step, setStep] = useState<Step>(1);

  // Step 1 — contact
  const [contact, setContact] = useState({
    first_name: lead.first_name,
    last_name: lead.last_name,
    email: lead.email,
    phone: lead.phone ?? "",
    job_title: "",
  });

  // Step 2 — company
  const [companyMode, setCompanyMode] = useState<"existing" | "new" | "none">(
    lead.company_name ? "new" : "none",
  );
  const [existingCompanyId, setExistingCompanyId] = useState<string>("");
  const [newCompany, setNewCompany] = useState({
    name: lead.company_name ?? "",
    industry: "",
    website: "",
  });

  // Step 3 — deal
  const qualifiedStageId =
    stages.data?.find((s) => s.name === "Qualified")?.id ?? stages.data?.[0]?.id ?? "";
  const [deal, setDeal] = useState({
    name: `${lead.company_name || lead.last_name} — Tally`,
    value: "",
    currency: "GHS",
    stage_id: "",
    expected_close_date: "",
  });

  useEffect(() => {
    if (qualifiedStageId && !deal.stage_id) {
      setDeal((d) => ({ ...d, stage_id: qualifiedStageId }));
    }
  }, [qualifiedStageId, deal.stage_id]);

  function next() {
    if (step === 1) {
      if (!contact.first_name || !contact.last_name || !contact.email) {
        toast.error("First, last name and email are required");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (companyMode === "existing" && !existingCompanyId) {
        toast.error("Pick a company or choose another option");
        return;
      }
      if (companyMode === "new" && !newCompany.name.trim()) {
        toast.error("Company name required");
        return;
      }
      setStep(3);
    }
  }

  async function finish() {
    if (!deal.stage_id) {
      toast.error("Pick a stage");
      return;
    }
    try {
      const result = await convert.mutateAsync({
        lead,
        contact,
        company:
          companyMode === "existing"
            ? { id: existingCompanyId }
            : companyMode === "new"
              ? newCompany
              : undefined,
        deal: {
          name: deal.name,
          value: parseFloat(deal.value) || 0,
          currency: deal.currency,
          stage_id: deal.stage_id,
          expected_close_date: deal.expected_close_date,
        },
      });
      toast.success("Lead converted", { description: "Deal created in pipeline" });
      onOpenChange(false);
      navigate({ to: "/app/deals" }).catch(() => {
        // route may not exist yet — fine
      });
      void result;
    } catch (e) {
      toast.error("Conversion failed", { description: (e as Error).message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Convert lead — step {step} of 3</DialogTitle>
        </DialogHeader>

        <Stepper step={step} />

        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-text-secondary">Confirm contact details.</p>
            <div className="grid grid-cols-2 gap-3">
              <F label="First name *">
                <input className="input" value={contact.first_name} onChange={(e) => setContact({ ...contact, first_name: e.target.value })} />
              </F>
              <F label="Last name *">
                <input className="input" value={contact.last_name} onChange={(e) => setContact({ ...contact, last_name: e.target.value })} />
              </F>
              <F label="Email *">
                <input type="email" className="input" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
              </F>
              <F label="Phone">
                <input className="input" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
              </F>
              <F label="Job title" className="col-span-2">
                <input className="input" value={contact.job_title} onChange={(e) => setContact({ ...contact, job_title: e.target.value })} />
              </F>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-text-secondary">Link the contact to a company.</p>
            <div className="flex gap-2 text-sm">
              {(["new", "existing", "none"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setCompanyMode(m)}
                  className={`rounded-lg px-3 py-1.5 font-semibold ${
                    companyMode === m ? "bg-primary text-primary-foreground" : "border border-border bg-surface"
                  }`}
                >
                  {m === "new" ? "Create new" : m === "existing" ? "Link existing" : "Skip"}
                </button>
              ))}
            </div>
            {companyMode === "existing" && (
              <F label="Company">
                <select className="input" value={existingCompanyId} onChange={(e) => setExistingCompanyId(e.target.value)}>
                  <option value="">Select…</option>
                  {companies.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </F>
            )}
            {companyMode === "new" && (
              <div className="grid grid-cols-2 gap-3">
                <F label="Company name *" className="col-span-2">
                  <input className="input" value={newCompany.name} onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })} />
                </F>
                <F label="Industry">
                  <input className="input" value={newCompany.industry} onChange={(e) => setNewCompany({ ...newCompany, industry: e.target.value })} />
                </F>
                <F label="Website">
                  <input className="input" value={newCompany.website} onChange={(e) => setNewCompany({ ...newCompany, website: e.target.value })} />
                </F>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <p className="text-sm text-text-secondary">Create the deal in your pipeline.</p>
            <F label="Deal name *">
              <input className="input" value={deal.name} onChange={(e) => setDeal({ ...deal, name: e.target.value })} />
            </F>
            <div className="grid grid-cols-2 gap-3">
              <F label="Value">
                <input type="number" min="0" step="0.01" className="input" value={deal.value} onChange={(e) => setDeal({ ...deal, value: e.target.value })} />
              </F>
              <F label="Currency">
                <select className="input" value={deal.currency} onChange={(e) => setDeal({ ...deal, currency: e.target.value })}>
                  <option>GHS</option><option>USD</option><option>EUR</option><option>GBP</option>
                </select>
              </F>
              <F label="Stage">
                <select className="input" value={deal.stage_id} onChange={(e) => setDeal({ ...deal, stage_id: e.target.value })}>
                  {stages.data?.filter((s) => !s.is_closed).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </F>
              <F label="Expected close">
                <input type="date" className="input" value={deal.expected_close_date} onChange={(e) => setDeal({ ...deal, expected_close_date: e.target.value })} />
              </F>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step > 1 ? (
            <Button variant="outline" onClick={() => setStep((s) => (s - 1) as Step)}>Back</Button>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          )}
          {step < 3 ? (
            <Button onClick={next}>Next</Button>
          ) : (
            <Button onClick={finish} disabled={convert.isPending}>
              {convert.isPending ? "Converting..." : "Convert lead"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stepper({ step }: { step: Step }) {
  const items = [{ n: 1, label: "Contact" }, { n: 2, label: "Company" }, { n: 3, label: "Deal" }];
  return (
    <div className="flex items-center gap-2 text-xs font-semibold">
      {items.map((it, i) => (
        <div key={it.n} className="flex items-center gap-2">
          <span className={`flex h-6 w-6 items-center justify-center rounded-full ${
            step >= it.n ? "bg-primary text-primary-foreground" : "bg-muted text-text-muted"
          }`}>{it.n}</span>
          <span className={step >= it.n ? "text-foreground" : "text-text-muted"}>{it.label}</span>
          {i < 2 && <span className="mx-1 h-px w-6 bg-border" />}
        </div>
      ))}
    </div>
  );
}

function F({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-1 block text-xs font-semibold text-text-secondary">{label}</span>
      {children}
    </label>
  );
}
