import { StatusBadge, type StatusTone } from "@/components/common";
import { effectiveInvoiceStatus } from "@/lib/invoices-data";

const STATUS_TONES: Record<string, { tone: StatusTone; label: string; icon: string }> = {
  draft: { tone: "neutral", label: "Draft", icon: "edit_note" },
  sent: { tone: "info", label: "Sent", icon: "send" },
  partially_paid: { tone: "warning", label: "Partially Paid", icon: "pie_chart" },
  paid: { tone: "success", label: "Paid", icon: "task_alt" },
  overdue: { tone: "danger", label: "Overdue", icon: "schedule" },
  cancelled: { tone: "neutral", label: "Cancelled", icon: "cancel" },
};

interface InvoiceStatusBadgeProps {
  status: string;
  dueDate?: string | null;
  amountPaid?: number | string | null;
  total?: number | string | null;
}

/**
 * Shows the status a customer would see: an unpaid invoice past its due date
 * reads as overdue even before anyone updates the record.
 */
export function InvoiceStatusBadge({
  status,
  dueDate = null,
  amountPaid = 0,
  total = 0,
}: InvoiceStatusBadgeProps) {
  const resolved = effectiveInvoiceStatus(status, dueDate, amountPaid, total);
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
