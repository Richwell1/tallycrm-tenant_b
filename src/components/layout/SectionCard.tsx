import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

/** White surface card used as the container for tables, lists, charts. */
export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: SectionCardProps) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-surface shadow-[var(--shadow-card)]",
        className,
      )}
    >
      {(title || actions) && (
        <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            {title ? <h2 className="text-[16px] font-semibold text-foreground">{title}</h2> : null}
            {description ? (
              <p className="mt-0.5 text-[13px] text-text-secondary">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </header>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}
