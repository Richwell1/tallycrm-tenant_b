import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UnitInput } from "@/components/common";
import { formatMoney } from "@/lib/format";
import { calculateQuoteTotals } from "@/lib/quote-totals";
import {
  type CreditNoteDetail,
  type CreditNoteLineItemDraft,
  useSaveCreditNoteLineItems,
} from "@/lib/credit-notes-data";
import type { QuoteCatalogItemRow } from "@/lib/quotes-data";

interface CreditNoteLineItemsEditorProps {
  creditNote: CreditNoteDetail;
  catalog: QuoteCatalogItemRow[];
  defaultTaxRate: number;
  /** Locked once the credit note is applied or void. */
  readOnly: boolean;
  /**
   * Notifies the parent when line edits are pending a save, along with
   * human-readable labels for exactly which fields changed.
   */
  onDirtyChange?: (dirty: boolean, changedFields: string[]) => void;
}

const LINE_FIELD_LABELS: Record<string, string> = {
  name: "item name",
  description: "item description",
  unit: "unit",
  quantity: "quantity",
  unit_price: "unit price",
  discount_percent: "line discount",
  tax_rate: "tax rate",
};

/** Human-readable list of the fields that differ from the saved credit note. */
function describeChanges(
  saved: CreditNoteLineItemDraft[],
  lines: CreditNoteLineItemDraft[],
): string[] {
  const changes: string[] = [];

  if (lines.length > saved.length) changes.push("added line items");
  if (lines.length < saved.length) changes.push("removed line items");

  const fields = new Set<string>();
  const shared = Math.min(saved.length, lines.length);
  for (let index = 0; index < shared; index += 1) {
    for (const key of Object.keys(LINE_FIELD_LABELS)) {
      const before = saved[index]?.[key as keyof CreditNoteLineItemDraft] ?? null;
      const after = lines[index]?.[key as keyof CreditNoteLineItemDraft] ?? null;
      if (before !== after) fields.add(LINE_FIELD_LABELS[key]!);
    }
  }
  for (const field of fields) changes.push(field);

  return changes;
}

function toDraft(creditNote: CreditNoteDetail): CreditNoteLineItemDraft[] {
  return creditNote.line_items.map((line) => ({
    id: line.id,
    catalog_item_id: line.catalog_item_id,
    name: line.name,
    description: line.description,
    unit: line.unit,
    quantity: Number(line.quantity),
    unit_price: Number(line.unit_price),
    discount_percent: Number(line.discount_percent),
    tax_rate: Number(line.tax_rate),
  }));
}

