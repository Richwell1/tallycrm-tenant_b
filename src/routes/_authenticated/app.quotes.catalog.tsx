import { createFileRoute, Link } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { ErrorState, RoleGuard, TableSkeleton } from "@/components/common";
import { PageHeader } from "@/components/layout";
import { formatMoney } from "@/lib/format";
import {
  type CatalogItemInput,
  type QuoteCatalogItemRow,
  useDeleteCatalogItem,
  useQuoteCatalog,
  useSaveCatalogItem,
} from "@/lib/quotes-data";
import { useAppSettings, useSaveAppSettings } from "@/lib/settings-data";

export const Route = createFileRoute("/_authenticated/app/quotes/catalog")({
  component: QuoteCatalogPage,
});

const EMPTY_ITEM: CatalogItemInput = {
  name: "",
  description: "",
  unit: "unit",
  unit_price: 0,
  currency: "GHS",
  tax_rate: 0,
  category: "",
  is_active: true,
};

function QuoteCatalogPage() {
  return (
    <RoleGuard
      allow={["admin", "manager"]}
      fallback={
        <ErrorState
          title="Managers only"
          description="The quote catalog and document defaults are managed by admins and managers."
        />
      }
    >
      <CatalogEditor />
    </RoleGuard>
  );
}

function CatalogEditor() {
  const { data: catalog, isLoading, isError, error, refetch } = useQuoteCatalog();
  const { data: settings } = useAppSettings();
  const saveItem = useSaveCatalogItem();
  const deleteItem = useDeleteCatalogItem();
  const [draft, setDraft] = useState<CatalogItemInput>(EMPTY_ITEM);

  useEffect(() => {
    if (!settings) return;
    setDraft((current) =>
      current.id || current.currency !== "GHS"
        ? current
        : {
            ...current,
            currency: settings.default_currency,
            tax_rate: settings.quote_default_tax_rate,
          },
    );
  }, [settings]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!draft.name.trim()) {
      toast.error("Item name is required");
      return;
    }
    try {
      await saveItem.mutateAsync(draft);
      toast.success(draft.id ? "Catalog item updated" : "Catalog item added");
      setDraft({ ...EMPTY_ITEM, currency: draft.currency, tax_rate: draft.tax_rate });
    } catch (err) {
      toast.error("Could not save the item", { description: (err as Error).message });
    }
  }

  function editItem(item: QuoteCatalogItemRow) {
    setDraft({
      id: item.id,
      name: item.name,
      description: item.description ?? "",
      unit: item.unit,
      unit_price: Number(item.unit_price),
      currency: item.currency,
      tax_rate: Number(item.tax_rate),
      category: item.category ?? "",
      is_active: item.is_active,
    });
  }

  async function removeItem(item: QuoteCatalogItemRow) {
    if (!window.confirm(`Remove "${item.name}" from the catalog?`)) return;
    try {
      await deleteItem.mutateAsync(item.id);
      toast.success("Catalog item removed");
      if (draft.id === item.id) setDraft(EMPTY_ITEM);
    } catch (err) {
      toast.error("Could not remove the item", { description: (err as Error).message });
    }
  }

  return (
    <>
      <PageHeader
        title="Quote Catalog"
        breadcrumbs={[{ label: "Quotations", to: "/app/quotes" }, { label: "Catalog" }]}
        count={catalog?.length}
        actions={
          <Link
            to="/app/quotes"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[13px] font-semibold hover:bg-surface-hover"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back to quotations
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <header className="border-b border-border px-6 py-4">
            <h2 className="text-[16px] font-semibold text-foreground">Products &amp; services</h2>
            <p className="text-xs text-text-secondary">
              Reusable lines that sales reps can drop into any quotation.
            </p>
          </header>

          {isLoading ? (
            <TableSkeleton rows={5} columns={4} />
          ) : isError ? (
            <ErrorState
              description={(error as Error)?.message ?? "Could not load the catalog"}
              onRetry={() => refetch()}
            />
          ) : (catalog?.length ?? 0) === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-text-muted">
              No catalog items yet. Add one on the right.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted text-[11px] uppercase tracking-wide text-text-secondary">
                    <th className="px-4 py-3 text-left font-semibold">Item</th>
                    <th className="px-4 py-3 text-left font-semibold">Unit</th>
                    <th className="px-4 py-3 text-right font-semibold">Price</th>
                    <th className="px-4 py-3 text-right font-semibold">Tax</th>
                    <th className="w-24 px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {catalog!.map((item) => (
                    <tr key={item.id} className="border-b border-border/70">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">
                          {item.name}
                          {!item.is_active ? (
                            <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-text-muted">
                              Inactive
                            </span>
                          ) : null}
                        </p>
                        {item.description ? (
                          <p className="text-xs text-text-secondary">{item.description}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{item.unit}</td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground">
                        {formatMoney(Number(item.unit_price), item.currency)}
                      </td>
                      <td className="px-4 py-3 text-right text-text-secondary">
                        {Number(item.tax_rate)}%
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => editItem(item)}
                            title="Edit"
                            className="rounded-md p-1.5 text-text-muted hover:bg-muted hover:text-foreground"
                          >
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => removeItem(item)}
                            title="Remove"
                            className="rounded-md p-1.5 text-text-muted hover:bg-danger-light hover:text-danger"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-[16px] font-semibold text-foreground">
              {draft.id ? "Edit item" : "Add item"}
            </h2>

            <div className="mt-4 space-y-4">
              <Field label="Name">
                <input
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  className="deal-input"
                  placeholder="e.g. TallyPrime Silver licence"
                />
              </Field>
              <Field label="Description">
                <textarea
                  value={draft.description ?? ""}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                  className="min-h-16 w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Unit">
                  <input
                    value={draft.unit}
                    onChange={(event) => setDraft({ ...draft, unit: event.target.value })}
                    className="deal-input"
                  />
                </Field>
                <Field label="Category">
                  <input
                    value={draft.category ?? ""}
                    onChange={(event) => setDraft({ ...draft, category: event.target.value })}
                    className="deal-input"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Price">
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={draft.unit_price}
                    onChange={(event) =>
                      setDraft({ ...draft, unit_price: Number(event.target.value) || 0 })
                    }
                    className="deal-input"
                  />
                </Field>
                <Field label="Currency">
                  <input
                    value={draft.currency}
                    onChange={(event) => setDraft({ ...draft, currency: event.target.value })}
                    className="deal-input"
                  />
                </Field>
                <Field label="Tax %">
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={draft.tax_rate}
                    onChange={(event) =>
                      setDraft({ ...draft, tax_rate: Number(event.target.value) || 0 })
                    }
                    className="deal-input"
                  />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={draft.is_active}
                  onChange={(event) => setDraft({ ...draft, is_active: event.target.checked })}
                  className="h-4 w-4 rounded border-border"
                />
                Available for new quotes
              </label>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="submit"
                disabled={saveItem.isPending}
                className="flex-1 rounded-lg bg-cta px-4 py-2 text-xs font-semibold text-cta-foreground hover:bg-cta-hover disabled:opacity-60"
              >
                {saveItem.isPending ? "Saving..." : draft.id ? "Save changes" : "Add to catalog"}
              </button>
              {draft.id ? (
                <button
                  type="button"
                  onClick={() => setDraft(EMPTY_ITEM)}
                  className="rounded-lg border border-border px-4 py-2 text-xs font-semibold hover:bg-secondary"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>

          <QuoteDefaultsPanel />
        </aside>
      </div>
    </>
  );
}

function QuoteDefaultsPanel() {
  const { data: settings } = useAppSettings();
  const saveSettings = useSaveAppSettings();
  const [prefix, setPrefix] = useState("QT");
  const [nodePrefix, setNodePrefix] = useState("");
  const [taxRate, setTaxRate] = useState(0);
  const [validityDays, setValidityDays] = useState(30);
  const [terms, setTerms] = useState("");
  const [footer, setFooter] = useState("");

  useEffect(() => {
    if (!settings) return;
    setPrefix(settings.quote_number_prefix);
    setNodePrefix(settings.quote_number_node_prefix ?? "");
    setTaxRate(Number(settings.quote_default_tax_rate));
    setValidityDays(Number(settings.quote_default_validity_days));
    setTerms(settings.quote_terms ?? "");
    setFooter(settings.quote_footer_note ?? "");
  }, [settings]);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    try {
      await saveSettings.mutateAsync({
        quote_number_prefix: prefix.trim() || "QT",
        quote_number_node_prefix: nodePrefix.trim() || null,
        quote_default_tax_rate: taxRate,
        quote_default_validity_days: validityDays,
        quote_terms: terms.trim() || null,
        quote_footer_note: footer.trim() || null,
      });
      toast.success("Quote defaults saved");
    } catch (err) {
      toast.error("Could not save defaults", { description: (err as Error).message });
    }
  }

  return (
    <form onSubmit={handleSave} className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-[16px] font-semibold text-foreground">Document defaults</h2>
      <p className="text-xs text-text-secondary">Applied to every new quotation.</p>

      <div className="mt-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Number prefix">
            <input
              value={prefix}
              onChange={(event) => setPrefix(event.target.value)}
              className="deal-input"
            />
          </Field>
          <Field
            label="Node code"
            hint="Set per branch install so offline nodes never mint the same number"
          >
            <input
              value={nodePrefix}
              onChange={(event) => setNodePrefix(event.target.value)}
              className="deal-input"
              placeholder="e.g. ACC"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Default tax %">
            <input
              type="number"
              min={0}
              step={0.01}
              value={taxRate}
              onChange={(event) => setTaxRate(Number(event.target.value) || 0)}
              className="deal-input"
            />
          </Field>
          <Field label="Valid for (days)">
            <input
              type="number"
              min={1}
              value={validityDays}
              onChange={(event) => setValidityDays(Number(event.target.value) || 30)}
              className="deal-input"
            />
          </Field>
        </div>
        <Field label="Default terms">
          <textarea
            value={terms}
            onChange={(event) => setTerms(event.target.value)}
            className="min-h-20 w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </Field>
        <Field label="Document footer">
          <textarea
            value={footer}
            onChange={(event) => setFooter(event.target.value)}
            className="min-h-16 w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </Field>
      </div>

      <button
        type="submit"
        disabled={saveSettings.isPending}
        className="mt-5 w-full rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
      >
        {saveSettings.isPending ? "Saving..." : "Save defaults"}
      </button>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
        {label}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-text-muted">{hint}</span> : null}
    </label>
  );
}
