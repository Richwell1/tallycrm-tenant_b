import { Link } from "@tanstack/react-router";
import type { CompanyRow } from "@/lib/companies-data";

export function CompaniesGrid({ companies }: { companies: CompanyRow[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {companies.map((c) => (
        <Link
          key={c.id}
          to="/app/companies/$id"
          params={{ id: c.id }}
          className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-xs)] transition-shadow hover:shadow-[var(--shadow-sm)]"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-light text-primary">
              {c.logo_url ? (
                <img src={c.logo_url} alt={c.name} className="h-12 w-12 rounded-lg object-cover" />
              ) : (
                <span className="material-symbols-outlined">corporate_fare</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{c.name}</p>
              <p className="truncate text-xs text-text-secondary">{c.industry ?? "—"}</p>
              {c.rating ? (
                <div className="mt-1 flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span
                      key={i}
                      className={`material-symbols-outlined text-[14px] ${
                        i < (c.rating ?? 0) ? "text-warning" : "text-border-strong"
                      }`}
                      style={{ fontVariationSettings: '"FILL" 1' }}
                    >
                      star
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <div className="mt-3 space-y-1 text-xs text-text-secondary">
            <p className="flex items-center gap-1.5 truncate">
              <span className="material-symbols-outlined text-[14px]">language</span>
              {c.website ?? "—"}
            </p>
            <p className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px]">location_on</span>
              {[c.city, c.country].filter(Boolean).join(", ") || "—"}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
