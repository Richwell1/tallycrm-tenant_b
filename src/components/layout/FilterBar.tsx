import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FilterChip {
  label: string;
  onRemove?: () => void;
}

interface FilterBarProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  chips?: FilterChip[];
  onAddFilter?: () => void;
  onAdvanced?: () => void;
  right?: ReactNode;
  className?: string;
}

export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  chips,
  onAddFilter,
  onAdvanced,
  right,
  className,
}: FilterBarProps) {
  return (
    <div
      className={cn(
        "mb-6 flex items-center justify-between gap-4 rounded-xl border border-border bg-surface p-4 shadow-[var(--shadow-xs)]",
        className,
      )}
    >
      <div className="flex flex-1 items-center gap-4">
        <div className="relative w-64">
          <span className="material-symbols-outlined pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted">
            search
          </span>
          <input
            type="search"
            value={searchValue ?? ""}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        {chips && chips.length > 0 ? (
          <>
            <div className="h-6 w-px bg-border" />
            <div className="flex flex-wrap items-center gap-2">
              {chips.map((c, i) => (
                <button
                  key={i}
                  onClick={c.onRemove}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-text-secondary hover:bg-surface-hover"
                >
                  {c.label}
                  {c.onRemove ? (
                    <span className="material-symbols-outlined text-[14px]">close</span>
                  ) : null}
                </button>
              ))}
              {onAddFilter ? (
                <button
                  onClick={onAddFilter}
                  className="inline-flex items-center gap-1 rounded-full border border-dashed border-border-strong px-2.5 py-1 text-[11px] font-medium text-text-muted transition-all hover:border-primary hover:text-primary"
                >
                  <span className="material-symbols-outlined text-[14px]">add</span>
                  Add Filter
                </button>
              ) : null}
            </div>
          </>
        ) : onAddFilter ? (
          <button
            onClick={onAddFilter}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-border-strong px-2.5 py-1 text-[11px] font-medium text-text-muted hover:border-primary hover:text-primary"
          >
            <span className="material-symbols-outlined text-[14px]">add</span>
            Add Filter
          </button>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        {right}
        {onAdvanced ? (
          <button
            onClick={onAdvanced}
            className="inline-flex items-center gap-1 text-[12px] font-bold text-primary hover:underline"
          >
            <span className="material-symbols-outlined text-[18px]">tune</span>
            Advanced Filters
          </button>
        ) : null}
      </div>
    </div>
  );
}
