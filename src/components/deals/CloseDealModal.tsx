import { type FormEvent, useMemo, useState } from "react";
import {
  type DealSummary,
  type PipelineStageRow,
  useCloseDeal,
  useDealFormOptions,
} from "@/lib/deals-data";
import { Icon } from "@/components/common";
import { toast } from "sonner";

interface CloseDealModalProps {
  deal: DealSummary;
  mode: "won" | "lost";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CloseDealModal({ deal, mode, open, onOpenChange }: CloseDealModalProps) {
  const { data: options } = useDealFormOptions();
  const closeDeal = useCloseDeal();
  const [actualValue, setActualValue] = useState(
    String(Number(deal.actual_value ?? deal.value ?? 0)),
  );
  const [actualCloseDate, setActualCloseDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState(
    mode === "won"
      ? "Secured following competitive POC. Client favored our implementation speed and support SLA."
      : "",
  );
  const [lostReason, setLostReason] = useState("");

  const targetStage = useMemo(
    () => findCloseStage(options?.stages ?? [], mode),
    [mode, options?.stages],
  );

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!targetStage) return;
    if (!note.trim()) {
      toast.error(isWon ? "Win note required" : "Loss note required");
      return;
    }
    if (!isWon && !lostReason) {
      toast.error("Loss reason required");
      return;
    }
    try {
      await closeDeal.mutateAsync({
        dealId: deal.id,
        mode,
        stageId: targetStage.id,
        actualValue: Number(actualValue || deal.value || 0),
        actualCloseDate,
        note,
        lostReason,
      });
      toast.success(isWon ? "Deal marked as won" : "Deal marked as lost");
      onOpenChange(false);
    } catch (err) {
      toast.error("Could not close deal", { description: (err as Error).message });
    }
  }

  const isWon = mode === "won";

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-foreground/60 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      {isWon ? <Confetti /> : null}
      <form
        onSubmit={handleSubmit}
        className="relative max-h-[100dvh] w-full overflow-y-auto rounded-t-xl border border-border bg-card shadow-2xl sm:max-w-[520px] sm:rounded-xl"
      >
        <div
          className={`relative overflow-hidden px-8 py-8 text-center ${
            isWon ? "bg-primary" : "bg-danger"
          }`}
        >
          <div className="absolute inset-0 opacity-10 [background-image:radial-gradient(circle_at_2px_2px,var(--color-primary-foreground)_1px,transparent_0)] [background-size:20px_20px]" />
          <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-foreground/20 text-primary-foreground shadow-inner backdrop-blur">
            <Icon name={isWon ? "workspace_premium" : "flag"} className="h-10 w-10" />
          </div>
          <h2 className="relative text-[28px] font-bold leading-tight text-primary-foreground">
            {isWon ? "Closed Won!" : "Close Deal Lost"}
          </h2>
          <p className="relative mt-1 text-sm text-primary-foreground/85">
            Finalize the details for <span className="font-bold">{deal.name}</span>
          </p>
        </div>

        <div className="space-y-6 p-8">
          {isWon ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="px-1 text-xs font-semibold text-text-secondary">Actual Value</span>
                <div className="relative h-[38px]">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-text-muted">
                    $
                  </span>
                  <input
                    value={actualValue}
                    onChange={(e) => setActualValue(e.target.value)}
                    className="deal-input h-full pl-7 font-bold"
                    type="number"
                    min="0"
                  />
                </div>
              </label>
              <label className="space-y-1">
                <span className="px-1 text-xs font-semibold text-text-secondary">
                  Actual Close Date
                </span>
                <input
                  value={actualCloseDate}
                  onChange={(e) => setActualCloseDate(e.target.value)}
                  className="deal-input"
                  type="date"
                />
              </label>
            </div>
          ) : (
            <label className="space-y-1">
              <span className="px-1 text-xs font-semibold text-text-secondary">Loss Reason</span>
              <select
                required
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
                className="deal-input appearance-none"
              >
                <option value="">Select a reason...</option>
                {options?.lossReasons.map((reason) => (
                  <option key={reason.id} value={reason.label}>
                    {reason.label}
                  </option>
                ))}
                <option value="Budget unavailable">Budget unavailable</option>
                <option value="Competitor selected">Competitor selected</option>
              </select>
            </label>
          )}

          <label className="space-y-1">
            <span className="px-1 text-xs font-semibold text-text-secondary">
              {isWon ? "Win Summary Note" : "Loss Summary Note"}
            </span>
            <textarea
              required
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-[100px] w-full resize-none rounded-lg border border-border bg-card p-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder={
                isWon
                  ? "What were the key drivers for this win?"
                  : "Capture what changed and what should happen next."
              }
            />
          </label>

          <div className="flex gap-4 rounded-lg border border-primary/10 bg-muted p-4">
            <div className="rounded-full bg-primary-light p-2 text-primary">
              <Icon name={isWon ? "stars" : "manage_history"} className="h-[18px] w-[18px]" />
            </div>
            <p className="text-sm leading-tight text-text-secondary">
              Completing this will move the deal to{" "}
              <span className="font-bold text-foreground">
                {targetStage?.name ?? (isWon ? "Closed Won" : "Closed Lost")}
              </span>{" "}
              and update the timeline, stage history, and forecast probability.
            </p>
          </div>
        </div>

        <footer className="flex justify-end gap-4 bg-muted p-6">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg px-6 py-2 text-xs font-semibold text-text-secondary transition-colors hover:bg-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={closeDeal.isPending || !targetStage}
            className={`rounded-lg px-8 py-2 text-xs font-semibold text-primary-foreground shadow-[var(--shadow-sm)] transition-all active:scale-95 disabled:opacity-60 ${
              isWon ? "bg-success hover:brightness-110" : "bg-danger hover:brightness-110"
            }`}
          >
            {closeDeal.isPending ? "Confirming..." : isWon ? "Confirm Win" : "Confirm Loss"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function findCloseStage(stages: PipelineStageRow[], mode: "won" | "lost") {
  const expectedWon = mode === "won";
  return (
    stages.find((stage) => stage.is_closed && stage.is_won === expectedWon) ??
    stages.find((stage) => stage.name.toLowerCase().includes(expectedWon ? "won" : "lost")) ??
    null
  );
}

function Confetti() {
  return (
    <div className="pointer-events-none fixed inset-0 z-10 overflow-hidden">
      {Array.from({ length: 48 }).map((_, index) => (
        <span
          key={index}
          className="absolute h-3 w-2 animate-[deal-confetti_2.6s_linear_infinite] rounded-sm opacity-80"
          style={{
            left: `${(index * 37) % 100}%`,
            animationDelay: `${(index % 12) * 0.12}s`,
            backgroundColor: [
              "var(--color-primary)",
              "var(--color-accent)",
              "var(--color-primary-mid)",
              "var(--color-primary-foreground)",
              "var(--color-primary-dark)",
            ][index % 5],
          }}
        />
      ))}
    </div>
  );
}
