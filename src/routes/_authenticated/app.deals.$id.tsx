import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, ToolbarButton, SectionCard } from "@/components/layout";
import { ErrorState, TableSkeleton } from "@/components/common";
import { CloseDealModal } from "@/components/deals/CloseDealModal";
import {
  useDeal,
  useDealStageHistory,
  useDealValueHistory,
  usePipelineStages,
  useUpdateDealStage,
} from "@/lib/deals-data";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/deals/$id")({
  component: DealDetail,
});

function DealDetail() {
  const { id } = Route.useParams();
  const { data: deal, isLoading, isError, error, refetch } = useDeal(id);
  const stages = usePipelineStages();
  const history = useDealStageHistory(id);
  const valueHist = useDealValueHistory(id);
  const update = useUpdateDealStage();
  const [closeVariant, setCloseVariant] = useState<"won" | "lost" | null>(null);

  if (isLoading) return <TableSkeleton rows={4} />;
  if (isError || !deal)
    return (
      <ErrorState
        description={(error as Error)?.message ?? "Deal not found"}
        onRetry={() => refetch?.()}
      />
    );

  const currentStage = stages.data?.find((s) => s.id === deal.stage_id);
  const isClosed = currentStage?.is_closed ?? false;
  const openStages = (stages.data ?? []).filter((s) => !s.is_closed);

  return (
    <>
      <PageHeader
        title={deal.name}
        breadcrumbs={[
          { label: "Deals", to: "/app/deals" },
          { label: deal.name },
        ]}
        actions={
          !isClosed ? (
            <>
              <ToolbarButton icon="close" onClick={() => setCloseVariant("lost")}>
                Close Lost
              </ToolbarButton>
              <ToolbarButton icon="emoji_events" variant="primary" onClick={() => setCloseVariant("won")}>
                Close Won
              </ToolbarButton>
            </>
          ) : null
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <SectionCard title="Deal details">
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <Row label="Stage">
                <span
                  className="inline-block rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
                  style={{ backgroundColor: currentStage?.color ?? "#999" }}
                >
                  {currentStage?.name ?? "—"}
                </span>
              </Row>
              <Row label="Probability">{deal.probability}%</Row>
              <Row label="Value">{formatCurrency(Number(deal.value), deal.currency)}</Row>
              <Row label="Currency">{deal.currency}</Row>
              <Row label="Contact">
                {deal.primary_contact ? (
                  <Link
                    to="/app/contacts/$id"
                    params={{ id: deal.primary_contact.id }}
                    className="text-primary hover:underline"
                  >
                    {deal.primary_contact.first_name} {deal.primary_contact.last_name}
                  </Link>
                ) : (
                  "—"
                )}
              </Row>
              <Row label="Company">
                {deal.company ? (
                  <Link
                    to="/app/companies/$id"
                    params={{ id: deal.company.id }}
                    className="text-primary hover:underline"
                  >
                    {deal.company.name}
                  </Link>
                ) : (
                  "—"
                )}
              </Row>
              <Row label="Expected Close">{deal.expected_close_date ?? "—"}</Row>
              <Row label="Actual Close">{deal.actual_close_date ?? "—"}</Row>
              {deal.actual_value !== null && (
                <Row label="Actual Value">
                  {formatCurrency(Number(deal.actual_value), deal.currency)}
                </Row>
              )}
              {deal.lost_reason && <Row label="Lost reason">{deal.lost_reason}</Row>}
            </dl>

            {!isClosed && (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                <span className="text-xs font-semibold text-text-secondary">Move to:</span>
                {openStages
                  .filter((s) => s.id !== deal.stage_id)
                  .map((s) => (
                    <button
                      key={s.id}
                      onClick={() =>
                        update.mutate(
                          {
                            id: deal.id,
                            from_stage: deal.stage_id,
                            to_stage: s.id,
                            probability: s.default_probability,
                          },
                          {
                            onSuccess: () => toast.success(`Moved to ${s.name}`),
                            onError: (e) => toast.error((e as Error).message),
                          }
                        )
                      }
                      className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold hover:bg-surface-hover"
                    >
                      {s.name}
                    </button>
                  ))}
              </div>
            )}
          </SectionCard>

          {deal.description && (
            <SectionCard title="Description">
              <p className="whitespace-pre-wrap text-sm text-text-secondary">{deal.description}</p>
            </SectionCard>
          )}

          <SectionCard title="Stage history">
            {history.isLoading ? (
              <p className="text-sm text-text-muted">Loading…</p>
            ) : (history.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-text-muted">No stage changes yet.</p>
            ) : (
              <ul className="space-y-2">
                {history.data!.map((h) => (
                  <li
                    key={h.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-text-secondary">
                        {h.from?.name ?? "—"} → <strong>{h.to?.name}</strong>
                      </span>
                    </div>
                    <span className="text-xs text-text-muted">
                      {new Date(h.changed_at).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Value history">
            {valueHist.isLoading ? (
              <p className="text-sm text-text-muted">Loading…</p>
            ) : (valueHist.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-text-muted">
                Value changes are version-tracked and shown here.
              </p>
            ) : (
              <ul className="space-y-2">
                {valueHist.data!.map((h) => (
                  <li key={h.id} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm">
                    <p>
                      {h.old_value ? formatCurrency(Number(h.old_value), deal.currency) : "—"} →{" "}
                      <strong>
                        {h.new_value ? formatCurrency(Number(h.new_value), deal.currency) : "—"}
                      </strong>
                    </p>
                    <p className="text-xs text-text-muted">
                      {new Date(h.changed_at).toLocaleString()}
                      {h.reason ? ` · ${h.reason}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Meta">
            <dl className="space-y-3 text-sm">
              <Row label="Created">{new Date(deal.created_at).toLocaleString()}</Row>
              <Row label="Updated">{new Date(deal.updated_at).toLocaleString()}</Row>
              <Row label="Assigned to">
                {deal.assigned_to ? (
                  <span className="font-mono text-xs">{deal.assigned_to.slice(0, 8)}…</span>
                ) : (
                  "Unassigned"
                )}
              </Row>
            </dl>
          </SectionCard>
        </div>
      </div>

      {closeVariant && (
        <CloseDealModal
          open
          onOpenChange={(o) => !o && setCloseVariant(null)}
          variant={closeVariant}
          dealId={deal.id}
          currentStageId={deal.stage_id}
          currentValue={Number(deal.value)}
          currency={deal.currency}
        />
      )}
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wider text-text-muted">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