export function CreditNoteLineItemsEditor({
  creditNote,
  catalog,
  defaultTaxRate,
  readOnly,
  onDirtyChange,
}: CreditNoteLineItemsEditorProps) {
  const queryClient = useQueryClient();
  const [lines, setLines] = useState<CreditNoteLineItemDraft[]>(() => toDraft(creditNote));
  const saveLines = useSaveCreditNoteLineItems();

  // Re-seed only when the saved document actually changed, so a background
  // refetch never wipes what someone is typing.
  const serverSignature = useMemo(
    () =>
      JSON.stringify({
        updated: creditNote.updated_at,
        lines: creditNote.line_items.map((line) => [line.id, line.updated_at]),
      }),
    [creditNote],
  );
  const seeded = useRef(serverSignature);

  useEffect(() => {
    if (seeded.current === serverSignature) return;
    seeded.current = serverSignature;
    setLines(toDraft(creditNote));
  }, [creditNote, serverSignature]);

  // Preview only. The database is authoritative and recalculates on save.
  const totals = useMemo(() => calculateQuoteTotals(lines, "none", 0), [lines]);

  const changedFields = useMemo(
    () => describeChanges(toDraft(creditNote), lines),
    [lines, creditNote],
  );

  const dirty = changedFields.length > 0;
  const saving = saveLines.isPending;

  useEffect(() => {
    onDirtyChange?.(dirty, changedFields);
  }, [changedFields, dirty, onDirtyChange]);

  useEffect(() => () => onDirtyChange?.(false, []), [onDirtyChange]);

  function patchLine(index: number, patch: Partial<CreditNoteLineItemDraft>) {
    setLines((current) =>
      current.map((line, position) => (position === index ? { ...line, ...patch } : line)),
    );
  }

  function addBlankLine() {
    setLines((current) => [
      ...current,
      {
        name: "",
        description: null,
        unit: "unit",
        quantity: 1,
        unit_price: 0,
        discount_percent: 0,
        tax_rate: defaultTaxRate,
        catalog_item_id: null,
      },
    ]);
  }

  function addCatalogLine(itemId: string) {
    const item = catalog.find((entry) => entry.id === itemId);
    if (!item) return;
    setLines((current) => [
      ...current,
      {
        name: item.name,
        description: item.description,
        unit: item.unit,
        quantity: 1,
        unit_price: Number(item.unit_price),
        discount_percent: 0,
        tax_rate: Number(item.tax_rate),
        catalog_item_id: item.id,
      },
    ]);
  }

  function moveLine(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= lines.length) return;
    setLines((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleSave() {
    if (lines.some((line) => !line.name.trim())) {
      toast.error("Every item needs a description");
      return;
    }
    try {
      await saveLines.mutateAsync({ creditNoteId: creditNote.id, lines });
      // Wait for the authoritative credit note (server-recalculated totals)
      // before reporting success.
      await queryClient.refetchQueries({ queryKey: ["credit_note", creditNote.id] });
      toast.success("Credit note updated");
    } catch (error) {
      toast.error("Could not save the credit note", { description: (error as Error).message });
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <h2 className="text-[16px] font-semibold text-foreground">Credited Items</h2>
          <p className="text-xs text-text-secondary">
            {readOnly
              ? "This credit note is locked and can no longer be edited."
              : "Discounts and tax are optional — totals are recalculated by the database on save."}
          </p>
        </div>
        {!readOnly ? (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value=""
              onChange={(event) => {
                if (event.target.value) addCatalogLine(event.target.value);
              }}
              className="h-9 rounded-lg border border-border bg-card px-3 text-xs font-semibold outline-none"
            >
              <option value="">Add from catalog...</option>
              {catalog.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} — {formatMoney(Number(item.unit_price), item.currency)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addBlankLine}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold hover:bg-surface-hover"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Add item
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || saving}
              className="rounded-lg bg-cta px-4 py-2 text-xs font-semibold text-cta-foreground hover:bg-cta-hover disabled:opacity-50"
            >
              {saving ? "Saving..." : dirty ? "Save changes" : "Saved"}
            </button>
          </div>
        ) : null}
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted text-[11px] uppercase tracking-wide text-text-secondary">
              <th className="px-4 py-3 text-left font-semibold">Description</th>
              <th className="w-24 px-3 py-3 text-right font-semibold">Qty</th>
              <th className="w-24 px-3 py-3 text-left font-semibold">Unit</th>
              <th className="w-32 px-3 py-3 text-right font-semibold">Unit price</th>
              <th className="w-24 px-3 py-3 text-right font-semibold">Disc %</th>
              <th className="w-24 px-3 py-3 text-right font-semibold">Tax %</th>
              <th className="w-32 px-4 py-3 text-right font-semibold">Line total</th>
              {!readOnly ? <th className="w-24 px-3 py-3" /> : null}
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td
                  colSpan={readOnly ? 7 : 8}
                  className="px-4 py-10 text-center text-sm text-text-muted"
                >
                  No items yet. Add one from the catalog or start from a blank line.
                </td>
              </tr>
            ) : (
              lines.map((line, index) => (
                <tr key={line.id ?? `draft-${index}`} className="border-b border-border/70">
                  <td className="px-4 py-2 align-top">
                    <input
                      value={line.name}
                      readOnly={readOnly}
                      onChange={(event) => patchLine(index, { name: event.target.value })}
                      placeholder="Item or service"
                      className="w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm font-medium outline-none focus:border-border focus:bg-card"
                    />
                    <input
                      value={line.description ?? ""}
                      readOnly={readOnly}
                      onChange={(event) => patchLine(index, { description: event.target.value })}
                      placeholder="Optional detail"
                      className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-xs text-text-secondary outline-none focus:border-border focus:bg-card"
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <NumberCell
                      value={line.quantity}
                      readOnly={readOnly}
                      min={0}
                      step={0.001}
                      onChange={(value) => patchLine(index, { quantity: value })}
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <UnitInput
                      value={line.unit}
                      readOnly={readOnly}
                      onChange={(unit) => patchLine(index, { unit })}
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <NumberCell
                      value={line.unit_price}
                      readOnly={readOnly}
                      min={0}
                      step={0.01}
                      onChange={(value) => patchLine(index, { unit_price: value })}
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <NumberCell
                      value={line.discount_percent}
                      readOnly={readOnly}
                      min={0}
                      max={100}
                      step={0.01}
                      onChange={(value) => patchLine(index, { discount_percent: value })}
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <NumberCell
                      value={line.tax_rate}
                      readOnly={readOnly}
                      min={0}
                      step={0.01}
                      onChange={(value) => patchLine(index, { tax_rate: value })}
                    />
                  </td>
                  <td className="px-4 py-2 text-right align-top font-semibold text-foreground">
                    {formatMoney(totals.lines[index]?.line_total ?? 0, creditNote.currency)}
                  </td>
                  {!readOnly ? (
                    <td className="px-3 py-2 align-top">
                      <div className="flex items-center justify-end gap-0.5">
                        <IconButton
                          icon="arrow_upward"
                          label="Move up"
                          disabled={index === 0}
                          onClick={() => moveLine(index, -1)}
                        />
                        <IconButton
                          icon="arrow_downward"
                          label="Move down"
                          disabled={index === lines.length - 1}
                          onClick={() => moveLine(index, 1)}
                        />
                        <IconButton
                          icon="delete"
                          label="Remove item"
                          danger
                          onClick={() =>
                            setLines((current) =>
                              current.filter((_item, position) => position !== index),
                            )
                          }
                        />
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <footer className="flex flex-col gap-6 border-t border-border px-6 py-5 md:flex-row md:justify-end">
        <dl className="w-full max-w-sm space-y-2 text-sm">
          <Row label="Subtotal" value={formatMoney(totals.subtotal, creditNote.currency)} />
          <Row label="Tax" value={formatMoney(totals.tax_amount, creditNote.currency)} />
          <div className="flex items-center justify-between border-t border-border pt-3 text-[16px] font-bold text-foreground">
            <dt>Total credited</dt>
            <dd>{formatMoney(totals.total, creditNote.currency)}</dd>
          </div>
          {dirty ? (
            <p className="pt-1 text-right text-[11px] font-semibold text-warning">
              Unsaved changes to {changedFields.join(", ")} — the total above is a preview. Save
              changes to update the credited total.
            </p>
          ) : null}
        </dl>
      </footer>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-text-secondary">{label}</dt>
      <dd className="font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function NumberCell({
  value,
  onChange,
  readOnly,
  min,
  max,
  step,
}: {
  value: number;
  onChange: (value: number) => void;
  readOnly: boolean;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <input
      type="number"
      value={value}
      readOnly={readOnly}
      min={min}
      max={max}
      step={step}
      onChange={(event) => onChange(Number(event.target.value) || 0)}
      className="w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-right text-sm outline-none focus:border-border focus:bg-card"
    />
  );
}

function IconButton({
  icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md p-1.5 text-text-muted transition-colors disabled:opacity-30 ${
        danger ? "hover:bg-danger-light hover:text-danger" : "hover:bg-muted hover:text-foreground"
      }`}
    >
      <span className="material-symbols-outlined text-[16px]">{icon}</span>
    </button>
  );
}
