import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useModalA11y } from "@/components/common/use-modal-a11y";
import { formatMoney } from "@/lib/format";
import { useDealFormOptions } from "@/lib/deals-data";
import { type QuoteDetail, useConvertQuoteToDeal } from "@/lib/quotes-data";

interface ConvertQuoteModalProps {
  quote: QuoteDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConvertQuoteModal({ quote, open, onOpenChange }: ConvertQuoteModalProps) {
  const { data: options } = useDealFormOptions();
  const convert = useConvertQuoteToDeal();
  const navigate = useNavigate();
  const modal = useModalA11y(open, onOpenChange, { disabled: convert.isPending });

  const [stageId, setStageId] = useState("");
  const [dealName, setDealName] = useState(quote.title);
  const [closeDate, setCloseDate] = useState(
    () => quote.valid_until ?? new Date().toISOString().slice(0, 10),
  );

  const alreadyLinked = !!quote.deal_id;

  useEffect(() => {
    if (!open || stageId || !options?.stages.length) return;
    const firstOpen = options.stages.find((stage) => !stage.is_closed) ?? options.stages[0];
    setStageId(firstOpen.id);
  }, [open, options?.stages, stageId]);

  if (!open) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!alreadyLinked && !stageId) {
      toast.error("Pick a pipeline stage for the new deal");
      return;
    }
    try {
      const result = await convert.mutateAsync({
        quoteId: quote.id,
        stageId,
        dealName: dealName.trim() || quote.title,
        expectedCloseDate: closeDate,
      });
      toast.success(result.created ? "Deal created from quote" : "Linked deal updated");
      onOpenChange(false);
      navigate({ to: "/app/deals/$id", params: { id: result.dealId } });
    } catch (error) {
      toast.error("Could not convert the quote", { description: (error as Error).message });
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/60 p-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="convert-quote-title"
      ref={modal.ref}
      onKeyDown={modal.onKeyDown}
    >
      <div className="w-full max-w-[540px] overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <header className="border-b border-border bg-muted px-8 py-6">
          <h2 id="convert-quote-title" className="text-[20px] font-semibold text-foreground">
            Convert to deal
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            {alreadyLinked
              ? `Updates the linked deal's value to ${formatMoney(Number(quote.total), quote.currency)}.`
              : `Creates a pipeline opportunity worth ${formatMoney(Number(quote.total), quote.currency)}.`}
          </p>
        </header>

        <form onSubmit={handleSubmit} className="px-8 py-6">
          {!alreadyLinked ? (
            <div className="space-y-5">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  Deal name
                </span>
                <input
                  value={dealName}
                  onChange={(event) => setDealName(event.target.value)}
                  className="deal-input"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  Pipeline stage
                </span>
                <select
                  value={stageId}
                  onChange={(event) => setStageId(event.target.value)}
                  className="deal-input appearance-none"
                >
                  {options?.stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  Expected close date
                </span>
                <input
                  type="date"
                  value={closeDate}
                  onChange={(event) => setCloseDate(event.target.value)}
                  className="deal-input"
                />
              </label>
            </div>
          ) : (
            <p className="rounded-lg border border-border bg-muted px-4 py-3 text-sm text-text-secondary">
              This quote is already attached to <strong>{quote.deal?.name ?? "a deal"}</strong>. Its
              value will be set to the accepted quote total.
            </p>
          )}

          <footer className="-mx-8 -mb-6 mt-8 flex justify-end gap-4 border-t border-border bg-muted px-8 py-5">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg border border-border bg-card px-6 py-2 text-xs font-semibold hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={convert.isPending}
              className="rounded-lg bg-cta px-6 py-2 text-xs font-semibold text-cta-foreground hover:bg-cta-hover disabled:opacity-60"
            >
              {convert.isPending ? "Converting..." : alreadyLinked ? "Update deal" : "Create deal"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
