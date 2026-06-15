import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, ToolbarButton, SectionCard } from "@/components/layout";
import { ErrorState, TableSkeleton } from "@/components/common";
import { ConvertLeadModal } from "@/components/leads/ConvertLeadModal";
import { DisqualifyModal } from "@/components/leads/DisqualifyModal";
import {
  LEAD_STATUSES,
  useLead,
  useLeadActivities,
  useUpdateLeadStatus,
} from "@/lib/leads-data";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/leads/$id")({
  component: LeadDetail,
});

function LeadDetail() {
  const { id } = Route.useParams();
  const { data: lead, isLoading, isError, error, refetch } = useLead(id);
  const acts = useLeadActivities(lead?.email);
  const update = useUpdateLeadStatus();
  const [convertOpen, setConvertOpen] = useState(false);
  const [disqOpen, setDisqOpen] = useState(false);

  if (isLoading) return <TableSkeleton rows={4} />;
  if (isError || !lead)
    return <ErrorState description={(error as Error)?.message ?? "Lead not found"} onRetry={() => refetch?.()} />;

  const statusInfo = LEAD_STATUSES.find((s) => s.id === lead.status);
  const isClosed = lead.status === "converted" || lead.status === "disqualified";

  return (
    <>
      <PageHeader
        title={`${lead.first_name} ${lead.last_name}`}
        breadcrumbs={[{ label: "Leads", to: "/app/leads" }, { label: `${lead.first_name} ${lead.last_name}` }]}
        actions={
          <>
            {!isClosed && (
              <>
                <ToolbarButton icon="block" onClick={() => setDisqOpen(true)}>Disqualify</ToolbarButton>
                <ToolbarButton icon="handshake" variant="primary" onClick={() => setConvertOpen(true)}>
                  Convert to deal
                </ToolbarButton>
              </>
            )}
            {lead.converted_deal_id && (
              <Link
                to="/app/deals"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2.5 text-[13px] font-semibold text-primary-foreground"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                View deal
              </Link>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <SectionCard title="Contact details">
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <Row label="Status">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${statusInfo?.color}`}>{statusInfo?.label}</span>
              </Row>
              <Row label="Email"><a href={`mailto:${lead.email}`} className="text-primary hover:underline">{lead.email}</a></Row>
              <Row label="Phone">{lead.phone || "—"}</Row>
              <Row label="Company">{lead.company_name || "—"}</Row>
              <Row label="Assigned to">{lead.assigned_to ? <span className="font-mono text-xs">{lead.assigned_to.slice(0, 8)}…</span> : "Unassigned"}</Row>
              <Row label="Created">{new Date(lead.created_at).toLocaleString()}</Row>
            </dl>
            {!isClosed && (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                <span className="text-xs font-semibold text-text-secondary">Move to:</span>
                {LEAD_STATUSES.filter((s) => s.id !== "converted" && s.id !== "disqualified" && s.id !== lead.status).map((s) => (
                  <button
                    key={s.id}
                    onClick={() =>
                      update.mutate(
                        { id: lead.id, status: s.id },
                        {
                          onSuccess: () => toast.success(`Moved to ${s.label}`),
                          onError: (e) => toast.error((e as Error).message),
                        },
                      )
                    }
                    className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold hover:bg-surface-hover"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </SectionCard>

          {lead.message && (
            <SectionCard title="Message">
              <p className="whitespace-pre-wrap text-sm text-text-secondary">{lead.message}</p>
            </SectionCard>
          )}

          <SectionCard title="Activity timeline">
            {acts.isLoading ? (
              <p className="text-sm text-text-muted">Loading…</p>
            ) : (acts.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-text-muted">No activities yet. Log a call or email from the contact record after qualifying.</p>
            ) : (
              <ul className="space-y-3">
                {acts.data!.map((a) => (
                  <li key={a.id} className="flex gap-3 rounded-lg border border-border bg-surface p-3">
                    <span className="material-symbols-outlined text-primary">history</span>
                    <div>
                      <p className="text-sm font-semibold">{a.title}</p>
                      <p className="text-xs text-text-muted">{a.type} · {new Date(a.created_at).toLocaleString()}</p>
                      {a.notes && <p className="mt-1 text-sm text-text-secondary">{a.notes}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Lead-capture payload">
            <dl className="space-y-3 text-sm">
              <Row label="Source">{lead.source}</Row>
              <Row label="Submitted">{new Date(lead.created_at).toLocaleString()}</Row>
              <Row label="IP country">{lead.ip_country || "—"}</Row>
              <Row label="Email status">
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold capitalize">{lead.email_status || "—"}</span>
              </Row>
              <Row label="Qualified">{lead.qualified ? "Yes" : "No"}</Row>
              {lead.disqualify_reason && <Row label="Disqualify reason">{lead.disqualify_reason}</Row>}
            </dl>
          </SectionCard>

          <SectionCard title="Quick notes">
            <p className="text-xs text-text-muted">
              Notes are captured on the converted contact after qualification. Activities and notes logged on this lead
              follow the contact through conversion.
            </p>
          </SectionCard>
        </div>
      </div>

      <ConvertLeadModal open={convertOpen} onOpenChange={setConvertOpen} lead={lead} />
      <DisqualifyModal open={disqOpen} onOpenChange={setDisqOpen} leadId={lead.id} onDone={refetch} />
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
