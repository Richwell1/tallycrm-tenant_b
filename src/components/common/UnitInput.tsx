import { useState } from "react";

/** Common billing units offered on quotation and invoice line items. */
export const COMMON_UNITS = [
  "unit",
  "item",
  "hour",
  "day",
  "week",
  "monthly",
  "yearly",
  "one-time",
  "service",
  "license",
  "session",
] as const;

const CUSTOM = "__custom__";

interface UnitInputProps {
  value: string;
  readOnly?: boolean;
  onChange: (value: string) => void;
}

/**
 * Unit picker shared by the quotation and invoice line editors: a dropdown of
 * the common units plus a free-text option for anything else.
 */
export function UnitInput({ value, readOnly = false, onChange }: UnitInputProps) {
  const isKnown = (COMMON_UNITS as readonly string[]).includes(value);
  const [custom, setCustom] = useState(!isKnown && value.length > 0);

  if (readOnly) {
    return <span className="block px-2 py-1.5 text-sm text-foreground">{value || "—"}</span>;
  }

  if (custom) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Custom unit"
          className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-sm outline-none focus:border-cta"
        />
        <button
          type="button"
          title="Use a standard unit"
          onClick={() => {
            setCustom(false);
            onChange("unit");
          }}
          className="rounded-md p-1 text-text-secondary hover:bg-surface-hover"
        >
          <span className="material-symbols-outlined text-[16px]">list</span>
        </button>
      </div>
    );
  }

  return (
    <select
      value={isKnown ? value : "unit"}
      onChange={(event) => {
        if (event.target.value === CUSTOM) {
          setCustom(true);
          onChange("");
          return;
        }
        onChange(event.target.value);
      }}
      className="w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm outline-none focus:border-border focus:bg-card"
    >
      {COMMON_UNITS.map((unit) => (
        <option key={unit} value={unit}>
          {unit}
        </option>
      ))}
      <option value={CUSTOM}>Custom…</option>
    </select>
  );
}
