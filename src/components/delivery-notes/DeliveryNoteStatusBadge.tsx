import { StatusBadge, type StatusTone } from "@/components/common";
import type { DeliveryNoteStatus } from "@/lib/delivery-notes-data";

const STATUS_TONES: Record<string, { tone: StatusTone; label: string; icon: string }> = {
  draft: { tone: "neutral", label: "Draft", icon: "edit_note" },
  dispatched: { tone: "info", label: "Dispatched", icon: "local_shipping" },
  delivered: { tone: "success", label: "Delivered", icon: "task_alt" },
  cancelled: { tone: "neutral", label: "Cancelled", icon: "cancel" },
};

export function DeliveryNoteStatusBadge({ status }: { status: DeliveryNoteStatus | string }) {
  const config = STATUS_TONES[status] ?? STATUS_TONES.draft;
  return (
    <StatusBadge
      tone={config.tone}
      icon={<span className="material-symbols-outlined text-[14px]">{config.icon}</span>}
    >
      {config.label}
    </StatusBadge>
  );
}
