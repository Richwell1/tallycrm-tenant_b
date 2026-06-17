import { type ReactNode, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  useConvertLead,
  usePipelineStages,
  useCompaniesLite,
  useAssignableUsers,
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
  const users = useAssignableUsers();
  const convert = useConvertLead();
  const [step, setStep] = useState<Step>(1);

  // Step 1 — contact
  const [contact, setContact] = useState({
    first_name: lead.first_name,
    last_name: lead.last_name,
    email: lead.email,
    phone: lead.phone ?? "",
    job_title: "",
    notes: lead.message ?? "",
    tags: "Converted Lead",
  });

  // Step 2 — company
  const [companyMode, setCompanyMode] = useState<"existing" | "new" | "none">(
    lead.company_name ? "new" : "none",
  );
  const [existingCompanyId, setExistingCompanyId] = useState<string>("");
  const [newCompany, setNewCompany] = useState({
    name: lead.company_name ?? "",
    industry: "",
    email: lead.email,
    phone: lead.phone ?? "",
    website: "",
    linkedin: "",
    address: "",
    city: "",
    country: lead.ip_country ?? "",
    account_manager_id: lead.assigned_to ?? "",
    notes: lead.message ?? "",
    rating: "4",
  });

  // Step 3 — deal
  const qualifiedStageId =
    stages.data?.find((s) => s.name === "Qualified")?.id ?? stages.data?.[0]?.id ?? "";
  const [deal, setDeal] = useState({
    name: `${lead.company_name || lead.last_name} — Tally`,
    value: "",
    currency: lead.currency ?? "GHS",
    stage_id: "",
    expected_close_date: lead.expected_close_date ?? "",
    description: lead.message ?? "",
    tags: "Converted Lead, Pipeline",
  });

  useEffect(() => {
    if (qualifiedStageId && !deal.stage_id) {
      setDeal((d) => ({ ...d, stage_id: qualifiedStageId }));
    }
  }, [qualifiedStageId, deal.stage_id]);

  useEffect(() => {
    if (!lead.value) return;
    setDeal((current) => (current.value ? current : { ...current, value: String(lead.value) }));
  }, [lead.value]);

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
        contact: {
          ...contact,
          tags: parseTags(contact.tags),
        },
        company:
          companyMode === "existing"
            ? { id: existingCompanyId }
            : companyMode === "new"
              ? {
                  ...newCompany,
                  rating: Number(newCompany.rating) || 4,
                }
              : undefined,
        deal: {
          name: deal.name,
          value: parseFloat(deal.value) || 0,
          currency: deal.currency,
          stage_id: deal.stage_id,
          expected_close_date: deal.expected_close_date,
          description: deal.description,
          tags: parseTags(deal.tags),
          probability:
            stages.data?.find((stage) => stage.id === deal.stage_id)?.default_probability ?? null,
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
      <DialogContent className="sm:w-[min(96vw,92rem)] sm:max-w-none">
        <DialogHeader>
          <DialogTitle>Convert lead — step {step} of 3</DialogTitle>
        </DialogHeader>

        <Stepper step={step} />

        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-text-secondary">Confirm contact details.</p>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <F label="First name *">
                <input
                  className="input"
                  value={contact.first_name}
                  onChange={(e) => setContact({ ...contact, first_name: e.target.value })}
                />
              </F>
              <F label="Last name *">
                <input
                  className="input"
                  value={contact.last_name}
                  onChange={(e) => setContact({ ...contact, last_name: e.target.value })}
                />
              </F>
              <F label="Email *">
                <input
                  type="email"
                  className="input"
                  value={contact.email}
                  onChange={(e) => setContact({ ...contact, email: e.target.value })}
                />
              </F>
              <F label="Phone">
                <input
                  className="input"
                  value={contact.phone}
                  onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                />
              </F>
              <F label="Job title">
                <input
                  className="input"
                  value={contact.job_title}
                  onChange={(e) => setContact({ ...contact, job_title: e.target.value })}
                />
              </F>
              <F label="Tags">
                <input
                  className="input"
                  value={contact.tags}
                  onChange={(e) => setContact({ ...contact, tags: e.target.value })}
                  placeholder="Converted Lead, Decision Maker"
                />
              </F>
              <F label="Contact notes" className="col-span-2">
                <textarea
                  className="input min-h-20 resize-none"
                  value={contact.notes}
                  onChange={(e) => setContact({ ...contact, notes: e.target.value })}
                />
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
                    companyMode === m
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-surface"
                  }`}
                >
                  {m === "new" ? "Create new" : m === "existing" ? "Link existing" : "Skip"}
                </button>
              ))}
            </div>
            {companyMode === "existing" && (
              <F label="Company">
                <select
                  className="input"
                  value={existingCompanyId}
                  onChange={(e) => setExistingCompanyId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {companies.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </F>
            )}
            {companyMode === "new" && (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <F label="Company name *" className="col-span-2">
                  <input
                    className="input"
                    value={newCompany.name}
                    onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                  />
                </F>
                <F label="Industry">
                  <select
                    className="input"
                    value={newCompany.industry}
                    onChange={(e) => setNewCompany({ ...newCompany, industry: e.target.value })}
                  >
                    <option value="">Select Industry</option>
                    <option>Technology</option>
                    <option>Manufacturing</option>
                    <option>Healthcare</option>
                    <option>Finance</option>
                    <option>Consumer Retail</option>
                    <option>Logistics</option>
                  </select>
                </F>
                <F label="Primary Email">
                  <input
                    type="email"
                    className="input"
                    value={newCompany.email}
                    onChange={(e) => setNewCompany({ ...newCompany, email: e.target.value })}
                  />
                </F>
                <F label="Phone Number">
                  <input
                    className="input"
                    value={newCompany.phone}
                    onChange={(e) => setNewCompany({ ...newCompany, phone: e.target.value })}
                  />
                </F>
                <F label="Website URL">
                  <input
                    className="input"
                    value={newCompany.website}
                    onChange={(e) => setNewCompany({ ...newCompany, website: e.target.value })}
                  />
                </F>
                <F label="LinkedIn Profile">
                  <input
                    className="input"
                    value={newCompany.linkedin}
                    onChange={(e) => setNewCompany({ ...newCompany, linkedin: e.target.value })}
                    placeholder="linkedin.com/company/..."
                  />
                </F>
                <F label="Street Address">
                  <input
                    className="input"
                    value={newCompany.address}
                    onChange={(e) => setNewCompany({ ...newCompany, address: e.target.value })}
                  />
                </F>
                <F label="City">
                  <input
                    className="input"
                    value={newCompany.city}
                    onChange={(e) => setNewCompany({ ...newCompany, city: e.target.value })}
                  />
                </F>
                <F label="Country">
                  <input
                    className="input"
                    value={newCompany.country}
                    onChange={(e) => setNewCompany({ ...newCompany, country: e.target.value })}
                    placeholder="United States"
                  />
                </F>
                <F label="Account Manager">
                  <select
                    className="input"
                    value={newCompany.account_manager_id}
                    onChange={(e) =>
                      setNewCompany({ ...newCompany, account_manager_id: e.target.value })
                    }
                  >
                    <option value="">Use lead assignee</option>
                    {users.data?.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.full_name}
                      </option>
                    ))}
                  </select>
                </F>
                <F label="Rating">
                  <select
                    className="input"
                    value={newCompany.rating}
                    onChange={(e) => setNewCompany({ ...newCompany, rating: e.target.value })}
                  >
                    <option value="5">5 - Strategic</option>
                    <option value="4">4 - Strong fit</option>
                    <option value="3">3 - Qualified</option>
                    <option value="2">2 - Watch</option>
                    <option value="1">1 - Low fit</option>
                  </select>
                </F>
                <F label="Company notes" className="col-span-2">
                  <textarea
                    className="input min-h-20 resize-none"
                    value={newCompany.notes}
                    onChange={(e) => setNewCompany({ ...newCompany, notes: e.target.value })}
                  />
                </F>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <p className="text-sm text-text-secondary">Create the deal in your pipeline.</p>
            <F label="Deal name *">
              <input
                className="input"
                value={deal.name}
                onChange={(e) => setDeal({ ...deal, name: e.target.value })}
              />
            </F>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <F label="Value">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input"
                  value={deal.value}
                  onChange={(e) => setDeal({ ...deal, value: e.target.value })}
                />
              </F>
              <F label="Currency">
                <select
                  className="input"
                  value={deal.currency}
                  onChange={(e) => setDeal({ ...deal, currency: e.target.value })}
                >
                  <option>GHS</option>
                  <option>USD</option>
                  <option>EUR</option>
                  <option>GBP</option>
                </select>
              </F>
              <F label="Stage">
                <select
                  className="input"
                  value={deal.stage_id}
                  onChange={(e) => setDeal({ ...deal, stage_id: e.target.value })}
                >
                  {stages.data
                    ?.filter((s) => !s.is_closed)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </F>
              <F label="Expected close">
                <input
                  type="date"
                  className="input"
                  value={deal.expected_close_date}
                  onChange={(e) => setDeal({ ...deal, expected_close_date: e.target.value })}
                />
              </F>
              <F label="Tags">
                <input
                  className="input"
                  value={deal.tags}
                  onChange={(e) => setDeal({ ...deal, tags: e.target.value })}
                />
              </F>
              <F label="Deal description" className="col-span-2">
                <textarea
                  className="input min-h-20 resize-none"
                  value={deal.description}
                  onChange={(e) => setDeal({ ...deal, description: e.target.value })}
                />
              </F>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step > 1 ? (
            <Button variant="outline" onClick={() => setStep((s) => (s - 1) as Step)}>
              Back
            </Button>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
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
  const items = [
    { n: 1, label: "Contact" },
    { n: 2, label: "Company" },
    { n: 3, label: "Deal" },
  ];
  return (
    <div className="flex items-center gap-2 text-xs font-semibold">
      {items.map((it, i) => (
        <div key={it.n} className="flex items-center gap-2">
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full ${
              step >= it.n ? "bg-primary text-primary-foreground" : "bg-muted text-text-muted"
            }`}
          >
            {it.n}
          </span>
          <span className={step >= it.n ? "text-foreground" : "text-text-muted"}>{it.label}</span>
          {i < 2 && <span className="mx-1 h-px w-6 bg-border" />}
        </div>
      ))}
    </div>
  );
}

function F({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-1 block text-xs font-semibold text-text-secondary">{label}</span>
      {children}
    </label>
  );
}

function parseTags(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value;
  return (value ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}
