import { Link } from "@tanstack/react-router";
import type { ContactRow } from "@/lib/contacts-data";

type ContactWithCompany = ContactRow & { company: { id: string; name: string } | null };

export function ContactsTable({ contacts }: { contacts: ContactWithCompany[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-surface text-left text-[11px] font-bold uppercase tracking-wider text-text-secondary">
          <tr>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Job Title</th>
            <th className="px-4 py-3">Company</th>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Phone</th>
            <th className="px-4 py-3">Source</th>
            <th className="px-4 py-3">Created</th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((c) => (
            <tr key={c.id} className="border-t border-border hover:bg-surface">
              <td className="px-4 py-3 font-semibold">
                <Link to="/app/contacts/$id" params={{ id: c.id }} className="hover:text-primary">
                  {c.first_name} {c.last_name}
                </Link>
              </td>
              <td className="px-4 py-3 text-text-secondary">{c.job_title ?? "—"}</td>
              <td className="px-4 py-3 text-text-secondary">{c.company?.name ?? "—"}</td>
              <td className="px-4 py-3 text-text-secondary">{c.email ?? "—"}</td>
              <td className="px-4 py-3 text-text-secondary">{c.phone ?? "—"}</td>
              <td className="px-4 py-3 text-text-secondary">{c.source ?? "—"}</td>
              <td className="px-4 py-3 text-text-muted">
                {new Date(c.created_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
          {contacts.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-sm text-text-muted">
                No contacts match the current filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
