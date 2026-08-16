import { StatusBadge, type StatusTone } from "@/components/common";
import type { CreditNoteStatus } from "@/lib/credit-notes-data";

const STATUS_TONES: Record<string, { tone: StatusTone; label: string; icon: string }> = {
  draft: { tone: "neutral", label: "Draft", icon: "edit_note" },
  issued: { tone: "info", label: "Issued", icon: "send" },
  applied: { tone: "success", label: "Applied", icon: "task_alt" },
  void: { tone: "neutral", label: "Void", icon: "cancel" },
};

interface CreditNoteStatusBadgeProps {
  status: CreditNoteStatus | string;
}

export function CreditNoteStatusBadge({ status }: CreditNoteStatusBadgeProps) {
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
