import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useDisqualifyLead } from "@/lib/leads-data";
import { toast } from "sonner";

const REASONS = ["Not a fit", "No budget", "Bad timing", "Unresponsive", "Duplicate", "Other"];

export function DisqualifyModal({
  open,
  onOpenChange,
  leadId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadId: string;
  onDone?: () => void;
}) {
  const mut = useDisqualifyLead();
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState("");

  async function submit() {
    try {
      await mut.mutateAsync({ id: leadId, reason: note ? `${reason} — ${note}` : reason });
      toast.success("Lead disqualified");
      onOpenChange(false);
      onDone?.();
    } catch (e) {
      toast.error("Failed", { description: (e as Error).message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Disqualify lead</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-text-secondary">Reason</span>
            <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
              {REASONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-text-secondary">Note (optional)</span>
            <textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={submit} disabled={mut.isPending}>
            {mut.isPending ? "Saving..." : "Disqualify"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
