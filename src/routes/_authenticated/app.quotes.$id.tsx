import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { CardSkeleton, ErrorState } from "@/components/common";
import { PageHeader, ToolbarButton } from "@/components/layout";
import { ConvertQuoteModal } from "@/components/quotes/ConvertQuoteModal";
import { QuoteLineItemsEditor } from "@/components/quotes/QuoteLineItemsEditor";
import { QuoteStatusBadge } from "@/components/quotes/QuoteStatusBadge";
import { formatDateOnly, formatMoney, formatRelative } from "@/lib/format";
import { isEffectivelyExpired } from "@/lib/quote-totals";
import {
  quoteClientName,
  useDeleteQuote,
  useQuote,
  useQuoteFormOptions,
  useReviseQuote,
  useUpdateQuoteStatus,
} from "@/lib/quotes-data";

export const Route = createFileRoute("/_authenticated/app/quotes/$id")({
  component: QuoteDetailPage,
});

function QuoteDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: quote, isLoading, isError, error, refetch } = useQuote(id);
  const { data: options } = useQuoteFormOptions();
  const updateStatus = useUpdateQuoteStatus();
  const revise = useReviseQuote();
  const removeQuote = useDeleteQuote();
  const [convertOpen, setConvertOpen] = useState(false);

  if (isLoading) return <CardSkeleton />;
  if (isError || !quote) {
    return (
      <ErrorState
        description={(error as Error)?.message ?? "Could not load this quotation"}
        onRetry={() => refetch()}
      />
    );
  }

  const isDraft = quote.status === "draft";
  const expired = isEffectivelyExpired(quote.status, quote.valid_until);
  const decided = quote.status === "accepted" || quote.status === "rejected";

  async function changeStatus(status: "sent" | "accepted" | "rejected", note?: string) {
    try {
      await updateStatus.mutateAsync({ id, status, note });
      toast.success(`Quote marked ${status}`);
    } catch (err) {
      toast.error("Could not update the quote", { description: (err as Error).message });
    }
  }

  async function handleRevise() {
    try {
      const newId = await revise.mutateAsync(id);
      toast.success("Revision created", { description: "Edit the new draft and send it again." });
      navigate({ to: "/app/quotes/$id", params: { id: newId } });
    } catch (err) {
      toast.error("Could not create a revision", { description: (err as Error).message });
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete quote ${quote!.quote_number}? It will be archived, not erased.`)) {
      return;
    }
    try {
      await removeQuote.mutateAsync(id);
      toast.success("Quote archived");
      navigate({ to: "/app/quotes" });
    } catch (err) {
      toast.error("Could not archive the quote", { description: (err as Error).message });
    }
  }

  return (
    <>
      <PageHeader
        title={quote.title}
        breadcrumbs={[{ label: "Quotations", to: "/app/quotes" }, { label: quote.quote_number }]}
        actions={
          <>
            <Link
              to="/app/quotes/print/$id"
              params={{ id }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[13px] font-semibold hover:bg-surface-hover"
            >
              <span className="material-symbols-outlined text-[18px]">print</span>
              Print / PDF
            </Link>
            {isDraft ? (
              <ToolbarButton
                icon="send"
                variant="cta"
                onClick={() => {
                  if (quote.line_items.length === 0) {
                    toast.error("Add at least one line item before sending");
                    return;
                  }
                  void changeStatus("sent");
                }}
              >
                Mark as sent
              </ToolbarButton>
            ) : null}
            {quote.status === "sent" && !expired ? (
              <>
                <ToolbarButton
                  icon="task_alt"
                  variant="cta"
                  onClick={() => void changeStatus("accepted")}
                >
                  Accepted
                </ToolbarButton>
                <ToolbarButton icon="cancel" onClick={() => void changeStatus("rejected")}>
                  Rejected
                </ToolbarButton>
              </>
            ) : null}
            {!isDraft ? (
              <ToolbarButton icon="content_copy" onClick={handleRevise}>
                Revise
              </ToolbarButton>
            ) : null}
            {quote.status === "accepted" && !quote.converted_deal_id ? (
              <ToolbarButton
                icon="handshake"
                variant="primary"
                onClick={() => setConvertOpen(true)}
              >
                Convert to deal
              </ToolbarButton>
            ) : null}
            {quote.converted_deal_id ? (
              <Link
                to="/app/deals/$id"
                params={{ id: quote.converted_deal_id }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2.5 text-[13px] font-semibold text-primary-foreground hover:bg-primary-dark"
              >
                <span className="material-symbols-outlined text-[18px]">handshake</span>
                View deal
              </Link>
            ) : null}
            <ToolbarButton icon="delete" onClick={handleDelete} title="Archive quote" />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <QuoteLineItemsEditor
            quote={quote}
            catalog={options?.catalog ?? []}
            defaultTaxRate={options?.defaults.taxRate ?? 0}
            readOnly={!isDraft}
          />

          {quote.notes ? (
            <section className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-[16px] font-semibold text-foreground">Internal notes</h2>
              <p className="mt-2 whitespace-pre-line text-sm text-text-secondary">{quote.notes}</p>
            </section>
          ) : null}

          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-[16px] font-semibold text-foreground">History</h2>
            <ol className="mt-4 space-y-3">
              {quote.status_history.map((entry) => (
                <li key={entry.id} className="flex items-start gap-3 text-sm">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <div>
                    <p className="font-medium text-foreground">
                      {entry.from_status
                        ? `${entry.from_status} → ${entry.to_status}`
                        : `Created as ${entry.to_status}`}
                    </p>
                    <p className="text-xs text-text-muted">{formatRelative(entry.changed_at)}</p>
                    {entry.note ? (
                      <p className="mt-1 text-xs text-text-secondary">{entry.note}</p>
                    ) : null}
                  </div>
                </li>
              ))}
              {quote.status_history.length === 0 ? (
                <li className="text-sm text-text-muted">No transitions recorded yet.</li>
              ) : null}
            </ol>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <QuoteStatusBadge status={quote.status} validUntil={quote.valid_until} />
              <span className="font-mono text-xs text-text-muted">{quote.quote_number}</span>
            </div>
            <p className="mt-4 text-[28px] font-bold leading-none text-foreground">
              {formatMoney(Number(quote.total), quote.currency)}
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              {formatMoney(Number(quote.subtotal), quote.currency)} net ·{" "}
              {formatMoney(Number(quote.tax_amount), quote.currency)} tax
            </p>

            <dl className="mt-5 space-y-2.5 text-sm">
              <Detail label="Client" value={quoteClientName(quote)} />
              <Detail label="Owner" value={quote.assigned_rep?.full_name ?? "—"} />
              <Detail label="Issued" value={formatDateOnly(quote.issue_date)} />
              <Detail label="Valid until" value={formatDateOnly(quote.valid_until)} />
              <Detail label="Version" value={`Revision ${quote.version}`} />
            </dl>

            {quote.deal_id ? (
              <Link
                to="/app/deals/$id"
                params={{ id: quote.deal_id }}
                className="mt-5 flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-xs font-semibold text-foreground hover:border-primary"
              >
                <span className="material-symbols-outlined text-[16px]">handshake</span>
                {quote.deal?.name ?? "Linked deal"}
              </Link>
            ) : null}

            {decided ? (
              <p className="mt-4 rounded-lg border border-border bg-muted px-3 py-2 text-xs text-text-secondary">
                Locked on{" "}
                {formatDateOnly(
                  (quote.status === "accepted" ? quote.accepted_at : quote.rejected_at) ?? null,
                )}
                . Create a revision to quote again.
              </p>
            ) : null}
          </section>

          {quote.revisions.length > 1 ? (
            <section className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-[16px] font-semibold text-foreground">Revisions</h2>
              <ul className="mt-3 space-y-2">
                {quote.revisions.map((revision) => (
                  <li key={revision.id}>
                    <Link
                      to="/app/quotes/$id"
                      params={{ id: revision.id }}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs font-semibold ${
                        revision.id === quote.id
                          ? "border-primary bg-primary-light text-primary"
                          : "border-border hover:border-primary"
                      }`}
                    >
                      <span>
                        Rev {revision.version} · {revision.status}
                      </span>
                      <span>{formatMoney(Number(revision.total), quote.currency)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {quote.terms ? (
            <section className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-[16px] font-semibold text-foreground">Terms</h2>
              <p className="mt-2 whitespace-pre-line text-sm text-text-secondary">{quote.terms}</p>
            </section>
          ) : null}
        </aside>
      </div>

      {convertOpen ? (
        <ConvertQuoteModal quote={quote} open={convertOpen} onOpenChange={setConvertOpen} />
      ) : null}
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
