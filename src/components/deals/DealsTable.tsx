import { Link } from "@tanstack/react-router";
import type { DealRow } from "@/lib/deals-data";
import { formatCurrency } from "@/lib/format";

type DealWithRefs = DealRow & {
  primary_contact: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
  } | null;
  company: { id: string; name: string } | null;
};

export function DealsTable({ deals }: { deals: DealWithRefs[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-surface text-left text-[11px] font-bold uppercase tracking-wider text-text-secondary">
          <tr>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Contact</th>
            <th className="px-4 py-3">Company</th>
            <th className="px-4 py-3">Value</th>
            <th className="px-4 py-3">Probability</th>
            <th className="px-4 py-3">Close Date</th>
            <th className="px-4 py-3">Created</th>
          </tr>
        </thead>
        <tbody>
          {deals.map((d) => (
            <tr key={d.id} className="border-t border-border hover:bg-surface">
              <td className="px-4 py-3 font-semibold">
                <Link to="/app/deals/$id" params={{ id: d.id }} className="hover:text-primary">
                  {d.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-text-secondary">
                {d.primary_contact
                  ? `${d.primary_contact.first_name} ${d.primary_contact.last_name}`
                  : "—"}
              </td>
              <td className="px-4 py-3 text-text-secondary">{d.company?.name ?? "—"}</td>
              <td className="px-4 py-3 font-bold text-primary">
                {formatCurrency(Number(d.value), d.currency)}
              </td>
              <td className="px-4 py-3 text-text-secondary">{d.probability}%</td>
              <td className="px-4 py-3 text-text-secondary">{d.expected_close_date ?? "—"}</td>
              <td className="px-4 py-3 text-text-muted">
                {new Date(d.created_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
          {deals.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-sm text-text-muted">
                No deals match the current filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
