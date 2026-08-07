import { StatusBadge } from "@/components/common";
import type { ReceiptStatus } from "@/lib/receipts-data";

export function ReceiptStatusBadge({ status }: { status: ReceiptStatus }) {
  if (status === "void") {
    return (
      <StatusBadge
        tone="neutral"
        icon={<span className="material-symbols-outlined text-[14px]">block</span>}
      >
        Void
      </StatusBadge>
    );
  }

  return (
    <StatusBadge
      tone="success"
      icon={<span className="material-symbols-outlined text-[14px]">verified</span>}
    >
      Issued
    </StatusBadge>
  );
}
