import { type FormEvent, useMemo, useState } from "react";
import {
  type DealSummary,
  type PipelineStageRow,
  useCloseDeal,
  useDealFormOptions,
} from "@/lib/deals-data";

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
    await closeDeal.mutateAsync({
      dealId: deal.id,
      mode,
      stageId: targetStage.id,
      actualValue: Number(actualValue || deal.value || 0),
      actualCloseDate,
      note,
      lostReason,
    });
    onOpenChange(false);
  }

  const isWon = mode === "won";

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-foreground/60 p-6 backdrop-blur-sm">
      {isWon ? <Confetti /> : null}
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-[520px] overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
      >
        <div
          className={`relative overflow-hidden px-8 py-8 text-center ${
            isWon ? "bg-primary" : "bg-danger"
          }`}
        >
          <div className="absolute inset-0 opacity-10 [background-image:radial-gradient(circle_at_2px_2px,#fff_1px,transparent_0)] [background-size:20px_20px]" />
          <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/20 text-white shadow-inner backdrop-blur">
            <span
              className="material-symbols-outlined text-[40px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              {isWon ? "workspace_premium" : "flag"}
            </span>
          </div>
          <h2 className="relative text-[28px] font-bold leading-tight text-white">
            {isWon ? "Closed Won!" : "Close Deal Lost"}
          </h2>
          <p className="relative mt-1 text-sm text-white/85">
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
              required={!isWon}
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
              <span className="material-symbols-outlined text-[18px]">
                {isWon ? "stars" : "manage_history"}
              </span>
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
            className={`rounded-lg px-8 py-2 text-xs font-semibold text-white shadow-[var(--shadow-sm)] transition-all active:scale-95 disabled:opacity-60 ${
              isWon ? "bg-danger hover:brightness-110" : "bg-danger hover:brightness-110"
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
            backgroundColor: ["#0057b8", "#ffd700", "#adc7ff", "#ffffff", "#00408b"][index % 5],
          }}
        />
      ))}
    </div>
  );
}
