import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useModalA11y } from "@/components/common/use-modal-a11y";
import { supabase } from "@/integrations/supabase/client";
import { type CompanySummary, useCompanyManagers, useUpdateCompany } from "@/lib/companies-data";

interface EditCompanyModalProps {
  company: CompanySummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type FormState = {
  name: string;
  industry: string;
  email: string;
  phone: string;
  website: string;
  linkedin: string;
  address: string;
  city: string;
  country: string;
  account_manager_id: string;
  notes: string;
  rating: string;
};

function fromCompany(company: CompanySummary): FormState {
  return {
    name: company.name ?? "",
    industry: company.industry ?? "",
    email: company.email ?? "",
    phone: company.phone ?? "",
    website: company.website ?? "",
    linkedin: company.linkedin ?? "",
    address: company.address ?? "",
    city: company.city ?? "",
    country: company.country ?? "United States",
    account_manager_id: company.account_manager_id ?? "",
    notes: company.notes ?? "",
    rating: String(company.rating ?? 4),
  };
}

export function EditCompanyModal({ company, open, onOpenChange }: EditCompanyModalProps) {
  const [values, setValues] = useState<FormState>(() => fromCompany(company));
  const [logoPreview, setLogoPreview] = useState<string | null>(company.logo_url ?? null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const update = useUpdateCompany();
  const managers = useCompanyManagers();
  const modal = useModalA11y(open, onOpenChange, { disabled: update.isPending || uploading });

  useEffect(() => {
    if (open) {
      setValues(fromCompany(company));
      setLogoPreview(company.logo_url ?? null);
    }
  }, [open, company]);

  if (!open) return null;

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function close() {
    if (!update.isPending && !uploading) onOpenChange(false);
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo must be under 5MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `company-logos/${company.id}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("public")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("public").getPublicUrl(path);
      setLogoPreview(data.publicUrl);
      await update.mutateAsync({ id: company.id, logo_url: data.publicUrl });
      toast.success("Logo updated");
    } catch (error) {
      toast.error("Logo upload failed", { description: (error as Error).message });
    } finally {
      setUploading(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.name.trim()) {
      toast.error("Company name is required");
      return;
    }
    if (values.email.trim() && !isEmail(values.email)) {
      toast.error("Enter a valid email address");
      return;
    }
    if (values.website.trim() && !isHostname(values.website)) {
      toast.error("Enter a valid website domain");
      return;
    }

    update.mutate(
      {
        id: company.id,
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
          toast.success("Company updated");
          onOpenChange(false);
        },
        onError: (error) =>
          toast.error("Could not update company", { description: (error as Error).message }),
      },
    );
  }

  const selectedManager = managers.data?.find((m) => m.id === values.account_manager_id);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-company-title"
      ref={modal.ref}
      onKeyDown={modal.onKeyDown}
    >
      <div className="flex max-h-[92vh] w-full max-w-[720px] flex-col overflow-hidden rounded-xl bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <span className="material-symbols-outlined">edit</span>
            </div>
            <div>
              <h2 id="edit-company-title" className="text-xl font-semibold text-foreground">
                Edit Company
              </h2>
              <p className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                {company.name}
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
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={handleLogoChange}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="mt-2 flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted p-6 transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    className="mb-2 h-16 w-16 rounded-lg object-contain"
                  />
                ) : (
                  <span className="material-symbols-outlined text-[40px] text-text-muted">
                    cloud_upload
                  </span>
                )}
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {uploading
                    ? "Uploading..."
                    : logoPreview
                      ? "Click to change logo"
                      : "Drag and drop logo or "}
                  {!uploading && !logoPreview && (
                    <span className="text-primary underline">browse</span>
                  )}
                </p>
                <p className="mt-1 text-[11px] font-semibold text-text-muted">PNG, JPG up to 5MB</p>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <Field label="Company Name">
                <input
                  className="company-input"
                  value={values.name}
                  onChange={(e) => set("name", e.target.value)}
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
                />
              </Field>
              <Field label="Phone Number" icon="call">
                <input
                  type="tel"
                  className="company-input pl-10"
                  value={values.phone}
                  onChange={(e) => set("phone", e.target.value)}
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
                  />
                </div>
              </Field>
              <Field label="LinkedIn Profile">
                <input
                  className="company-input"
                  value={values.linkedin}
                  onChange={(e) => set("linkedin", e.target.value)}
                />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <Field label="Street Address">
                <input
                  className="company-input"
                  value={values.address}
                  onChange={(e) => set("address", e.target.value)}
                />
              </Field>
              <Field label="City">
                <input
                  className="company-input"
                  value={values.city}
                  onChange={(e) => set("city", e.target.value)}
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
                      managerInitials(selectedManager?.full_name ?? "")
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
            disabled={update.isPending || uploading}
            className="h-[38px] rounded bg-primary px-6 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition-all hover:brightness-110 disabled:opacity-60"
          >
            {update.isPending ? "Saving..." : "Save Changes"}
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

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isHostname(value: string) {
  return /^(https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(value.trim());
}

function managerInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
