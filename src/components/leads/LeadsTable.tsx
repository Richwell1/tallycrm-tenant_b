import { Link } from "@tanstack/react-router";
import { LEAD_STATUSES, type LeadRow } from "@/lib/leads-data";

export function LeadsTable({
  leads,
  onConvert,
  onDisqualify,
}: {
  leads: LeadRow[];
  onConvert: (lead: LeadRow) => void;
  onDisqualify: (lead: LeadRow) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-xs)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="bg-muted/60 text-[11px] font-bold uppercase tracking-wider text-text-secondary">
            <tr>
              <th className="w-10 border-b border-border px-4 py-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
              </th>
              <th className="px-4 py-3">Name</th>
              <th className="border-b border-border px-4 py-3">Lead Value</th>
              <th className="border-b border-border px-4 py-3">Email</th>
              <th className="border-b border-border px-4 py-3">Company</th>
              <th className="border-b border-border px-4 py-3">Status</th>
              <th className="border-b border-border px-4 py-3">Source</th>
              <th className="border-b border-border px-4 py-3">Created</th>
              <th className="border-b border-border px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {leads.map((l) => {
              const s = LEAD_STATUSES.find((x) => x.id === l.status);
              const name = `${l.first_name} ${l.last_name}`;
              return (
                <tr key={l.id} className="group transition-colors hover:bg-muted/40">
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <Link
                      to="/app/leads/$id"
                      params={{ id: l.id }}
                      className="flex items-center gap-3 hover:text-primary"
                    >
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${avatarTone(l.status)}`}
                      >
                        {initials(name)}
                      </span>
                      <span>
                        <span className="block font-semibold text-foreground">{name}</span>
                        <span className="block text-[11px] font-semibold text-text-muted">
                          {l.company_name || "No company"}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-4 font-semibold text-foreground">
                    {typeof l.value === "number" ? money(l.value, l.currency ?? "USD") : "—"}
                  </td>
                  <td className="px-4 py-4 text-text-secondary">{l.email}</td>
                  <td className="px-4 py-4 text-text-secondary">{l.company_name ?? "—"}</td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase ${statusTone(l.status)}`}
                    >
                      {s?.label}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-text-secondary">{l.source}</td>
                  <td className="px-4 py-4 text-text-muted">
                    {new Date(l.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-4 text-right">
                    {l.status !== "converted" && l.status !== "disqualified" ? (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onConvert(l)}
                          className="rounded-md p-1 text-text-muted transition-colors hover:bg-primary-light hover:text-primary"
                          title="Convert to deal"
                        >
                          <span className="material-symbols-outlined text-[18px]">handshake</span>
                        </button>
                        <button
                          onClick={() => onDisqualify(l)}
                          className="rounded-md p-1 text-text-muted transition-colors hover:bg-danger-light hover:text-danger"
                          title="Disqualify"
                        >
                          <span className="material-symbols-outlined text-[18px]">block</span>
                        </button>
                      </div>
                    ) : (
                      <Link
                        to="/app/leads/$id"
                        params={{ id: l.id }}
                        className="inline-flex rounded-md p-1 text-text-muted transition-colors hover:bg-muted hover:text-primary"
                        title="View lead"
                      >
                        <span className="material-symbols-outlined text-[18px]">visibility</span>
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
            {leads.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-text-muted">
                  No leads match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-4">
        <p className="text-sm text-text-secondary">
          Showing{" "}
          <span className="font-semibold text-foreground">1-{Math.min(leads.length, 10)}</span> of{" "}
          <span className="font-semibold text-foreground">{leads.length}</span> leads
        </p>
        <div className="flex items-center gap-1">
          {["chevron_left", "1", "2", "3", "chevron_right"].map((item) => (
            <button
              key={item}
              className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-semibold transition-colors ${
                item === "1"
                  ? "border-primary bg-primary text-white"
                  : "border-border text-text-secondary hover:bg-card"
              }`}
            >
              {item.includes("chevron") ? (
                <span className="material-symbols-outlined text-[18px]">{item}</span>
              ) : (
                item
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

function avatarTone(status: LeadRow["status"]) {
  switch (status) {
    case "contacted":
      return "bg-accent-light text-accent-foreground";
    case "qualified":
      return "bg-success-light text-success";
    case "converted":
      return "bg-primary-light text-primary";
    case "disqualified":
      return "bg-danger-light text-danger";
    default:
      return "bg-primary-light text-primary";
  }
}

function statusTone(status: LeadRow["status"]) {
  switch (status) {
    case "contacted":
      return "border-amber-200 bg-amber-100 text-amber-800";
    case "qualified":
      return "border-green-200 bg-green-100 text-green-800";
    case "converted":
      return "border-blue-200 bg-blue-100 text-blue-800";
    case "disqualified":
      return "border-red-200 bg-red-100 text-red-800";
    default:
      return "border-blue-200 bg-blue-100 text-blue-800";
  }
}
