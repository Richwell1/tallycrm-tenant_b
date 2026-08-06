export function formatCurrency(value: number, currency = "GHS"): string {
  if (!value) return `${currency} 0`;
  if (value >= 1_000_000) return `${currency} ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${currency} ${(value / 1_000).toFixed(1)}K`;
  return `${currency} ${value.toFixed(0)}`;
}

/**
 * Exact money, to the cent — for documents and totals where formatCurrency's
 * "1.2K" abbreviation would be wrong.
 */
export function formatMoney(value: number | string | null | undefined, currency = "GHS"): string {
  const amount = typeof value === "string" ? Number(value) : (value ?? 0);
  const safe = Number.isFinite(amount) ? amount : 0;
  return `${currency} ${safe.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return "—";
  const parsed = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export function formatRelative(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const diff = Date.now() - d.getTime();
  const m = Math.round(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

export function formatTaskDue(iso: string | null): string {
  if (!iso) return "No due date";
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const dueDay = new Date(d);
  dueDay.setHours(0, 0, 0, 0);
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / 86_400_000);
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (diffDays < 0) return `Overdue • ${d.toLocaleDateString()}`;
  if (diffDays === 0) return `Today, ${time}`;
  if (diffDays === 1) return `Tomorrow, ${time}`;
  if (diffDays < 7) return `${d.toLocaleDateString(undefined, { weekday: "long" })}, ${time}`;
  return d.toLocaleDateString();
}
