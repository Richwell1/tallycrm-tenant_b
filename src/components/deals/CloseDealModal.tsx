import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useCloseWonDeal, useCloseLostDeal, useLossReasons, usePipelineStages } from "@/lib/deals-data";

type Variant = "won" | "lost";

export function CloseDealModal({
  open,
  onOpenChange,
  variant,
  dealId,
  currentStageId,
  currentValue,
  currency,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  variant: Variant;
  dealId: string;
  currentStageId: string;
  currentValue: number;
  currency: string;
}) {
  const stages = usePipelineStages();
  const reasons = useLossReasons();
  const won = useCloseWonDeal();
  const lost = useCloseLostDeal();

  const [actualValue, setActualValue] = useState(String(currentValue));
  const [actualDate, setActualDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (open) {
      setActualValue(String(currentValue));
      setActualDate(new Date().toISOString().slice(0, 10));
      setReason("");
    }
  }, [open, currentValue]);

  const wonStage = stages.data?.find((s) => s.is_won);
  const lostStage = stages.data?.find((s) => s.is_closed && !s.is_won);

  async function submit() {
    try {
      if (variant === "won" && wonStage) {
        await won.mutateAsync({
          id: dealId,
          from_stage: currentStageId,
          won_stage_id: wonStage.id,
          actual_value: Number(actualValue),
          actual_close_date: actualDate,
        });
        toast.success("Deal Closed Won! 🎉");
        setShowConfetti(true);
        setTimeout(() => {
          setShowConfetti(false);
          onOpenChange(false);
        }, 1500);
      } else if (variant === "lost" && lostStage) {
        if (!reason.trim()) {
          toast.error("Reason required for Closed Lost");
          return;
        }
        await lost.mutateAsync({
          id: dealId,
          from_stage: currentStageId,
          lost_stage_id: lostStage.id,
          reason,
        });
        toast.success("Deal closed as Lost");
        onOpenChange(false);
      }
    } catch (e) {
      toast.error("Could not close deal", { description: (e as Error).message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{variant === "won" ? "Close Deal — Won" : "Close Deal — Lost"}</DialogTitle>
          <p className="text-sm text-text-secondary">
            {variant === "won"
              ? "Confirm the final sale value and close date."
              : "Capture a reason — this powers loss analytics."}
          </p>
        </DialogHeader>

        {showConfetti && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-7xl">
            🎉
          </div>
        )}

        <div className="space-y-4">
          {variant === "won" ? (
            <>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-text-secondary">
                  Actual Value ({currency})
                </span>
                <input
                  type="number"
                  className="input"
                  value={actualValue}
                  onChange={(e) => setActualValue(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-text-secondary">
                  Actual Close Date
                </span>
                <input
                  type="date"
                  className="input"
                  value={actualDate}
                  onChange={(e) => setActualDate(e.target.value)}
                />
              </label>
            </>
          ) : (
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-text-secondary">
                Reason for Loss *
              </span>
              <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="">— Select reason —</option>
                {(reasons.data ?? []).map((r) => (
                  <option key={r.id} value={r.label}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={won.isPending || lost.isPending}>
            {variant === "won" ? "Mark Won" : "Mark Lost"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
