import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, ToolbarButton } from "@/components/layout";
import { ErrorState, TableSkeleton } from "@/components/common";
import { ConvertLeadModal } from "@/components/leads/ConvertLeadModal";
import { DisqualifyModal } from "@/components/leads/DisqualifyModal";
import {
  LEAD_STATUSES,
  type LeadRow,
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
  const [tab, setTab] = useState<"timeline" | "convert" | "notes" | "source">("timeline");

  if (isLoading) return <TableSkeleton rows={4} />;
  if (isError || !lead)
    return (
      <ErrorState
        description={(error as Error)?.message ?? "Lead not found"}
        onRetry={() => refetch?.()}
      />
    );

  const statusInfo = LEAD_STATUSES.find((s) => s.id === lead.status);
  const isClosed = lead.status === "converted" || lead.status === "disqualified";
  const name = `${lead.first_name} ${lead.last_name}`;
  const value =
    typeof lead.value === "number" ? money(lead.value, lead.currency ?? "USD") : "$0.00";

  return (
    <>
      <PageHeader
        title={name}
        breadcrumbs={[{ label: "Leads", to: "/app/leads" }, { label: name }]}
        actions={
          <>
            {!isClosed && (
              <>
                <ToolbarButton icon="block" onClick={() => setDisqOpen(true)}>
                  Disqualify
                </ToolbarButton>
                <ToolbarButton
                  icon="handshake"
                  variant="primary"
                  onClick={() => setConvertOpen(true)}
                >
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

      <div className="mx-auto flex max-w-[1440px] gap-6">
        <aside className="w-[320px] shrink-0 space-y-6">
          <section className="rounded-lg border border-border bg-card p-8 text-center shadow-[var(--shadow-xs)]">
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-primary text-4xl font-bold text-white shadow-[var(--shadow-md)]">
              {initials(name)}
            </div>
            <h2 className="mb-1 text-xl font-semibold text-foreground">{name}</h2>
            <p className="mb-6 text-sm text-text-secondary">
              {lead.company_name ? `Lead at ${lead.company_name}` : "Unassigned company lead"}
            </p>
            <div className="mb-8 flex flex-wrap justify-center gap-1">
              <span
                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-bold ${statusTone(lead.status)}`}
              >
                <span className="h-2 w-2 rounded-full bg-current" />
                {statusInfo?.label}
              </span>
              <span className="rounded bg-primary-light px-2 py-0.5 text-[11px] font-bold text-primary">
                {lead.source || "Manual Entry"}
              </span>
            </div>
            <dl className="space-y-3 border-y border-border/70 py-4 text-left text-sm">
              <Row label="Created">{new Date(lead.created_at).toLocaleString()}</Row>
              <Row label="Email">
                <a href={`mailto:${lead.email}`} className="text-primary hover:underline">
                  {lead.email}
                </a>
              </Row>
              <Row label="Phone">{lead.phone || "—"}</Row>
              <Row label="Value">{value}</Row>
            </dl>
          </section>

          <section className="overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-xs)]">
            <div className="border-b border-border bg-muted px-4 py-3">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                Quick Actions
              </h3>
            </div>
            <div className="space-y-2 p-4">
              <button className="flex w-full items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-white transition-opacity hover:opacity-90">
                <span className="material-symbols-outlined text-[18px]">history_edu</span>
                Log Activity
              </button>
              <button
                onClick={() => setConvertOpen(true)}
                className="flex w-full items-center gap-2 rounded-lg bg-muted px-4 py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-border"
              >
                <span className="material-symbols-outlined text-[18px]">transform</span>
                Convert to Deal
              </button>
              <button
                onClick={() => setDisqOpen(true)}
                className="flex w-full items-center gap-2 rounded-lg border border-danger/20 bg-danger-light/40 px-4 py-2.5 text-xs font-semibold text-danger transition-colors hover:bg-danger-light"
              >
                <span className="material-symbols-outlined text-[18px]">cancel</span>
                Disqualify Lead
              </button>
              {!isClosed && (
                <div className="border-t border-border pt-3">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-text-muted">
                    Move Stage
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {LEAD_STATUSES.filter(
                      (s) =>
                        s.id !== "converted" && s.id !== "disqualified" && s.id !== lead.status,
                    ).map((s) => (
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
                        className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-muted"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        </aside>

        <div className="min-w-0 flex-1 space-y-6">
          <section className="flex min-h-[600px] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-xs)]">
            <div className="flex border-b border-border px-6">
              {[
                ["timeline", "Timeline"],
                ["convert", "Convert to Deal"],
                ["notes", "Notes"],
                ["source", "Lead Source"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setTab(id as typeof tab)}
                  className={`border-b-2 px-6 py-4 text-[16px] font-semibold transition-colors ${
                    tab === id
                      ? "border-primary text-primary"
                      : "border-transparent text-text-secondary hover:text-primary"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex-1 p-6">
              {tab === "timeline" && (
                <Timeline loading={acts.isLoading} activities={acts.data ?? []} lead={lead} />
              )}
              {tab === "convert" && (
                <div className="mx-auto max-w-2xl py-12 text-center">
                  <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary-light text-primary">
                    <span className="material-symbols-outlined text-[40px]">handshake</span>
                  </div>
                  <h2 className="mb-4 text-3xl font-bold text-foreground">Graduate to Deal</h2>
                  <p className="mb-12 text-[15px] leading-6 text-text-secondary">
                    Convert this lead into a deal, link the contact to an account, and carry the
                    captured lead history into the sales cycle.
                  </p>
                  <div className="mb-12 grid grid-cols-2 gap-6 text-left">
                    <Metric label="Expected Value" value={value} />
                    <Metric label="Probability" value={lead.qualified ? "65%" : "35%"} />
                  </div>
                  <button
                    onClick={() => setConvertOpen(true)}
                    className="rounded-lg bg-primary px-16 py-4 text-xl font-semibold text-white shadow-[var(--shadow-sm)] transition-transform active:scale-95"
                  >
                    Finalize Conversion
                  </button>
                </div>
              )}
              {tab === "notes" && (
                <div className="space-y-6">
                  <div className="relative">
                    <textarea
                      className="min-h-[120px] w-full rounded-lg border border-border p-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      placeholder="Add a new internal note..."
                    />
                    <button className="absolute bottom-4 right-4 rounded-lg bg-primary px-5 py-2 text-xs font-semibold text-white">
                      Save Note
                    </button>
                  </div>
                  <div className="rounded-lg border border-border bg-muted p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">System</span>
                      <span className="text-[11px] font-semibold text-text-muted">
                        {new Date(lead.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm italic text-text-secondary">
                      {lead.message || "Lead captured and ready for first qualification notes."}
                    </p>
                  </div>
                </div>
              )}
              {tab === "source" && <LeadSourcePanel lead={lead} />}
            </div>
          </section>

          <div className="grid grid-cols-2 gap-6">
            <section className="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-xs)]">
              <h3 className="mb-4 text-[16px] font-semibold">Account Context</h3>
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                  <span className="material-symbols-outlined text-text-muted">corporate_fare</span>
                </div>
                <div>
                  <div className="text-xs font-bold text-foreground">
                    {lead.company_name || "No account linked"}
                  </div>
                  <div className="text-sm text-text-muted">{lead.source || "Manual source"}</div>
                </div>
              </div>
            </section>
            <section className="flex items-center justify-between rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-xs)]">
              <div>
                <h3 className="mb-1 text-[16px] font-semibold">Lead Score</h3>
                <div className="text-[32px] font-bold text-primary">
                  {lead.qualified ? "84" : "62"}/100
                </div>
              </div>
              <div className="relative h-16 w-16">
                <svg className="h-full w-full" viewBox="0 0 36 36">
                  <path
                    className="text-muted"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeDasharray="100, 100"
                    strokeWidth="3"
                  />
                  <path
                    className="text-primary"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeDasharray={`${lead.qualified ? 84 : 62}, 100`}
                    strokeLinecap="round"
                    strokeWidth="3"
                  />
                </svg>
              </div>
            </section>
          </div>
        </div>
      </div>

      <ConvertLeadModal open={convertOpen} onOpenChange={setConvertOpen} lead={lead} />
      <DisqualifyModal
        open={disqOpen}
        onOpenChange={setDisqOpen}
        leadId={lead.id}
        onDone={refetch}
      />
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="shrink-0 text-[12px] font-semibold text-text-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right text-sm text-foreground">{children}</dd>
    </div>
  );
}

function Timeline({
  loading,
  activities,
  lead,
}: {
  loading: boolean;
  activities: {
    id: string;
    title: string;
    type: string;
    created_at: string;
    notes: string | null;
  }[];
  lead: LeadRow;
}) {
  if (loading) return <p className="text-sm text-text-muted">Loading...</p>;

  const fallback = [
    {
      id: "welcome",
      icon: "mail",
      tone: "bg-primary text-white",
      title: "Automated Welcome Email Sent",
      time: "2 hours ago",
      body: `System triggered the new lead acknowledgement for ${lead.email}.`,
    },
    {
      id: "created",
      icon: "bolt",
      tone: "bg-accent text-accent-foreground",
      title: "Lead Created via Capture Flow",
      time: new Date(lead.created_at).toLocaleString(),
      body: `Lead captured from ${lead.source || "Manual Entry"} and routed for qualification.`,
    },
  ];

  const items = activities.length
    ? activities.map((activity) => ({
        id: activity.id,
        icon: "history",
        tone: "bg-primary text-white",
        title: activity.title,
        time: new Date(activity.created_at).toLocaleString(),
        body: activity.notes || activity.type,
      }))
    : fallback;

  return (
    <div className="space-y-8 border-l-2 border-border py-4 pl-6">
      {items.map((item) => (
        <div key={item.id} className="relative">
          <span
            className={`absolute -left-[37px] top-0 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-card ${item.tone}`}
          >
            <span className="material-symbols-outlined text-[14px]">{item.icon}</span>
          </span>
          <div className="rounded-lg bg-muted p-4">
            <div className="mb-1 flex items-start justify-between gap-4">
              <h4 className="text-[16px] font-semibold text-foreground">{item.title}</h4>
              <span className="shrink-0 text-[11px] font-semibold text-text-muted">
                {item.time}
              </span>
            </div>
            <p className="text-sm text-text-secondary">{item.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function LeadSourcePanel({ lead }: { lead: LeadRow }) {
  const payload = {
    event: lead.source?.toLowerCase().includes("landing") ? "form_submission" : "manual_entry",
    source: lead.source,
    timestamp: lead.created_at,
    data: {
      name: `${lead.first_name} ${lead.last_name}`,
      email: lead.email,
      phone: lead.phone,
      company: lead.company_name,
      message: lead.message,
    },
    metadata: {
      ip_country: lead.ip_country,
      email_status: lead.email_status,
      qualified: lead.qualified,
    },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-[16px] font-semibold">Webhook Payload Preview</h3>
        <span className="inline-flex items-center gap-1 rounded bg-green-100 px-2 py-1 text-[11px] font-bold text-green-700">
          <span className="material-symbols-outlined text-[14px]">check_circle</span>
          Delivered
        </span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-sidebar p-6 shadow-inner">
        <pre className="text-sm leading-relaxed text-primary-light">
          {JSON.stringify(payload, null, 2)}
        </pre>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Metric label="IP Country" value={lead.ip_country || "Unknown"} />
        <Metric label="Delivery Status" value={lead.email_status || "Pending"} />
        <Metric label="API Endpoint" value="v1/leads/capture" />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-text-muted">
        {label}
      </div>
      <div className="text-xl font-semibold text-foreground">{value}</div>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

function statusTone(status: LeadRow["status"]) {
  switch (status) {
    case "contacted":
      return "bg-accent-light text-accent-foreground";
    case "qualified":
      return "bg-success-light text-success";
    case "converted":
      return "bg-primary-light text-primary";
    case "disqualified":
      return "bg-danger-light text-danger";
    default:
      return "bg-primary-light text-primary";
  }
}
