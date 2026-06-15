import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/common";
import { CloseDealModal } from "@/components/deals/CloseDealModal";
import {
  type ActivityRow,
  type ContactRow,
  type DealDetail,
  type DealSummary,
  useDeal,
  useDealFormOptions,
} from "@/lib/deals-data";
import { formatCurrency, formatRelative } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/deals/$id")({
  component: DealDetailPage,
});

type Tab = "timeline" | "activities" | "proposals" | "contacts" | "history";

function DealDetailPage() {
  const { id } = Route.useParams();
  const { data: deal, isLoading, isError, error, refetch } = useDeal(id);
  const { data: options } = useDealFormOptions();
  const [tab, setTab] = useState<Tab>("timeline");
  const [closeMode, setCloseMode] = useState<"won" | "lost" | null>(null);

  const nextStage = useMemo(() => {
    if (!deal || !options?.stages) return null;
    return (
      options.stages.find((stage) => stage.position > (deal.stage?.position ?? 0)) ??
      options.stages.find((stage) => stage.is_closed && stage.is_won) ??
      null
    );
  }, [deal, options?.stages]);

  if (isLoading) return <DealDetailSkeleton />;
  if (isError) {
    return (
      <ErrorState
        description={(error as Error)?.message ?? "Could not load deal"}
        onRetry={() => refetch()}
      />
    );
  }
  if (!deal) {
    return (
      <EmptyState
        icon={<span className="material-symbols-outlined text-[28px]">handshake</span>}
        title="Deal not found"
        description="This opportunity may have been deleted or moved."
      />
    );
  }

  return (
    <>
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6 lg:flex-row">
        <aside className="flex w-full flex-col gap-6 lg:w-[350px]">
          <DealHeaderCard deal={deal} onCloseWon={() => setCloseMode("won")} />
          <ProbabilityCard deal={deal} />
          <ClientCard deal={deal} />
          <div className="flex flex-col gap-2">
            <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-bold text-white shadow-[var(--shadow-sm)] transition-all hover:brightness-110">
              <span className="material-symbols-outlined">edit_note</span>
              Log Activity
            </button>
            <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card py-3 text-sm font-bold text-foreground transition-all hover:bg-muted">
              <span className="material-symbols-outlined">mail</span>
              Send Email
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setCloseMode("won")}
                className="rounded-lg bg-success px-4 py-2 text-xs font-bold text-white transition-all hover:brightness-110"
              >
                Close Won
              </button>
              <button
                onClick={() => setCloseMode("lost")}
                className="rounded-lg bg-danger-light px-4 py-2 text-xs font-bold text-danger transition-all hover:bg-danger hover:text-white"
              >
                Close Lost
              </button>
            </div>
          </div>
        </aside>

        <main className="flex flex-1 flex-col gap-6">
          <section className="flex min-h-[600px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-xs)]">
            <div className="flex overflow-x-auto border-b border-border px-6">
              <TabButton tab="timeline" current={tab} icon="history" onClick={setTab}>
                Timeline
              </TabButton>
              <TabButton tab="activities" current={tab} icon="task_alt" onClick={setTab}>
                Activities
              </TabButton>
              <TabButton tab="proposals" current={tab} icon="description" onClick={setTab}>
                Proposals
              </TabButton>
              <TabButton tab="contacts" current={tab} icon="group" onClick={setTab}>
                Contacts
              </TabButton>
              <TabButton tab="history" current={tab} icon="manage_history" onClick={setTab}>
                Value History
              </TabButton>
            </div>
            <div className="flex-1 p-6">
              {tab === "timeline" ? <TimelinePanel deal={deal} /> : null}
              {tab === "activities" ? <ActivitiesPanel activities={deal.activities} /> : null}
              {tab === "proposals" ? <ProposalsPanel /> : null}
              {tab === "contacts" ? <ContactsPanel contacts={deal.contacts} /> : null}
              {tab === "history" ? <HistoryPanel deal={deal} /> : null}
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="flex gap-4 rounded-xl border border-warning/20 bg-warning-light p-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-warning text-white">
                <span className="material-symbols-outlined text-[28px]">lightbulb</span>
              </div>
              <div>
                <h3 className="text-[16px] font-semibold text-[#92400E]">AI Opportunity Insight</h3>
                <p className="mt-1 text-sm text-[#92400E]/80">
                  Similar deals closed 15% faster when a technical demo was scheduled before legal
                  review.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-xs)]">
              <div>
                <h3 className="text-[16px] font-semibold text-foreground">Next Milestone</h3>
                <p className="text-sm text-text-secondary">
                  {nextStage?.name ?? "Technical Proof of Concept (PoC)"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-bold uppercase text-text-muted">Target Date</p>
                <p className="text-[16px] font-semibold text-primary">
                  {deal.expected_close_date
                    ? new Date(deal.expected_close_date).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "Unscheduled"}
                </p>
              </div>
            </div>
          </section>
        </main>
      </div>

      {closeMode ? (
        <CloseDealModal
          deal={deal}
          mode={closeMode}
          open={!!closeMode}
          onOpenChange={(open) => {
            if (!open) setCloseMode(null);
          }}
        />
      ) : null}
    </>
  );
}

