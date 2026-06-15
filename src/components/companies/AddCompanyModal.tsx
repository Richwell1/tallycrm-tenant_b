import { useState } from "react";
import { toast } from "sonner";
import { useCompanyManagers, useCreateCompany } from "@/lib/companies-data";

interface AddCompanyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const initialState = {
  name: "",
  industry: "",
  email: "",
  phone: "",
  website: "",
  linkedin: "",
  address: "",
  city: "",
  country: "United States",
  account_manager_id: "",
  notes: "",
  rating: "4",
};

export function AddCompanyModal({ open, onOpenChange }: AddCompanyModalProps) {
  const [values, setValues] = useState(initialState);
  const create = useCreateCompany();
  const managers = useCompanyManagers();

  if (!open) return null;

  function set<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function close() {
    if (!create.isPending) onOpenChange(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.name.trim()) {
      toast.error("Company name is required");
      return;
    }

    create.mutate(
      {
        name: values.name.trim(),
        industry: clean(values.industry),
        email: clean(values.email),
        phone: clean(values.phone),
        website: clean(values.website),
        linkedin: clean(values.linkedin),
        address: clean(values.address),
        city: clean(values.city),
        country: clean(values.country),
        account_manager_id: clean(values.account_manager_id),
        notes: clean(values.notes),
        rating: Number(values.rating) || 4,
      },
      {
        onSuccess: () => {
          toast.success("Company saved");
          setValues(initialState);
          onOpenChange(false);
        },
        onError: (error) =>
          toast.error("Could not save company", { description: (error as Error).message }),
      },
    );
  }

  const selectedManager = managers.data?.find(
    (manager) => manager.id === values.account_manager_id,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-[720px] flex-col overflow-hidden rounded-xl bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <span className="material-symbols-outlined">add_business</span>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">Add New Company</h2>
              <p className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                Corporate Entry System
              </p>
            </div>
          </div>
          <button
            onClick={close}
            className="text-text-muted transition-colors hover:text-foreground"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <div>
              <FieldLabel>Company Logo</FieldLabel>
              <div className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted p-6 transition-colors hover:border-primary">
                <span className="material-symbols-outlined text-[40px] text-text-muted">
                  cloud_upload
                </span>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  Drag and drop logo or <span className="text-primary underline">browse</span>
                </p>
                <p className="mt-1 text-[11px] font-semibold text-text-muted">PNG, JPG up to 5MB</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <Field label="Company Name">
                <input
                  className="company-input"
                  value={values.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="e.g. Acme Corp"
                />
              </Field>
              <Field label="Industry">
                <select
                  className="company-input"
                  value={values.industry}
                  onChange={(e) => set("industry", e.target.value)}
                >
                  <option value="">Select Industry</option>
                  <option>Technology</option>
                  <option>Manufacturing</option>
                  <option>Healthcare</option>
                  <option>Finance</option>
                  <option>Consumer Retail</option>
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <Field label="Primary Email" icon="mail">
                <input
                  type="email"
                  className="company-input pl-10"
                  value={values.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="contact@company.com"
                />
              </Field>
              <Field label="Phone Number" icon="call">
                <input
                  type="tel"
                  className="company-input pl-10"
                  value={values.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="+1 (555) 000-0000"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <Field label="Website URL">
                <div className="flex">
                  <span className="flex h-[38px] items-center rounded-l border border-r-0 border-border bg-muted px-2 text-xs italic text-text-muted">
                    https://
                  </span>
                  <input
                    className="company-input rounded-l-none"
                    value={values.website}
                    onChange={(e) => set("website", e.target.value)}
                    placeholder="www.example.com"
                  />
                </div>
              </Field>
              <Field label="LinkedIn Profile">
                <input
                  className="company-input"
                  value={values.linkedin}
                  onChange={(e) => set("linkedin", e.target.value)}
                  placeholder="linkedin.com/company/..."
                />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <Field label="Street Address">
                <input
                  className="company-input"
                  value={values.address}
                  onChange={(e) => set("address", e.target.value)}
                  placeholder="123 Business Way"
                />
              </Field>
              <Field label="City">
                <input
                  className="company-input"
                  value={values.city}
                  onChange={(e) => set("city", e.target.value)}
                  placeholder="San Francisco"
                />
              </Field>
              <Field label="Country">
                <select
                  className="company-input"
                  value={values.country}
                  onChange={(e) => set("country", e.target.value)}
                >
                  <option>United States</option>
                  <option>Canada</option>
                  <option>United Kingdom</option>
                  <option>Germany</option>
                  <option>Ghana</option>
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <Field label="Account Manager">
                <div className="relative">
                  <select
                    className="company-input pl-10"
                    value={values.account_manager_id}
                    onChange={(e) => set("account_manager_id", e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {managers.data?.map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.full_name ?? "Unnamed user"}
                      </option>
                    ))}
                  </select>
                  <div className="absolute left-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full border border-border bg-primary-light text-[10px] font-bold text-primary">
                    {selectedManager?.avatar_url ? (
                      <img
                        src={selectedManager.avatar_url}
                        alt={selectedManager.full_name ?? "Manager"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      initials(selectedManager?.full_name ?? "U")
                    )}
                  </div>
                </div>
              </Field>
              <Field label="Rating">
                <select
                  className="company-input"
                  value={values.rating}
                  onChange={(e) => set("rating", e.target.value)}
                >
                  <option value="5">5 stars</option>
                  <option value="4">4 stars</option>
                  <option value="3">3 stars</option>
                  <option value="2">2 stars</option>
                  <option value="1">1 star</option>
                </select>
              </Field>
            </div>

            <Field label="Internal Notes">
              <textarea
                className="min-h-[96px] w-full resize-none rounded border border-border bg-card p-3 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                value={values.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Add any relevant background information about the company..."
              />
            </Field>
          </div>
        </form>

        <div className="flex items-center justify-end gap-4 border-t border-border bg-muted px-6 py-4">
          <button
            onClick={close}
            className="h-[38px] rounded px-6 text-sm font-semibold text-text-secondary hover:bg-border"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={create.isPending}
            className="h-[38px] rounded bg-danger px-6 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition-all hover:brightness-110 disabled:opacity-60"
          >
            {create.isPending ? "Saving..." : "Save Company"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <div className="relative mt-2">
        {icon ? (
          <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-text-muted">
            {icon}
          </span>
        ) : null}
        {children}
      </div>
    </label>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
      {children}
    </span>
  );
}

function clean(value: string) {
  return value.trim() || null;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
