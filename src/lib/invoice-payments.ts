import type { InvoiceStatus } from "@/lib/invoices-data";

export interface InvoicePaymentState {
  amountPaid: number;
  balance: number;
  status: InvoiceStatus;
}

function money(value: number | string | null | undefined): number {
  const parsed = typeof value === "string" ? Number(value) : (value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100) / 100;
}

export function deriveInvoicePaymentState({
  currentStatus,
  sentAt,
  total,
  receiptTotal,
}: {
  currentStatus: InvoiceStatus;
  sentAt?: string | null;
  total: number | string | null;
  receiptTotal: number | string | null;
}): InvoicePaymentState {
  const invoiceTotal = Math.max(money(total), 0);
  const amountPaid = Math.min(Math.max(money(receiptTotal), 0), invoiceTotal);
  const balance = Math.max(money(invoiceTotal - amountPaid), 0);

  if (currentStatus === "cancelled") {
    return { amountPaid, balance, status: "cancelled" };
  }

  if (invoiceTotal > 0 && amountPaid >= invoiceTotal) {
    return { amountPaid, balance, status: "paid" };
  }

  if (amountPaid > 0) {
    return { amountPaid, balance, status: "partially_paid" };
  }

  if (currentStatus === "paid" || currentStatus === "partially_paid") {
    return { amountPaid, balance, status: sentAt ? "sent" : "draft" };
  }

  return { amountPaid, balance, status: currentStatus };
}
