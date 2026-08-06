import { StatusBadge, type StatusTone } from "@/components/common";
import { effectiveQuoteStatus } from "@/lib/quote-totals";

const STATUS_TONES: Record<string, { tone: StatusTone; label: string; icon: string }> = {
  draft: { tone: "neutral", label: "Draft", icon: "edit_note" },
  sent: { tone: "info", label: "Sent", icon: "send" },
  accepted: { tone: "success", label: "Accepted", icon: "task_alt" },
  rejected: { tone: "danger", label: "Rejected", icon: "cancel" },
  expired: { tone: "warning", label: "Expired", icon: "schedule" },
};

interface QuoteStatusBadgeProps {
  status: string;
  validUntil?: string | null;
}

/**
 * Shows the status a client would see: a sent quote past its validity date
 * reads as expired even if expire_stale_quotes() has not run yet.
 */
export function QuoteStatusBadge({ status, validUntil = null }: QuoteStatusBadgeProps) {
  const resolved = effectiveQuoteStatus(status, validUntil);
  const config = STATUS_TONES[resolved] ?? STATUS_TONES.draft;

  return (
    <StatusBadge
      tone={config.tone}
      icon={<span className="material-symbols-outlined text-[14px]">{config.icon}</span>}
    >
      {config.label}
    </StatusBadge>
  );
}
