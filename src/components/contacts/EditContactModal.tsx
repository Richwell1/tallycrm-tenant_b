import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useModalA11y } from "@/components/common/use-modal-a11y";
import {
  type ContactSummary,
  useContactFormOptions,
  useUpdateContact,
} from "@/lib/contacts-data";

interface EditContactModalProps {
  contact: ContactSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type FormState = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  job_title: string;
  company_id: string;
  tags: string;
  assigned_to: string;
  notes: string;
};

function fromContact(contact: ContactSummary): FormState {
  return {
    first_name: contact.first_name ?? "",
    last_name: contact.last_name ?? "",
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    job_title: contact.job_title ?? "",
    company_id: contact.company_id ?? "",
    tags: (contact.tags ?? []).join(", "),
    assigned_to: contact.assigned_to ?? "",
    notes: contact.notes ?? "",
  };
}

export function EditContactModal({ contact, open, onOpenChange }: EditContactModalProps) {
  const [values, setValues] = useState<FormState>(() => fromContact(contact));
  const update = useUpdateContact();
  const options = useContactFormOptions();
  const modal = useModalA11y(open, onOpenChange, { disabled: update.isPending });

  useEffect(() => {
    if (open) setValues(fromContact(contact));
  }, [open, contact]);

  if (!open) return null;

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function close() {
    if (!update.isPending) onOpenChange(false);
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

    update.mutate(
      {
        id: contact.id,
        first_name: values.first_name.trim(),
        last_name: values.last_name.trim(),
        email: clean(values.email),
        phone: clean(values.phone),
        job_title: clean(values.job_title),
        company_id: clean(values.company_id),
        assigned_to: clean(values.assigned_to),
        tags: values.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        notes: clean(values.notes),
      },
      {
        onSuccess: () => {
          toast.success("Contact updated");
          onOpenChange(false);
        },
        onError: (error) =>
          toast.error("Could not update contact", { description: (error as Error).message }),
      },
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-contact-title"
      ref={modal.ref}
      onKeyDown={modal.onKeyDown}
    >
      <div className="flex w-full max-w-[720px] flex-col overflow-hidden rounded-xl bg-card shadow-2xl">
        <header className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">edit</span>
            <h2 id="edit-contact-title" className="text-xl font-semibold text-foreground">
              Edit Contact
            </h2>
          </div>
          <button
            onClick={close}
            className="rounded-full p-2 text-text-secondary transition-colors hover:bg-muted"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <form onSubmit={onSubmit} className="max-h-[76vh] overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <Field label="First Name" required>
                <input
                  className="contact-input"
                  value={values.first_name}
                  onChange={(e) => set("first_name", e.target.value)}
                />
              </Field>
              <Field label="Last Name" required>
                <input
                  className="contact-input"
                  value={values.last_name}
                  onChange={(e) => set("last_name", e.target.value)}
                />
              </Field>
              <Field label="Email Address" required>
                <input
                  type="email"
                  className="contact-input"
                  value={values.email}
                  onChange={(e) => set("email", e.target.value)}
                />
              </Field>
              <Field label="Phone">
                <input
                  type="tel"
                  className="contact-input"
                  value={values.phone}
                  onChange={(e) => set("phone", e.target.value)}
                />
              </Field>
            </div>

            <div className="space-y-4">
              <Field label="Job Title">
                <input
                  className="contact-input"
                  value={values.job_title}
                  onChange={(e) => set("job_title", e.target.value)}
                />
              </Field>
              <Field label="Company">
                <select
                  className="contact-input"
                  value={values.company_id}
                  onChange={(e) => set("company_id", e.target.value)}
                >
                  <option value="">No company</option>
                  {options.data?.companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          <div className="mt-6 space-y-4 border-t border-border pt-6">
            <Field label="Tags">
              <input
                className="contact-input"
                value={values.tags}
                onChange={(e) => set("tags", e.target.value)}
                placeholder="Comma-separated tags"
              />
            </Field>

            <Field label="Assigned To">
              <select
                className="contact-input"
                value={values.assigned_to}
                onChange={(e) => set("assigned_to", e.target.value)}
              >
                <option value="">Unassigned</option>
                {options.data?.profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.full_name ?? "Unnamed user"}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Notes">
              <textarea
                className="min-h-[96px] w-full resize-none rounded border border-border bg-card p-3 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                value={values.notes}
                onChange={(e) => set("notes", e.target.value)}
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
            disabled={update.isPending}
            className="rounded bg-primary px-6 py-2 text-sm font-bold text-white shadow-[var(--shadow-sm)] transition-all hover:bg-primary-dark active:scale-95 disabled:opacity-60"
          >
            {update.isPending ? "Saving..." : "Save Changes"}
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
