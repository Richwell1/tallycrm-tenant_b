import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CardSkeleton, ErrorState } from "@/components/common";
import { PageHeader, ToolbarButton } from "@/components/layout";
import { CreditNoteLineItemsEditor } from "@/components/credit-notes/CreditNoteLineItemsEditor";
import { CreditNoteStatusBadge } from "@/components/credit-notes/CreditNoteStatusBadge";
import { formatDateOnly, formatMoney, formatRelative } from "@/lib/format";
import {
  creditNoteClientName,
  useCreditNote,
  useDeleteCreditNote,
  useUpdateCreditNote,
  useUpdateCreditNoteStatus,
} from "@/lib/credit-notes-data";
import { useQuoteFormOptions } from "@/lib/quotes-data";

export const Route = createFileRoute("/_authenticated/app/credit-notes/$id")({
  component: CreditNoteDetailPage,
});

function CreditNoteDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: creditNote, isLoading, isError, error, refetch } = useCreditNote(id);
  const { data: options } = useQuoteFormOptions();
  const updateStatus = useUpdateCreditNoteStatus();
  const updateCreditNote = useUpdateCreditNote();
  const removeCreditNote = useDeleteCreditNote();

  const [issueDate, setIssueDate] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [linesDirty, setLinesDirty] = useState(false);
  const [dirtyFields, setDirtyFields] = useState<string[]>([]);
  const handleDirtyChange = useCallback((value: boolean, fields: string[]) => {
    setLinesDirty(value);
    setDirtyFields(fields);
  }, []);
  const dirtyList = dirtyFields.join(", ");

  useEffect(() => {
    if (!creditNote) return;
    setIssueDate(creditNote.issue_date ?? "");
    setReason(creditNote.reason ?? "");
    setNotes(creditNote.notes ?? "");
  }, [creditNote]);

  if (isLoading) return <CardSkeleton />;
  if (isError || !creditNote) {
    return (
      <ErrorState
        description={(error as Error)?.message ?? "Could not load this credit note"}
        onRetry={() => refetch()}
      />
    );
  }

  // Applied and void are terminal — the database enforces the same rule, so keep
  // the line editor read-only to match.
  const locked = creditNote.status === "applied" || creditNote.status === "void";

  async function changeStatus(status: "issued" | "applied" | "void") {
    if (linesDirty) {
      toast.error("Save your credit note changes first", {
        description: `Unsaved changes to ${dirtyList}. Saving recalculates the credited total.`,
      });
      return;
    }
    try {
      await updateStatus.mutateAsync({ id, status });
      toast.success("Credit note updated");
    } catch (err) {
      toast.error("Could not update the credit note", { description: (err as Error).message });
    }
  }

  async function saveDetails() {
    try {
      await updateCreditNote.mutateAsync({
        id,
        patch: {
          issue_date: issueDate || undefined,
          reason: reason.trim() || null,
          notes: notes.trim() || null,
        },
      });
      toast.success("Credit note details saved");
    } catch (err) {
      toast.error("Could not save the credit note", { description: (err as Error).message });
    }
  }

  async function handleDelete() {
    if (
      !window.confirm(
        `Delete credit note ${creditNote!.credit_note_number}? It will be archived, not erased.`,
      )
    ) {
      return;
    }
    try {
      await removeCreditNote.mutateAsync(id);
      toast.success("Credit note archived");
      navigate({ to: "/app/credit-notes" });
    } catch (err) {
      toast.error("Could not archive the credit note", { description: (err as Error).message });
    }
  }

  return (
    <>
      <PageHeader
        title={`Credit note ${creditNote.credit_note_number}`}
        breadcrumbs={[
          { label: "Credit Notes", to: "/app/credit-notes" },
          { label: creditNote.credit_note_number },
        ]}
        actions={
          <>
            <Link
              to="/app/credit-notes/print/$id"
              params={{ id }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[13px] font-semibold hover:bg-surface-hover"
            >
              <span className="material-symbols-outlined text-[18px]">print</span>
              Print / PDF
            </Link>
            {creditNote.status === "draft" ? (
              <ToolbarButton
                icon="send"
                variant="cta"
                disabled={linesDirty}
                title={linesDirty ? "Save credit note changes before issuing" : undefined}
                onClick={() => {
                  if (creditNote.line_items.length === 0) {
                    toast.error("Add at least one item before issuing");
                    return;
                  }
                  void changeStatus("issued");
                }}
              >
                Issue
              </ToolbarButton>
            ) : null}
            {creditNote.status === "issued" ? (
              <>
                <ToolbarButton
                  icon="task_alt"
                  variant="cta"
                  onClick={() => void changeStatus("applied")}
                >
                  Mark as applied
                </ToolbarButton>
                <ToolbarButton icon="cancel" onClick={() => void changeStatus("void")}>
                  Void
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
              <p className="font-mono text-xs text-text-muted">{creditNote.credit_note_number}</p>
              <p className="mt-1 text-[18px] font-semibold text-foreground">
                {creditNoteClientName(creditNote)}
              </p>
            </div>
            <CreditNoteStatusBadge status={creditNote.status} />
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <Info label="Issued" value={formatDateOnly(creditNote.issue_date)} />
            <Info
              label="Subtotal"
              value={formatMoney(Number(creditNote.subtotal), creditNote.currency)}
            />
            <Info
              label="Tax"
              value={formatMoney(Number(creditNote.tax_amount), creditNote.currency)}
            />
            <Info
              label="Total credited"
              value={formatMoney(Number(creditNote.total), creditNote.currency)}
            />
          </dl>

          {creditNote.invoice?.id ? (
            <p className="mt-5 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-text-secondary">
              Credited against invoice{" "}
              <Link
                to="/app/invoices/$id"
                params={{ id: creditNote.invoice.id }}
                className="font-semibold text-primary hover:underline"
              >
                {creditNote.invoice.invoice_number}
              </Link>
              . This credit note is a separate document — it does not change the invoice total or
              its payment status.
            </p>
          ) : (
            <p className="mt-5 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-text-secondary">
              This is a standalone credit note. It is not linked to an invoice.
            </p>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card px-6 py-5">
          <h2 className="text-[15px] font-semibold text-foreground">Details</h2>
          <p className="text-xs text-text-secondary">All optional — save when you are done.</p>

          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Issue date
              </span>
              <input
                type="date"
                value={issueDate}
                onChange={(event) => setIssueDate(event.target.value)}
                className="deal-input"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Reason
              </span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Returned licence, overcharge, cancelled line..."
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
              disabled={updateCreditNote.isPending}
              className="w-full rounded-lg bg-cta px-4 py-2 text-xs font-semibold text-cta-foreground hover:bg-cta-hover disabled:opacity-60"
            >
              {updateCreditNote.isPending ? "Saving..." : "Save details"}
            </button>
          </div>
        </section>
      </div>

      <CreditNoteLineItemsEditor
        creditNote={creditNote}
        catalog={options?.catalog ?? []}
        defaultTaxRate={options?.defaults.taxRate ?? 0}
        readOnly={locked}
        onDirtyChange={handleDirtyChange}
      />

      {creditNote.status_history.length ? (
        <section className="mt-6 rounded-xl border border-border bg-card">
          <header className="border-b border-border px-6 py-4">
            <h2 className="text-[16px] font-semibold text-foreground">Status history</h2>
          </header>
          <ul className="divide-y divide-border">
            {creditNote.status_history.map((entry) => (
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
