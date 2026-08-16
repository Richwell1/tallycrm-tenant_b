import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { UnitInput } from "@/components/common";
import {
  type DeliveryNoteDetail,
  type DeliveryNoteItemDraft,
  useSaveDeliveryNoteItems,
} from "@/lib/delivery-notes-data";
import type { QuoteCatalogItemRow } from "@/lib/quotes-data";

function toDraft(note: DeliveryNoteDetail): DeliveryNoteItemDraft[] {
  return note.items.map((item) => ({
    id: item.id,
    catalog_item_id: item.catalog_item_id,
    name: item.name,
    description: item.description,
    unit: item.unit,
    quantity: Number(item.quantity),
  }));
}

export function DeliveryNoteItemsEditor({
  deliveryNote,
  catalog,
  readOnly,
  onDirtyChange,
}: {
  deliveryNote: DeliveryNoteDetail;
  catalog: QuoteCatalogItemRow[];
  readOnly: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [items, setItems] = useState(() => toDraft(deliveryNote));
  const save = useSaveDeliveryNoteItems();
  const signature = useMemo(
    () =>
      JSON.stringify({
        updated: deliveryNote.updated_at,
        items: deliveryNote.items.map((item) => [item.id, item.updated_at]),
      }),
    [deliveryNote],
  );
  const seeded = useRef(signature);
  useEffect(() => {
    if (seeded.current !== signature) {
      seeded.current = signature;
      setItems(toDraft(deliveryNote));
    }
  }, [deliveryNote, signature]);
  const dirty = JSON.stringify(items) !== JSON.stringify(toDraft(deliveryNote));
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  function patch(index: number, change: Partial<DeliveryNoteItemDraft>) {
    setItems((current) =>
      current.map((item, position) => (position === index ? { ...item, ...change } : item)),
    );
  }
  function addCatalog(id: string) {
    const item = catalog.find((entry) => entry.id === id);
    if (item)
      setItems((current) => [
        ...current,
        {
          catalog_item_id: item.id,
          name: item.name,
          description: item.description,
          unit: item.unit,
          quantity: 1,
        },
      ]);
  }
  async function handleSave() {
    if (items.some((item) => !item.name.trim()))
      return void toast.error("Every item needs a description");
    try {
      await save.mutateAsync({ deliveryNoteId: deliveryNote.id, items });
      toast.success("Delivery note updated");
    } catch (error) {
      toast.error("Could not save the delivery note", { description: (error as Error).message });
    }
  }
  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <h2 className="text-[16px] font-semibold">Dispatched Items</h2>
          <p className="text-xs text-text-secondary">
            {readOnly
              ? "This delivery note is locked."
              : "Record descriptions and quantities only; delivery notes never show prices."}
          </p>
        </div>
        {!readOnly ? (
          <div className="flex gap-2">
            <select
              value=""
              onChange={(event) => event.target.value && addCatalog(event.target.value)}
              className="h-9 rounded-lg border border-border bg-card px-3 text-xs"
            >
              <option value="">Add from catalog...</option>
              {catalog.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() =>
                setItems((current) => [
                  ...current,
                  { name: "", description: null, unit: "unit", quantity: 1, catalog_item_id: null },
                ])
              }
              className="rounded-lg border border-border px-3 py-2 text-xs font-semibold"
            >
              Add item
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || save.isPending}
              className="rounded-lg bg-cta px-4 py-2 text-xs font-semibold text-cta-foreground disabled:opacity-50"
            >
              {save.isPending ? "Saving..." : dirty ? "Save changes" : "Saved"}
            </button>
          </div>
        ) : null}
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[650px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted text-[11px] uppercase text-text-secondary">
              <th className="px-4 py-3 text-left">Description</th>
              <th className="w-28 px-3 py-3 text-right">Qty</th>
              <th className="w-28 px-3 py-3 text-left">Unit</th>
              {!readOnly ? <th className="w-16" /> : null}
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item.id ?? index} className="border-b border-border/70">
                <td className="px-4 py-2">
                  <input
                    value={item.name}
                    readOnly={readOnly}
                    onChange={(event) => patch(index, { name: event.target.value })}
                    placeholder="Item"
                    className="w-full bg-transparent px-2 py-1.5 font-medium"
                  />
                  <input
                    value={item.description ?? ""}
                    readOnly={readOnly}
                    onChange={(event) => patch(index, { description: event.target.value })}
                    placeholder="Optional detail"
                    className="w-full bg-transparent px-2 py-1 text-xs text-text-secondary"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={0}
                    step={0.001}
                    value={item.quantity}
                    readOnly={readOnly}
                    onChange={(event) =>
                      patch(index, { quantity: Number(event.target.value) || 0 })
                    }
                    className="w-full bg-transparent text-right"
                  />
                </td>
                <td className="px-3 py-2">
                  <UnitInput
                    value={item.unit}
                    readOnly={readOnly}
                    onChange={(unit) => patch(index, { unit })}
                  />
                </td>
                {!readOnly ? (
                  <td>
                    <button
                      type="button"
                      aria-label="Remove item"
                      onClick={() =>
                        setItems((current) =>
                          current.filter((_item, position) => position !== index),
                        )
                      }
                      className="p-2 text-danger"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
            {!items.length ? (
              <tr>
                <td colSpan={readOnly ? 3 : 4} className="px-4 py-10 text-center text-text-muted">
                  No items yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