function DealHeaderCard({ deal, onCloseWon }: { deal: DealSummary; onCloseWon: () => void }) {
  const closeStatus = dueStatus(deal.expected_close_date);
  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-xs)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <span className="mb-1 inline-block rounded bg-primary-light px-2 py-1 text-[11px] font-bold text-primary">
            {deal.stage?.name ?? "Pipeline Phase"}
          </span>
          <h1 className="text-[20px] font-semibold text-foreground">{deal.name}</h1>
        </div>
        <button className="text-text-muted hover:text-primary">
          <span className="material-symbols-outlined">more_vert</span>
        </button>
      </div>
      <div className="mb-6">
        <p className="text-[11px] font-bold uppercase text-text-muted">Deal Value</p>
        <p className="text-[36px] font-bold leading-tight text-foreground">
          {formatCurrency(Number(deal.value ?? 0), deal.currency ?? "USD")}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
        <div>
          <p className="text-[11px] font-bold text-text-muted">Close Date</p>
          <div
            className={`mt-1 flex items-center gap-1 text-sm font-bold ${closeStatus.className}`}
          >
            <span className="material-symbols-outlined text-[18px]">{closeStatus.icon}</span>
            {closeStatus.label}
          </div>
        </div>
        <div>
          <p className="text-[11px] font-bold text-text-muted">Assigned Rep</p>
          <div className="mt-1 flex items-center gap-2">
            <AvatarLabel label={deal.assigned_rep?.full_name ?? "Unassigned"} size="sm" />
            <span className="text-sm">{deal.assigned_rep?.full_name ?? "Unassigned"}</span>
          </div>
        </div>
      </div>
      <button
        onClick={onCloseWon}
        className="mt-5 w-full rounded-lg bg-primary py-2 text-xs font-bold text-white transition-all hover:brightness-110"
      >
        Move to Won
      </button>
    </section>
  );
}

function ProbabilityCard({ deal }: { deal: DealSummary }) {
  const probability = Math.max(0, Math.min(100, Number(deal.probability ?? 0)));
  const dash = 364.4 - (364.4 * probability) / 100;
  return (
    <section className="rounded-xl border border-border bg-card p-6 text-center shadow-[var(--shadow-xs)]">
      <h2 className="mb-6 text-left text-[16px] font-semibold text-foreground">Win Probability</h2>
      <div className="relative mx-auto mb-4 h-32 w-32">
        <svg className="h-full w-full -rotate-90">
          <circle
            className="text-muted"
            cx="64"
            cy="64"
            fill="transparent"
            r="58"
            stroke="currentColor"
            strokeWidth="10"
          />
          <circle
            className="text-primary"
            cx="64"
            cy="64"
            fill="transparent"
            r="58"
            stroke="currentColor"
            strokeDasharray="364.4"
            strokeDashoffset={dash}
            strokeWidth="10"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[20px] font-semibold text-foreground">{probability}%</span>
          <span className="text-[11px] font-bold text-text-muted">
            {probability >= 70 ? "Likely" : probability >= 40 ? "Active" : "Early"}
          </span>
        </div>
      </div>
      <p className="px-4 text-sm text-text-secondary">
        Confidence score based on activity levels and milestone completion.
      </p>
    </section>
  );
}

