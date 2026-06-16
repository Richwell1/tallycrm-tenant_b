import { Link } from "@tanstack/react-router";
import type { CompanyRow } from "@/lib/companies-data";

export function CompaniesTable({ companies }: { companies: CompanyRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-surface text-left text-[11px] font-bold uppercase tracking-wider text-text-secondary">
          <tr>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Industry</th>
            <th className="px-4 py-3">Website</th>
            <th className="px-4 py-3">Phone</th>
            <th className="px-4 py-3">City</th>
            <th className="px-4 py-3">Rating</th>
            <th className="px-4 py-3">Created</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((c) => (
            <tr key={c.id} className="border-t border-border hover:bg-surface">
              <td className="px-4 py-3 font-semibold">
                <Link to="/app/companies/$id" params={{ id: c.id }} className="hover:text-primary">
                  {c.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-text-secondary">{c.industry ?? "—"}</td>
              <td className="px-4 py-3 text-text-secondary">
                {c.website ? (
                  <a
                    href={c.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    {c.website}
                  </a>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-3 text-text-secondary">{c.phone ?? "—"}</td>
              <td className="px-4 py-3 text-text-secondary">
                {[c.city, c.country].filter(Boolean).join(", ") || "—"}
              </td>
              <td className="px-4 py-3 text-text-secondary">
                {c.rating ? `${c.rating} / 5` : "—"}
              </td>
              <td className="px-4 py-3 text-text-muted">
                {new Date(c.created_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
          {companies.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-sm text-text-muted">
                No companies match the current filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
