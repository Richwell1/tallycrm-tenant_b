import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CardSkeleton, ErrorState } from "@/components/common";
import { PageHeader, ToolbarButton } from "@/components/layout";
import { InvoiceLineItemsEditor } from "@/components/invoices/InvoiceLineItemsEditor";
import { InvoiceStatusBadge } from "@/components/invoices/InvoiceStatusBadge";
import { AddReceiptModal } from "@/components/receipts/AddReceiptModal";
import { ReceiptStatusBadge } from "@/components/receipts/ReceiptStatusBadge";
import { formatDateOnly, formatMoney, formatRelative } from "@/lib/format";
import {
  invoiceBalance,
  invoiceClientName,
  isInvoiceOverdue,
  useDeleteInvoice,
  useInvoice,
  useUpdateInvoice,
  useUpdateInvoiceStatus,
} from "@/lib/invoices-data";
import { useQuoteFormOptions } from "@/lib/quotes-data";
import { useReceiptsForInvoice } from "@/lib/receipts-data";

export const Route = createFileRoute("/_authenticated/app/invoices/$id")({
  component: InvoiceDetailPage,
});

function InvoiceDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: invoice, isLoading, isError, error, refetch } = useInvoice(id);
  const { data: options } = useQuoteFormOptions();
  const { data: receipts } = useReceiptsForInvoice(id);
  const updateStatus = useUpdateInvoiceStatus();
  const updateInvoice = useUpdateInvoice();
  const removeInvoice = useDeleteInvoice();

  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [receiptOpen, setReceiptOpen] = useState(false);

  useEffect(() => {
    if (!invoice) return;
    setDueDate(invoice.due_date ?? "");
    setNotes(invoice.notes ?? "");
    setPaymentTerms(invoice.payment_terms ?? "");
  }, [invoice]);

  if (isLoading) return <CardSkeleton />;
  if (isError || !invoice) {
    return (
      <ErrorState
        description={(error as Error)?.message ?? "Could not load this invoice"}
        onRetry={() => refetch()}
      />
    );
  }

  const locked = invoice.status === "paid" || invoice.status === "cancelled";
  // Pricing and discounts are frozen once a valid payment exists — the database
  // enforces the same rule, so keep the line editor read-only to match.
  const hasValidReceipt = (receipts ?? []).some((receipt) => receipt.status === "issued");
  const pricingLocked = locked || hasValidReceipt;
  const overdue = isInvoiceOverdue(
    invoice.status,
    invoice.due_date,
    invoice.amount_paid,
    invoice.total,
  );
  const balance = invoiceBalance(invoice);

  async function changeStatus(status: "sent" | "cancelled") {
    try {
      await updateStatus.mutateAsync({ id, status });
      toast.success("Invoice updated");
    } catch (err) {
      toast.error("Could not update the invoice", { description: (err as Error).message });
    }
  }

  async function saveDetails() {
    try {
      await updateInvoice.mutateAsync({
        id,
        patch: {
          due_date: dueDate || null,
          notes: notes.trim() || null,
          payment_terms: paymentTerms.trim() || null,
        },
      });
      toast.success("Invoice details saved");
    } catch (err) {
      toast.error("Could not save the invoice", { description: (err as Error).message });
    }
  }

  async function handleDelete() {
    if (
      !window.confirm(`Delete invoice ${invoice!.invoice_number}? It will be archived, not erased.`)
    ) {
      return;
    }
    try {
      await removeInvoice.mutateAsync(id);
      toast.success("Invoice archived");
      navigate({ to: "/app/invoices" });
    } catch (err) {
      toast.error("Could not archive the invoice", { description: (err as Error).message });
    }
  }

  return (
    <>
      <PageHeader
        title={invoice.title}
        breadcrumbs={[
          { label: "Invoices", to: "/app/invoices" },
          { label: invoice.invoice_number },
        ]}
        actions={
          <>
            <Link
              to="/app/invoices/print/$id"
              params={{ id }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[13px] font-semibold hover:bg-surface-hover"
            >
              <span className="material-symbols-outlined text-[18px]">print</span>
              Print / PDF
            </Link>
            {invoice.status === "draft" ? (
              <ToolbarButton
                icon="send"
                variant="cta"
                onClick={() => {
                  if (invoice.line_items.length === 0) {
                    toast.error("Add at least one item before sending");
                    return;
                  }
                  void changeStatus("sent");
                }}
              >
                Mark as sent
              </ToolbarButton>
            ) : null}
            {!locked && invoice.status !== "draft" ? (
              <>
                <ToolbarButton icon="payments" variant="cta" onClick={() => setReceiptOpen(true)}>
                  Record payment
                </ToolbarButton>
                <ToolbarButton icon="cancel" onClick={() => void changeStatus("cancelled")}>
                  Cancel
                </ToolbarButton>
              </>
            ) : null}
            <ToolbarButton icon="delete" onClick={handleDelete}>
              Archive
            </ToolbarButton>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-xl border border-border bg-card px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-xs text-text-muted">{invoice.invoice_number}</p>
              <p className="mt-1 text-[18px] font-semibold text-foreground">
                {invoiceClientName(invoice)}
              </p>
            </div>
            <InvoiceStatusBadge
              status={invoice.status}
              dueDate={invoice.due_date}
              amountPaid={invoice.amount_paid}
              total={invoice.total}
            />
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <Info label="Issued" value={formatDateOnly(invoice.issue_date)} />
            <Info label="Due" value={formatDateOnly(invoice.due_date)} />
            <Info label="Total" value={formatMoney(Number(invoice.total), invoice.currency)} />
            <Info label="Balance" value={formatMoney(balance, invoice.currency)} />
          </dl>

          {invoice.quote?.id ? (
            <p className="mt-5 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-text-secondary">
              Raised from quotation{" "}
              <Link
                to="/app/quotes/$id"
                params={{ id: invoice.quote.id }}
                className="font-semibold text-primary hover:underline"
              >
                {invoice.quote.quote_number}
              </Link>
              . Editing this invoice does not change the quotation.
            </p>
          ) : null}

          {overdue ? (
            <p className="mt-4 rounded-lg border border-danger/30 bg-danger-light px-4 py-3 text-sm text-danger">
              This invoice is past its due date with a balance outstanding.
            </p>
          ) : null}
        </section>

        <section className="rounded-xl border border-border bg-card px-6 py-5">
          <h2 className="text-[15px] font-semibold text-foreground">Details</h2>
          <p className="text-xs text-text-secondary">All optional — save when you are done.</p>

          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Due date
              </span>
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="deal-input"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Payment terms
              </span>
              <textarea
                value={paymentTerms}
                onChange={(event) => setPaymentTerms(event.target.value)}
                className="min-h-16 w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Internal notes
              </span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="min-h-16 w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </label>
            <button
              type="button"
              onClick={saveDetails}
              disabled={updateInvoice.isPending}
              className="w-full rounded-lg bg-cta px-4 py-2 text-xs font-semibold text-cta-foreground hover:bg-cta-hover disabled:opacity-60"
            >
              {updateInvoice.isPending ? "Saving..." : "Save details"}
            </button>
          </div>
        </section>
      </div>

      <InvoiceLineItemsEditor
        invoice={invoice}
        catalog={options?.catalog ?? []}
        defaultTaxRate={options?.defaults.taxRate ?? 0}
        readOnly={locked}
      />

      <section className="mt-6 rounded-xl border border-border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
          <div>
            <h2 className="text-[16px] font-semibold text-foreground">Receipts</h2>
            <p className="text-xs text-text-secondary">
              Payments recorded here update the paid amount and invoice status.
            </p>
          </div>
          {!locked ? (
            <ToolbarButton icon="payments" variant="primary" onClick={() => setReceiptOpen(true)}>
              Record payment
            </ToolbarButton>
          ) : null}
        </header>

        {(receipts?.length ?? 0) === 0 ? (
          <p className="px-6 py-6 text-sm text-text-muted">No payments recorded yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {receipts?.map((receipt) => (
              <li
                key={receipt.id}
                className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 text-sm"
              >
                <div>
                  <Link
                    to="/app/receipts/$id"
                    params={{ id: receipt.id }}
                    className="font-semibold text-foreground hover:text-primary"
                  >
                    {receipt.receipt_number}
                  </Link>
                  <p className="text-xs text-text-secondary">
                    {formatDateOnly(receipt.payment_date)} · {receipt.payment_method}
                    {receipt.reference ? ` · ${receipt.reference}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <ReceiptStatusBadge status={receipt.status} />
                  <span className="w-28 text-right font-semibold text-foreground">
                    {formatMoney(Number(receipt.amount), receipt.currency)}
                  </span>
                  <Link
                    to="/app/receipts/print/$id"
                    params={{ id: receipt.id }}
                    className="rounded-md p-1.5 text-text-muted hover:bg-muted hover:text-primary"
                    title="Print receipt"
                  >
                    <span className="material-symbols-outlined text-[18px]">print</span>
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {invoice.status_history.length ? (
        <section className="mt-6 rounded-xl border border-border bg-card">
          <header className="border-b border-border px-6 py-4">
            <h2 className="text-[16px] font-semibold text-foreground">Status history</h2>
          </header>
          <ul className="divide-y divide-border">
            {invoice.status_history.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-2 px-6 py-3 text-sm"
              >
                <span className="text-text-secondary">
                  {entry.from_status ? `${entry.from_status} → ` : ""}
                  <strong className="text-foreground">{entry.to_status}</strong>
                  {entry.note ? ` · ${entry.note}` : ""}
                </span>
                <span className="text-xs text-text-muted">{formatRelative(entry.changed_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <AddReceiptModal open={receiptOpen} onOpenChange={setReceiptOpen} invoice={invoice} />
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
        {label}
      </dt>
      <dd className="mt-0.5 font-semibold text-foreground">{value}</dd>
    </div>
  );
}
