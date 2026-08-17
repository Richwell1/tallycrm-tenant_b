import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { toast } from "sonner";
import { useModalA11y } from "@/components/common/use-modal-a11y";
import {
  type WarehouseLocationRow,
  useSaveWarehouseLocation,
} from "@/lib/warehouse-locations-data";

interface WarehouseLocationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location?: WarehouseLocationRow | null;
}

export function WarehouseLocationModal({
  open,
  onOpenChange,
  location,
}: WarehouseLocationModalProps) {
  const saveLocation = useSaveWarehouseLocation();
  const modal = useModalA11y(open, onOpenChange, { disabled: saveLocation.isPending });
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    setCode(location?.code ?? "");
    setName(location?.name ?? "");
    setAddress(location?.address ?? "");
    setContactName(location?.contact_name ?? "");
    setContactPhone(location?.contact_phone ?? "");
    setIsActive(location?.is_active ?? true);
  }, [location, open]);

  if (!open) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await saveLocation.mutateAsync({
        id: location?.id,
        code,
        name,
        address: address.trim() || null,
        contact_name: contactName.trim() || null,
        contact_phone: contactPhone.trim() || null,
        is_active: isActive,
      });
      toast.success(location ? "Warehouse updated" : "Warehouse added");
      onOpenChange(false);
    } catch (error) {
      toast.error(location ? "Could not update warehouse" : "Could not add warehouse", {
        description: (error as Error).message,
      });
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/60 p-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="warehouse-location-title"
      ref={modal.ref}
      onKeyDown={modal.onKeyDown}
    >
      <div className="flex max-h-[90vh] w-full max-w-[680px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <header className="flex items-center justify-between border-b border-border bg-muted px-8 py-6">
          <div>
            <h2 id="warehouse-location-title" className="text-[22px] font-semibold">
              {location ? "Edit Warehouse" : "Add Warehouse"}
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Manage a site goods can be dispatched from.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-full p-2 text-text-secondary hover:bg-danger-light hover:text-danger"
            aria-label="Close"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-8 py-8">
          <div className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Code" required>
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  className="deal-input font-mono uppercase"
                  placeholder="ACC-01"
                  maxLength={40}
                  required
                  autoFocus
                />
              </Field>
              <Field label="Name" required>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="deal-input"
                  placeholder="Accra Main Warehouse"
                  maxLength={200}
                  required
                />
              </Field>
            </div>
            <Field label="Address">
              <textarea
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                className="min-h-24 w-full resize-y rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                maxLength={2000}
              />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Contact name">
                <input
                  value={contactName}
                  onChange={(event) => setContactName(event.target.value)}
                  className="deal-input"
                  maxLength={200}
                />
              </Field>
              <Field label="Contact phone">
                <input
                  value={contactPhone}
                  onChange={(event) => setContactPhone(event.target.value)}
                  className="deal-input"
                  type="tel"
                  maxLength={50}
                />
              </Field>
            </div>
            <label className="flex items-center gap-3 rounded-lg border border-border px-4 py-3">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              <span className="text-sm font-medium">Active dispatch location</span>
            </label>
          </div>
          <div className="mt-8 flex justify-end gap-4 border-t border-border pt-6">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg border border-border bg-card px-6 py-2 text-xs font-semibold hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saveLocation.isPending}
              className="rounded-lg bg-cta px-6 py-2 text-xs font-semibold text-cta-foreground hover:bg-cta-hover disabled:opacity-60"
            >
              {saveLocation.isPending ? "Saving..." : location ? "Save changes" : "Add warehouse"}
            </button>
          </div>
        </form>
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
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
        {label}
        {required ? <span className="ml-1 text-danger">*</span> : null}
      </span>
      {children}
    </label>
  );
}