function ClientCard({ deal }: { deal: DealSummary }) {
  const contactName = deal.primary_contact
    ? `${deal.primary_contact.first_name} ${deal.primary_contact.last_name}`
    : "Primary contact";
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-xs)]">
      <div className="border-b border-border bg-muted p-4">
        <h2 className="text-[11px] font-bold uppercase text-foreground">Client Entity</h2>
      </div>
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-light text-primary">
            <span className="material-symbols-outlined text-[28px]">domain</span>
          </div>
          <div>
            <p className="text-[16px] font-semibold text-foreground">
              {deal.company?.name ?? "No company"}
            </p>
            <p className="text-sm text-text-secondary">
              {deal.company?.industry ?? "Business account"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 border-t border-border pt-4">
          <AvatarLabel label={contactName} size="md" />
          <div>
            <p className="font-semibold text-foreground">{contactName}</p>
            <p className="text-sm text-text-secondary">
              {deal.primary_contact?.job_title ?? "Primary Point"}
            </p>
          </div>
          {deal.primary_contact ? (
            <Link
              to="/app/contacts/$id"
              params={{ id: deal.primary_contact.id }}
              className="ml-auto rounded p-1 text-primary hover:bg-primary-light"
            >
              <span className="material-symbols-outlined">open_in_new</span>
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function TabButton({
  tab,
  current,
  icon,
  children,
  onClick,
}: {
  tab: Tab;
  current: Tab;
  icon: string;
  children: ReactNode;
  onClick: (tab: Tab) => void;
}) {
  const active = tab === current;
  return (
    <button
      onClick={() => onClick(tab)}
      className={`flex items-center gap-1 whitespace-nowrap border-b-2 px-6 py-4 text-sm font-semibold transition-colors ${
        active
          ? "border-primary text-primary"
          : "border-transparent text-text-secondary hover:text-primary"
      }`}
    >
      <span className="material-symbols-outlined text-[18px]">{icon}</span>
      {children}
    </button>
  );
}

function TimelinePanel({ deal }: { deal: DealDetail }) {
  const timeline = [
    ...deal.stage_history.map((item) => ({
      id: item.id,
      icon: "check_circle",
      title: `Moved to ${item.to?.name ?? "new stage"}`,
      text: item.from ? `Previous stage: ${item.from.name}` : "Pipeline stage updated.",
      time: item.changed_at,
      tone: "bg-primary text-white",
    })),
    ...deal.activities.slice(0, 5).map((activity) => ({
      id: activity.id,
      icon: activityIcon(activity),
      title: activity.title,
      text: activity.notes ?? activity.outcome ?? "Activity logged on this deal.",
      time: activity.created_at,
      tone: activity.type === "email" ? "bg-secondary text-white" : "bg-warning text-white",
    })),
  ].sort((a, b) => new Date(b.time ?? 0).getTime() - new Date(a.time ?? 0).getTime());

  if (!timeline.length) {
    return (
      <EmptyState
        icon={<span className="material-symbols-outlined text-[28px]">history</span>}
        title="No timeline yet"
        description="Stage movements and activities will appear here."
      />
    );
  }

  return (
    <div className="relative space-y-6 before:absolute before:bottom-0 before:left-[19px] before:top-4 before:w-[2px] before:bg-border">
      {timeline.map((item) => (
        <div key={item.id} className="relative pl-16">
          <div
            className={`absolute left-0 top-1 z-10 flex h-10 w-10 items-center justify-center rounded-full shadow-[var(--shadow-sm)] ${item.tone}`}
          >
            <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
          </div>
          <div className="rounded-lg border border-border bg-muted p-4">
            <div className="mb-2 flex items-start justify-between gap-4">
              <h3 className="text-[16px] font-semibold text-foreground">{item.title}</h3>
              <span className="text-[11px] font-semibold text-text-muted">
                {formatRelative(item.time ?? new Date())}
              </span>
            </div>
            <p className="text-sm text-text-secondary">{item.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ActivitiesPanel({ activities }: { activities: ActivityRow[] }) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[16px] font-semibold text-foreground">Upcoming Activities</h3>
        <button className="text-xs font-bold text-primary">+ New Task</button>
      </div>
      <div className="space-y-2">
        {activities.length ? (
          activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-center gap-4 rounded-lg border border-border p-4 transition-colors hover:bg-muted"
            >
              <input className="h-5 w-5 rounded border-border text-primary" type="checkbox" />
              <div className="flex-1">
                <p className="font-semibold text-foreground">{activity.title}</p>
                <p className="text-sm text-text-secondary">
                  {activity.due_at
                    ? formatRelative(activity.due_at)
                    : formatRelative(activity.created_at)}
                </p>
              </div>
              <span className="rounded-full bg-primary-light px-2 py-1 text-[11px] font-bold text-primary">
                {activity.type}
              </span>
            </div>
          ))
        ) : (
          <EmptyState
            icon={<span className="material-symbols-outlined text-[28px]">task_alt</span>}
            title="No activities"
            description="Calls, emails, demos, and notes will appear here."
          />
        )}
      </div>
    </div>
  );
}

function ProposalsPanel() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <ProposalCard
        icon="picture_as_pdf"
        title="Master_Agreement_v2.pdf"
        detail="Uploaded Oct 24 • 4.2 MB"
      />
      <ProposalCard
        icon="description"
        title="Technical_Specs_Draft.docx"
        detail="Uploaded Oct 21 • 1.1 MB"
      />
      <button className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-4 text-text-secondary transition-colors hover:bg-muted">
        <span className="material-symbols-outlined text-[40px] text-text-muted">upload_file</span>
        <span className="text-sm font-semibold">Upload New Document</span>
      </button>
    </div>
  );
}

function ProposalCard({ icon, title, detail }: { icon: string; title: string; detail: string }) {
  return (
    <div className="flex min-h-36 cursor-pointer flex-col items-center gap-2 rounded-lg border border-border p-4 text-center transition-colors hover:border-primary">
      <span className="material-symbols-outlined text-[40px] text-primary">{icon}</span>
      <span className="text-sm font-semibold text-foreground">{title}</span>
      <span className="text-[10px] text-text-muted">{detail}</span>
    </div>
  );
}

function ContactsPanel({ contacts }: { contacts: ContactRow[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {contacts.map((contact) => {
        const name = `${contact.first_name} ${contact.last_name}`;
        return (
          <Link
            key={contact.id}
            to="/app/contacts/$id"
            params={{ id: contact.id }}
            className="flex items-center gap-4 rounded-lg border border-border p-4 transition-colors hover:border-primary"
          >
            <AvatarLabel label={name} size="lg" />
            <div>
              <p className="text-[16px] font-semibold text-foreground">{name}</p>
              <p className="text-sm text-text-secondary">{contact.job_title ?? "Stakeholder"}</p>
            </div>
            <span className="material-symbols-outlined ml-auto text-text-muted">chat</span>
          </Link>
        );
      })}
    </div>
  );
}

function HistoryPanel({ deal }: { deal: DealDetail }) {
  return (
    <table className="w-full text-left">
      <thead className="bg-muted">
        <tr>
          <th className="p-4 text-[11px] font-bold uppercase text-text-muted">Date</th>
          <th className="p-4 text-[11px] font-bold uppercase text-text-muted">Reason</th>
          <th className="p-4 text-[11px] font-bold uppercase text-text-muted">Previous Value</th>
          <th className="p-4 text-[11px] font-bold uppercase text-text-muted">New Value</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {deal.value_history.length ? (
          deal.value_history.map((item) => (
            <tr key={item.id}>
              <td className="p-4 text-sm">{new Date(item.changed_at).toLocaleDateString()}</td>
              <td className="p-4 text-sm">{item.reason ?? "Value updated"}</td>
              <td className="p-4 text-sm text-text-muted">
                {formatCurrency(Number(item.old_value ?? 0), deal.currency ?? "USD")}
              </td>
              <td className="p-4 text-sm font-bold text-foreground">
                {formatCurrency(Number(item.new_value ?? 0), deal.currency ?? "USD")}
              </td>
            </tr>
          ))
        ) : (
          <tr>
            <td className="p-6 text-sm text-text-muted" colSpan={4}>
              No value changes recorded.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function AvatarLabel({ label, size }: { label: string; size: "sm" | "md" | "lg" }) {
  const initials = label
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const dimensions =
    size === "sm" ? "h-6 w-6 text-[10px]" : size === "md" ? "h-10 w-10" : "h-12 w-12";
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-primary-light font-bold text-primary ${dimensions}`}
    >
      {initials}
    </span>
  );
}

function activityIcon(activity: ActivityRow) {
  if (activity.type === "email") return "mail";
  if (activity.type === "call") return "call";
  if (activity.type === "meeting") return "event";
  if (activity.type === "proposal") return "description";
  if (activity.type === "demo") return "present_to_all";
  return "edit_note";
}

function dueStatus(date: string | null) {
  if (!date) return { label: "No date", icon: "event", className: "text-text-secondary" };
  const due = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (diff < 0) {
    return {
      label: `${Math.abs(diff)} Days Overdue`,
      icon: "event_busy",
      className: "text-danger",
    };
  }
  if (diff === 0) return { label: "Due Today", icon: "event", className: "text-warning" };
  return { label: due.toLocaleDateString(), icon: "event", className: "text-foreground" };
}

function DealDetailSkeleton() {
  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-6 lg:flex-row">
      <aside className="flex w-full flex-col gap-6 lg:w-[350px]">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </aside>
      <main className="flex-1">
        <CardSkeleton className="min-h-[600px]" />
      </main>
    </div>
  );
}
