import { Link } from "@tanstack/react-router";
import { LEAD_STATUSES, type LeadRow } from "@/lib/leads-data";

export function LeadsTable({ leads }: { leads: LeadRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-surface text-left text-[11px] font-bold uppercase tracking-wider text-text-secondary">
          <tr>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Company</th>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Source</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Created</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => {
            const s = LEAD_STATUSES.find((x) => x.id === l.status);
            return (
              <tr key={l.id} className="border-t border-border hover:bg-surface">
                <td className="px-4 py-3 font-semibold">
                  <Link to="/app/leads/$id" params={{ id: l.id }} className="hover:text-primary">
                    {l.first_name} {l.last_name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-text-secondary">{l.company_name ?? "—"}</td>
                <td className="px-4 py-3 text-text-secondary">{l.email}</td>
                <td className="px-4 py-3 text-text-secondary">{l.source}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${s?.color ?? ""}`}>{s?.label}</span>
                </td>
                <td className="px-4 py-3 text-text-muted">{new Date(l.created_at).toLocaleDateString()}</td>
              </tr>
            );
          })}
          {leads.length === 0 && (
            <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-text-muted">No leads match the current filters.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
