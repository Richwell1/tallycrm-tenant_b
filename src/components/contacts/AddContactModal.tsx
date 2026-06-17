import { useState } from "react";
import { toast } from "sonner";
import { useModalA11y } from "@/components/common/use-modal-a11y";
import { useAuth } from "@/lib/auth-context";
import { useContactFormOptions, useCreateContact } from "@/lib/contacts-data";

interface AddContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const initialState = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  mobile: "",
  job_title: "",
  company_id: "",
  country: "",
  city: "",
  tags: "",
  assigned_to: "",
  notes: "",
};

export function AddContactModal({ open, onOpenChange }: AddContactModalProps) {
  const { user } = useAuth();
  const [values, setValues] = useState(initialState);
  const create = useCreateContact();
  const options = useContactFormOptions();
  const modal = useModalA11y(open, onOpenChange, { disabled: create.isPending });

  if (!open) return null;

  function set<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function close() {
    if (!create.isPending) onOpenChange(false);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.first_name.trim() || !values.last_name.trim()) {
      toast.error("First and last name are required");
      return;
    }
    if (!values.email.trim() || !isEmail(values.email)) {
      toast.error("Enter a valid email address");
      return;
    }

    create.mutate(
      {
        first_name: values.first_name.trim(),
        last_name: values.last_name.trim(),
        email: clean(values.email),
        phone: clean(values.phone || values.mobile),
        job_title: clean(values.job_title),
        company_id: clean(values.company_id),
        assigned_to: clean(values.assigned_to) || user?.id || null,
        tags: values.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        notes: clean(values.notes),
      },
      {
        onSuccess: () => {
          toast.success("Contact saved");
          setValues(initialState);
          onOpenChange(false);
        },
        onError: (error) =>
          toast.error("Could not save contact", { description: (error as Error).message }),
      },
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-contact-title"
      ref={modal.ref}
      onKeyDown={modal.onKeyDown}
    >
      <div className="flex w-full max-w-[960px] flex-col overflow-hidden rounded-xl bg-card shadow-2xl">
        <header className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">person_add</span>
            <h2 id="add-contact-title" className="text-xl font-semibold text-foreground">
              Add Contact
            </h2>
          </div>
          <button
            onClick={close}
            className="rounded-full p-2 text-text-secondary transition-colors hover:bg-muted"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <form onSubmit={onSubmit} className="max-h-[80vh] overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <Field label="First Name" required>
                <input
                  className="contact-input"
                  value={values.first_name}
                  onChange={(e) => set("first_name", e.target.value)}
                  placeholder="e.g. Michael"
                />
              </Field>
              <Field label="Last Name" required>
                <input
                  className="contact-input"
                  value={values.last_name}
                  onChange={(e) => set("last_name", e.target.value)}
                  placeholder="e.g. Scott"
                />
              </Field>
              <Field label="Email Address" required>
                <input
                  type="email"
                  className="contact-input"
                  value={values.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="m.scott@dundermifflin.com"
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Phone">
                  <input
                    type="tel"
                    className="contact-input"
                    value={values.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    placeholder="+1..."
                  />
                </Field>
                <Field label="Mobile">
                  <input
                    type="tel"
                    className="contact-input"
                    value={values.mobile}
                    onChange={(e) => set("mobile", e.target.value)}
                    placeholder="+1..."
                  />
                </Field>
              </div>
            </div>

            <div className="space-y-4">
              <Field label="Job Title">
                <input
                  className="contact-input"
                  value={values.job_title}
                  onChange={(e) => set("job_title", e.target.value)}
                  placeholder="e.g. Regional Manager"
                />
              </Field>
              <Field label="Company">
                <div className="relative">
                  <select
                    className="contact-input pr-10"
                    value={values.company_id}
                    onChange={(e) => set("company_id", e.target.value)}
                  >
                    <option value="">Select company</option>
                    {options.data?.companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[20px] text-text-muted">
                    search
                  </span>
                </div>
              </Field>
              <Field label="Country">
                <select
                  className="contact-input"
                  value={values.country}
                  onChange={(e) => set("country", e.target.value)}
                >
                  <option value="">Select Country</option>
                  <option value="United States">United States</option>
                  <option value="United Kingdom">United Kingdom</option>
                  <option value="Canada">Canada</option>
                  <option value="Germany">Germany</option>
                  <option value="Ghana">Ghana</option>
                </select>
              </Field>
              <Field label="City">
                <input
                  className="contact-input"
                  value={values.city}
                  onChange={(e) => set("city", e.target.value)}
                  placeholder="e.g. Scranton"
                />
              </Field>
            </div>
          </div>

          <div className="mt-6 space-y-4 border-t border-border pt-6">
            <Field label="Tags">
              <div className="flex min-h-[38px] flex-wrap gap-1 rounded border border-border bg-muted/40 p-1">
                {values.tags
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter(Boolean)
                  .slice(0, 3)
                  .map((tag) => (
                    <span
                      key={tag}
                      className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary"
                    >
                      {tag}
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </span>
                  ))}
                <input
                  className="min-w-[140px] flex-1 border-none bg-transparent px-2 py-1 text-sm outline-none focus:ring-0"
                  value={values.tags}
                  onChange={(e) => set("tags", e.target.value)}
                  placeholder="Add tag..."
                />
              </div>
            </Field>

            <Field label="Assigned To">
              <div className="relative">
                <select
                  className="contact-input pr-10"
                  value={values.assigned_to}
                  onChange={(e) => set("assigned_to", e.target.value)}
                >
                  <option value="">Current User (Me)</option>
                  {options.data?.profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.full_name ?? "Unnamed user"}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">
                  arrow_drop_down
                </span>
              </div>
            </Field>

            <Field label="Notes">
              <textarea
                className="min-h-[96px] w-full resize-none rounded border border-border bg-card p-3 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                value={values.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Additional details about the contact..."
              />
            </Field>
          </div>
        </form>

        <footer className="flex items-center justify-end gap-4 border-t border-border bg-muted/40 px-6 py-4">
          <button
            onClick={close}
            className="rounded px-6 py-2 text-sm font-semibold text-text-secondary hover:bg-border"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={create.isPending}
            className="rounded bg-primary px-6 py-2 text-sm font-bold text-white shadow-[var(--shadow-sm)] transition-all hover:bg-primary-dark active:scale-95 disabled:opacity-60"
          >
            {create.isPending ? "Saving..." : "Save Contact"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-text-secondary">
        {label} {required ? <span className="text-danger">*</span> : null}
      </span>
      {children}
    </label>
  );
}

function clean(value: string) {
  return value.trim() || null;
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
