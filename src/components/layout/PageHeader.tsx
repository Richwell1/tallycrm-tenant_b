import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import type { Breadcrumb } from "@/types";

interface PageHeaderProps {
  title: string;
  count?: number | string;
  breadcrumbs?: Breadcrumb[];
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, count, breadcrumbs, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-end justify-between gap-4", className)}>
      <div>
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            {breadcrumbs.map((b, i) => (
              <span key={i} className="flex items-center gap-1">
                {b.to ? (
                  <Link to={b.to} className="hover:text-primary">
                    {b.label}
                  </Link>
                ) : (
                  <span className={i === breadcrumbs.length - 1 ? "text-primary" : ""}>
                    {b.label}
                  </span>
                )}
                {i < breadcrumbs.length - 1 ? <span>/</span> : null}
              </span>
            ))}
          </nav>
        ) : null}
        <div className="flex items-center gap-3">
          <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-foreground">
            {title}
          </h1>
          {count !== undefined ? (
            <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-semibold text-secondary-foreground">
              {count}
            </span>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

interface ToolbarButtonProps {
  icon: string;
  children?: ReactNode;
  onClick?: () => void;
  variant?: "default" | "cta" | "primary";
  title?: string;
}

/** Shared header action button — used for Export / Refresh / Add. */
export function ToolbarButton({
  icon,
  children,
  onClick,
  variant = "default",
  title,
}: ToolbarButtonProps) {
  const base =
    "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2.5 text-[13px] font-semibold transition-all";
  const styles =
    variant === "cta"
      ? "bg-cta text-cta-foreground shadow-[var(--shadow-sm)] hover:bg-cta-hover"
      : variant === "primary"
        ? "bg-primary text-primary-foreground hover:bg-primary-dark"
        : "border border-border bg-surface text-foreground hover:bg-surface-hover";
  return (
    <button onClick={onClick} title={title} className={cn(base, styles)}>
      <span className="material-symbols-outlined text-[18px]">{icon}</span>
      {children}
    </button>
  );
}
