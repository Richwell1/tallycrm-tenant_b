import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ToolbarSelectOption {
  value: string;
  label: string;
}

export interface ToolbarSelect {
  /** Label prefix shown in the placeholder option, e.g. "Status" → "Status: All". */
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: ToolbarSelectOption[];
  /** Override the first option label (defaults to `${label}: All`). */
  allLabel?: string;
  /** Hide the "all" option entirely. */
  hideAll?: boolean;
  minWidth?: number;
}

export interface ToolbarViewOption<V extends string = string> {
  value: V;
  icon: string;
  label?: string;
}

export interface CrmToolbarProps<V extends string = string> {
  /** Optional search input. Omit to hide. */
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;

  /** Optional view-mode toggle (grid/table/kanban etc.). */
  view?: V;
  onViewChange?: (value: V) => void;
  viewOptions?: ToolbarViewOption<V>[];

  /** Generic filter select dropdowns. */
  filters?: ToolbarSelect[];

  /** Sort dropdown. Rendered after filters. */
  sort?: Omit<ToolbarSelect, "label" | "hideAll" | "allLabel"> & { label?: string };

  /** Extra trailing content (advanced filter button, export, result count). */
  trailing?: ReactNode;

  /** Result count summary rendered at the far right. */
  resultCount?: number;
  resultNoun?: string;

  className?: string;
}

export function CrmToolbar<V extends string = string>({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  view,
  onViewChange,
  viewOptions,
  filters,
  sort,
  trailing,
  resultCount,
  resultNoun,
  className,
}: CrmToolbarProps<V>) {
  const hasSearch = typeof searchValue === "string" && onSearchChange !== undefined;
  const hasView = viewOptions && viewOptions.length > 0 && onViewChange !== undefined;

  return (
    <div
      className={cn(
        "mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-xs)]",
        className,
      )}
    >
      {hasSearch ? (
        <div className="relative min-w-[240px] flex-1">
          <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-text-muted">
            search
          </span>
          <input
            type="search"
            value={searchValue}
            onChange={(e) => onSearchChange!(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-[38px] w-full rounded-lg border border-border bg-background pl-10 pr-3 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      ) : null}

      {hasView ? (
        <div className="flex h-[38px] items-center rounded-lg border border-border bg-background p-1">
          {viewOptions!.map((opt) => {
            const active = opt.value === view;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onViewChange!(opt.value)}
                title={opt.label ?? opt.value}
                className={cn(
                  "inline-flex h-[30px] items-center gap-1.5 rounded-md px-2.5 text-[12px] font-semibold transition-all",
                  active
                    ? "bg-primary text-primary-foreground shadow-[var(--shadow-xs)]"
                    : "text-text-secondary hover:bg-surface-hover hover:text-foreground",
                )}
              >
                <span className="material-symbols-outlined text-[16px]">{opt.icon}</span>
                {opt.label ? <span>{opt.label}</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {filters?.map((f, i) => (
        <select
          key={i}
          value={f.value}
          onChange={(e) => f.onChange(e.target.value)}
          style={f.minWidth ? { minWidth: f.minWidth } : undefined}
          className="h-[38px] min-w-[150px] rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        >
          {!f.hideAll ? (
            <option value="all">{f.allLabel ?? `${f.label ?? "Filter"}: All`}</option>
          ) : null}
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>
              {f.label && !f.hideAll ? `${f.label}: ${o.label}` : o.label}
            </option>
          ))}
        </select>
      ))}

      {sort ? (
        <select
          value={sort.value}
          onChange={(e) => sort.onChange(e.target.value)}
          style={sort.minWidth ? { minWidth: sort.minWidth } : undefined}
          className="h-[38px] min-w-[170px] rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        >
          {sort.options.map((o) => (
            <option key={o.value} value={o.value}>
              {`${sort.label ?? "Sort"}: ${o.label}`}
            </option>
          ))}
        </select>
      ) : null}

      {trailing || resultCount !== undefined ? (
        <div className="ml-auto flex items-center gap-3">
          {trailing}
          {resultCount !== undefined ? (
            <p className="text-xs font-semibold text-text-muted">
              Showing <span className="font-bold text-foreground">{resultCount}</span>
              {resultNoun ? ` ${resultNoun}` : ""}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
