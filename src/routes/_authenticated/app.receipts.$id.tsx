import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { CardSkeleton, ErrorState } from "@/components/common";
import { PageHeader, ToolbarButton } from "@/components/layout";
import { ReceiptStatusBadge } from "@/components/receipts/ReceiptStatusBadge";
import { formatDateOnly, formatMoney, formatRelative } from "@/lib/format";
import {
  receiptClientName,
  useDeleteReceipt,
  useReceipt,
  useVoidReceipt,
} from "@/lib/receipts-data";

export const Route = createFileRoute("/_authenticated/app/receipts/$id")({
  component: ReceiptDetailPage,
});

function ReceiptDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: receipt, isLoading, isError, error, refetch } = useReceipt(id);
  const voidReceipt = useVoidReceipt();
  const deleteReceipt = useDeleteReceipt();

  if (isLoading) return <CardSkeleton />;
  if (isError || !receipt) {
    return (
      <ErrorState
        description={(error as Error)?.message ?? "Could not load this receipt"}
        onRetry={() => refetch()}
      />
    );
  }

  async function handleVoid() {
    if (
      !window.confirm(`Void receipt ${receipt!.receipt_number}? The invoice balance will update.`)
    ) {
      return;
    }
    try {
      await voidReceipt.mutateAsync(id);
      toast.success("Receipt voided");
    } catch (err) {
      toast.error("Could not void receipt", { description: (err as Error).message });
    }
  }

  async function handleDelete() {
    if (
      !window.confirm(
        `Archive receipt ${receipt!.receipt_number}? The invoice balance will update.`,
      )
    ) {
      return;
    }
    try {
      await deleteReceipt.mutateAsync(id);
      toast.success("Receipt archived");
      navigate({ to: "/app/receipts" });
    } catch (err) {
      toast.error("Could not archive receipt", { description: (err as Error).message });
    }
  }

  return (
    <>
      <PageHeader
        title={receipt.receipt_number}
        breadcrumbs={[
          { label: "Receipts", to: "/app/receipts" },
          { label: receipt.receipt_number },
        ]}
        actions={
          <>
            <Link
              to="/app/receipts/print/$id"
              params={{ id }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[13px] font-semibold hover:bg-surface-hover"
            >
              <span className="material-symbols-outlined text-[18px]">print</span>
              Print / PDF
            </Link>
            {receipt.status !== "void" ? (
              <ToolbarButton icon="block" onClick={handleVoid}>
                Void
              </ToolbarButton>
            ) : null}
            <ToolbarButton icon="delete" onClick={handleDelete}>
              Archive
            </ToolbarButton>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-xl border border-border bg-card px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <ReceiptStatusBadge status={receipt.status} />
              <p className="mt-4 text-[30px] font-bold leading-none text-foreground">
                {formatMoney(Number(receipt.amount), receipt.currency)}
              </p>
              <p className="mt-2 text-sm text-text-secondary">
                Received from {receiptClientName(receipt)} on {formatDateOnly(receipt.payment_date)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Method
              </p>
              <p className="mt-1 font-semibold text-foreground">{receipt.payment_method}</p>
              {receipt.reference ? (
                <p className="mt-1 font-mono text-xs text-text-muted">{receipt.reference}</p>
              ) : null}
            </div>
          </div>

          {receipt.notes ? (
            <div className="mt-6 rounded-lg border border-border bg-muted px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Notes
              </p>
              <p className="mt-1 whitespace-pre-line text-sm text-text-secondary">
                {receipt.notes}
              </p>
            </div>
          ) : null}
        </section>

        <aside className="space-y-6">
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-[16px] font-semibold text-foreground">Invoice</h2>
            {receipt.invoice ? (
              <Link
                to="/app/invoices/$id"
                params={{ id: receipt.invoice.id }}
                className="mt-4 block rounded-lg border border-border bg-muted px-4 py-3 hover:border-primary"
              >
                <p className="font-mono text-xs font-semibold text-primary">
                  {receipt.invoice.invoice_number}
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {receipt.invoice.title}
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  {formatMoney(Number(receipt.invoice.amount_paid), receipt.invoice.currency)} paid
                  of {formatMoney(Number(receipt.invoice.total), receipt.invoice.currency)}
                </p>
              </Link>
            ) : (
              <p className="mt-3 text-sm text-text-muted">Invoice not available.</p>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-[16px] font-semibold text-foreground">Audit</h2>
            <dl className="mt-4 space-y-2.5 text-sm">
              <Detail label="Issued" value={formatRelative(receipt.issued_at)} />
              <Detail label="Issued by" value={receipt.issued_rep?.full_name ?? "—"} />
              <Detail label="Owner" value={receipt.assigned_rep?.full_name ?? "—"} />
              {receipt.voided_at ? (
                <Detail label="Voided" value={formatRelative(receipt.voided_at)} />
              ) : null}
            </dl>
          </section>
        </aside>
      </div>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-text-secondary">{label}</dt>
      <dd className="truncate text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}
