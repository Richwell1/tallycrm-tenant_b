import { Link } from "@tanstack/react-router";
import type { ContactRow } from "@/lib/contacts-data";

type ContactWithCompany = ContactRow & { company: { id: string; name: string } | null };

export function ContactsGrid({ contacts }: { contacts: ContactWithCompany[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {contacts.map((c) => {
        const initials = `${c.first_name[0] ?? ""}${c.last_name[0] ?? ""}`.toUpperCase();
        return (
          <Link
            key={c.id}
            to="/app/contacts/$id"
            params={{ id: c.id }}
            className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-xs)] transition-shadow hover:shadow-[var(--shadow-sm)]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {c.first_name} {c.last_name}
                </p>
                <p className="truncate text-xs text-text-secondary">{c.job_title ?? "—"}</p>
              </div>
            </div>
            <div className="mt-3 space-y-1 text-xs text-text-secondary">
              <p className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px]">corporate_fare</span>
                {c.company?.name ?? "No company"}
              </p>
              <p className="flex items-center gap-1.5 truncate">
                <span className="material-symbols-outlined text-[14px]">mail</span>
                {c.email ?? "—"}
              </p>
              <p className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px]">call</span>
                {c.phone ?? "—"}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
