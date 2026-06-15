import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useModalA11y } from "@/components/common/use-modal-a11y";
import { useCreateDeal, useDealFormOptions } from "@/lib/deals-data";

interface AddDealModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const currencies = ["USD", "GHS", "NGN", "KES"];

export function AddDealModal({ open, onOpenChange }: AddDealModalProps) {
  const { data: options } = useDealFormOptions();
  const createDeal = useCreateDeal();
  const [name, setName] = useState("");
  const [contactId, setContactId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [value, setValue] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [stageId, setStageId] = useState("");
  const [probability, setProbability] = useState("25");
  const [closeDate, setCloseDate] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const modal = useModalA11y(open, onOpenChange, { disabled: createDeal.isPending });

  const selectedStage = useMemo(
    () => options?.stages.find((stage) => stage.id === stageId),
    [options?.stages, stageId],
  );

  useEffect(() => {
    if (!open || !options?.stages.length || stageId) return;
    const firstOpen = options.stages.find((stage) => !stage.is_closed) ?? options.stages[0];
    setStageId(firstOpen.id);
    setProbability(String(firstOpen.default_probability ?? 25));
  }, [open, options?.stages, stageId]);

  useEffect(() => {
    if (!contactId || companyId) return;
    const contact = options?.contacts.find((item) => item.id === contactId);
    if (contact?.company_id) setCompanyId(contact.company_id);
  }, [companyId, contactId, options?.contacts]);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Deal name is required");
      return;
    }
    if (!contactId) {
      toast.error("Primary contact is required");
      return;
    }
    if (!value || Number(value) <= 0) {
      toast.error("Deal value must be greater than zero");
      return;
    }
    if (!stageId) {
      toast.error("Select a pipeline stage");
      return;
    }
    if (!closeDate) {
      toast.error("Expected close date is required");
      return;
    }

    try {
      await createDeal.mutateAsync({
        name: name.trim(),
        primary_contact_id: contactId,
        company_id: companyId || null,
        value: Number(value),
        currency,
        stage_id: stageId,
        probability: Number(probability || selectedStage?.default_probability || 0),
        expected_close_date: closeDate,
        assigned_to: assignedTo || null,
        description: description.trim() || null,
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      });
      toast.success("Deal saved");
      onOpenChange(false);
      setName("");
      setContactId("");
      setCompanyId("");
      setValue("");
      setDescription("");
    } catch (error) {
      toast.error("Could not save deal", { description: (error as Error).message });
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/60 p-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-deal-title"
      ref={modal.ref}
      onKeyDown={modal.onKeyDown}
    >
      <div className="flex max-h-[92vh] w-full max-w-[720px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <header className="flex items-center justify-between border-b border-border bg-muted px-8 py-6">
          <div>
            <h2 id="add-deal-title" className="text-[24px] font-semibold text-foreground">
              Add New Deal
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Populate the fields below to create a new opportunity in the pipeline.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-full p-2 text-text-secondary transition-colors hover:bg-danger-light hover:text-danger"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-8 py-8">
          <div className="space-y-6">
            <Field label="Deal Name">
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="deal-input"
                placeholder="e.g. Q4 Cloud Infrastructure Expansion"
              />
            </Field>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Field label="Primary Contact">
                <div className="relative">
                  <span className="material-symbols-outlined pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-text-muted">
                    person
                  </span>
                  <select
                    required
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
              </Field>
              <Field label="Company">
                <div className="relative">
                  <span className="material-symbols-outlined pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-text-muted">
                    business
                  </span>
                  <select
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value)}
                    className="deal-input appearance-none pl-9"
                  >
                    <option value="">Search companies...</option>
                    {options?.companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <Field label="Value" className="md:col-span-2">
                <div className="flex">
                  <input
                    required
                    min="0"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="deal-input rounded-r-none border-r-0"
                    placeholder="0.00"
                    type="number"
                  />
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="h-[38px] w-24 rounded-r-lg border border-border bg-muted px-2 text-xs font-semibold outline-none"
                  >
                    {currencies.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </div>
              </Field>
              <Field label="Probability %">
                <input
                  min="0"
                  max="100"
                  value={probability}
                  onChange={(e) => setProbability(e.target.value)}
                  className="deal-input"
                  type="number"
                />
              </Field>
            </div>

            <Field label="Stage">
              <div className="flex h-10 w-full items-center gap-1 overflow-hidden">
                {options?.stages.map((stage, index) => {
                  const active = stage.id === stageId;
                  const closedWon = stage.is_closed && stage.is_won;
                  const closedLost = stage.is_closed && !stage.is_won;
                  return (
                    <button
                      key={stage.id}
                      type="button"
                      onClick={() => {
                        setStageId(stage.id);
                        setProbability(String(stage.default_probability ?? probability));
                      }}
                      className={`pipeline-step h-full flex-1 text-[10px] font-bold uppercase transition-colors ${
                        active
                          ? closedWon
                            ? "bg-success text-white shadow-inner"
                            : closedLost
                              ? "bg-danger text-white shadow-inner"
                              : "bg-primary text-white shadow-inner"
                          : closedWon
                            ? "bg-success/30 text-text-secondary hover:bg-success/50"
                            : closedLost
                              ? "bg-danger/30 text-text-secondary hover:bg-danger/50"
                              : "bg-primary/30 text-text-secondary hover:bg-primary/50"
                      } ${index === 0 ? "pipeline-step-first" : ""} ${
                        index === (options?.stages.length ?? 0) - 1 ? "pipeline-step-last" : ""
                      }`}
                    >
                      {stage.name.replace(" Made", "").replace(" To Buy", "")}
                    </button>
                  );
                })}
              </div>
            </Field>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Field label="Expected Close Date">
                <input
                  required
                  value={closeDate}
                  onChange={(e) => setCloseDate(e.target.value)}
                  className="deal-input"
                  type="date"
                />
              </Field>
              <Field label="Assigned To">
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="deal-input appearance-none bg-muted"
                >
                  <option value="">Current user</option>
                  {options?.profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.full_name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Description">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-28 w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="Brief summary of the deal context..."
              />
            </Field>

            <Field label="Tags">
              <div className="flex min-h-[42px] flex-wrap gap-2 rounded-lg border border-border bg-muted p-2">
                {tags
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((tag) => (
                    <span
                      key={tag}
                      className="flex items-center gap-1 rounded bg-primary-light px-2 py-1 text-xs font-semibold text-primary"
                    >
                      {tag}
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </span>
                  ))}
                <input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="min-w-[160px] flex-1 border-none bg-transparent px-1 py-1 text-sm outline-none focus:ring-0"
                  placeholder="Add tag..."
                />
              </div>
            </Field>
          </div>

          <footer className="-mx-8 -mb-8 mt-8 flex justify-end gap-4 border-t border-border bg-muted px-8 py-6">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg border border-border bg-card px-8 py-2 text-xs font-semibold transition-colors hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createDeal.isPending}
              className="rounded-lg bg-primary px-8 py-2 text-xs font-semibold text-white shadow-[var(--shadow-sm)] transition-all hover:bg-primary-dark active:scale-95 disabled:opacity-60"
            >
              {createDeal.isPending ? "Saving..." : "Save Deal"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block space-y-1 ${className}`}>
      <span className="text-xs font-semibold text-text-secondary">{label}</span>
      {children}
    </label>
  );
}
