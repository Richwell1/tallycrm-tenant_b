import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ErrorState, TableSkeleton } from "@/components/common";
import { type ContactDetail, useContact } from "@/lib/contacts-data";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/contacts/$id")({
  component: ContactDetailPage,
});

type Tab = "overview" | "deals" | "activities" | "notes" | "origin";

function ContactDetailPage() {
  const { id } = Route.useParams();
  const { data: contact, isLoading, isError, error, refetch } = useContact(id);
  const [tab, setTab] = useState<Tab>("overview");

  if (isLoading) return <TableSkeleton rows={8} />;
  if (isError || !contact) {
    return (
      <ErrorState
        description={(error as Error)?.message ?? "Contact not found"}
        onRetry={() => refetch()}
      />
    );
  }

  const name = `${contact.first_name} ${contact.last_name}`;

  return (
    <div className="-m-6 flex h-[calc(100vh-64px)] overflow-hidden bg-background">
      <section className="w-[30%] min-w-[320px] overflow-y-auto border-r border-border bg-card p-6">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="relative mb-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-primary-light bg-primary text-2xl font-bold text-white">
              {initials(name)}
            </div>
            <div className="absolute bottom-0 right-0 h-5 w-5 rounded-full border-2 border-white bg-green-500" />
          </div>
          <h1 className="mb-1 text-[24px] font-semibold text-foreground">{name}</h1>
          <p className="text-sm text-text-secondary">{contact.job_title || "Contact"}</p>
          <p className="text-xs font-bold text-primary">
            {contact.company?.name || "No company linked"}
          </p>
          <div className="mt-4 flex gap-1">
            <Tags tags={contact.tags?.length ? contact.tags : fallbackTags(contact)} />
          </div>
        </div>

        <div className="mb-8 space-y-8">
          <InfoSection title="Contact Information">
            <InfoLine icon="mail" value={contact.email || "No email"} />
            <InfoLine icon="call" value={contact.phone || "No phone"} />
            <InfoLine icon="smartphone" value={contact.phone || "No mobile"} />
            <InfoLine
              icon="location_on"
              value={
                [contact.company?.city, contact.company?.country].filter(Boolean).join(", ") ||
                "No location"
              }
            />
          </InfoSection>

          <InfoSection title="Assigned Representative">
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted p-2">
              <RepAvatar contact={contact} size="lg" />
              <div>
                <p className="text-xs font-semibold text-foreground">
                  {contact.assigned_rep?.full_name || "Unassigned"}
                </p>
                <p className="text-[10px] text-text-secondary">Senior Account Executive</p>
              </div>
            </div>
          </InfoSection>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <ActionButton icon="mail" label="Email" />
          <ActionButton icon="call" label="Call" />
          <ActionButton icon="event" label="Meet" />
          <ActionButton icon="note_add" label="Note" />
        </div>
      </section>

      <section className="w-[70%] overflow-y-auto bg-background">
        <div className="sticky top-0 z-30 border-b border-border bg-card px-6 pt-4">
          <div className="flex gap-8 overflow-x-auto">
            {[
              ["overview", "Overview"],
              ["deals", `Deals (${contact.deals.length})`],
              ["activities", "Activities"],
              ["notes", "Notes"],
              ["origin", "Lead Origin"],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id as Tab)}
                className={`whitespace-nowrap border-b-2 pb-4 text-xs font-semibold transition-colors ${
                  tab === id
                    ? "border-primary text-primary"
                    : "border-transparent text-text-secondary hover:text-primary"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {tab === "overview" && <Overview contact={contact} />}
          {tab === "deals" && <DealsPanel contact={contact} />}
          {tab === "activities" && <ActivitiesPanel contact={contact} />}
          {tab === "notes" && <NotesPanel contact={contact} />}
          {tab === "origin" && <OriginPanel contact={contact} />}
        </div>
      </section>
    </div>
  );
}

function Overview({ contact }: { contact: ContactDetail }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <Metric label="Total Deals" value={String(contact.deal_count)} tone="text-primary" />
        <Metric
          label="Open Deals"
          value={String(contact.open_deal_count)}
          tone="text-accent-foreground"
        />
        <Metric
          label="Last Contact"
          value={contact.last_activity_at ? relative(contact.last_activity_at) : "None"}
          tone="text-foreground"
        />
        <Metric label="Value Won" value={formatCurrency(contact.won_value)} tone="text-success" />
      </div>

      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-xs)]">
        <div className="border-b border-border p-4">
          <h3 className="text-[16px] font-semibold text-foreground">Company Profile</h3>
        </div>
        <div className="flex items-start gap-8 p-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-sidebar text-4xl font-bold text-white">
            {initials(contact.company?.name || "Company").slice(0, 1)}
          </div>
          <div className="grid flex-1 grid-cols-2 gap-6">
            <Field label="Company Name" value={contact.company?.name || "No company"} />
            <Field label="Industry" value={contact.company?.industry || "—"} />
            <Field label="Size" value="500-1,000 Employees" />
            <Field
              label="Headquarters"
              value={
                [contact.company?.city, contact.company?.country].filter(Boolean).join(", ") || "—"
              }
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function DealsPanel({ contact }: { contact: ContactDetail }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-xs)]">
      <table className="w-full text-left">
        <thead className="border-b border-border bg-muted text-[11px] font-bold uppercase tracking-wider text-text-muted">
          <tr>
            <th className="px-4 py-3">Deal Name</th>
            <th className="px-4 py-3">Stage</th>
            <th className="px-4 py-3">Value</th>
            <th className="px-4 py-3">Close Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {contact.deals.map((deal) => (
            <tr key={deal.id} className="h-10 transition-colors hover:bg-muted">
              <td className="px-4 py-3 text-sm font-bold text-primary">{deal.name}</td>
              <td className="px-4 py-3">
                <span className="rounded-full bg-primary-light px-2 py-1 text-[11px] font-semibold text-primary">
                  {deal.stage?.name || "Pipeline"}
                </span>
              </td>
              <td className="px-4 py-3 text-sm font-bold">
                {formatCurrency(Number(deal.value ?? 0), deal.currency)}
              </td>
              <td className="px-4 py-3 text-sm text-text-secondary">
                {deal.expected_close_date || "—"}
              </td>
            </tr>
          ))}
          {contact.deals.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-10 text-center text-sm text-text-muted">
                No deals linked to this contact yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function ActivitiesPanel({ contact }: { contact: ContactDetail }) {
  const items = contact.activities.length
    ? contact.activities.map((activity) => ({
        id: activity.id,
        icon: activity.type === "call" ? "call" : activity.type === "meeting" ? "event" : "mail",
        title: activity.title,
        time: activity.created_at,
        body: activity.notes || activity.type,
      }))
    : [
        {
          id: "created",
          icon: "event",
          title: "Contact Created",
          time: contact.created_at,
          body: "Contact profile is ready for outreach and activity tracking.",
        },
      ];

  return (
    <div className="relative space-y-6 pl-8 before:absolute before:bottom-2 before:left-3 before:top-2 before:w-0.5 before:bg-border">
      {items.map((item) => (
        <div key={item.id} className="relative">
          <span className="absolute -left-[29px] top-1 flex h-6 w-6 scale-75 items-center justify-center rounded-full bg-primary text-white">
            <span className="material-symbols-outlined text-[16px]">{item.icon}</span>
          </span>
          <div className="rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-xs)]">
            <div className="mb-2 flex items-start justify-between gap-4">
              <h4 className="text-[16px] font-semibold">{item.title}</h4>
              <span className="text-[11px] font-semibold text-text-secondary">
                {relative(item.time)}
              </span>
            </div>
            <p className="mb-4 text-sm text-text-secondary">{item.body}</p>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-text-muted">BY</span>
              <RepAvatar contact={contact} size="sm" />
              <span className="text-[11px] font-semibold text-foreground">
                {contact.assigned_rep?.full_name || "Tally CRM"}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function NotesPanel({ contact }: { contact: ContactDetail }) {
  return (
    <div className="space-y-4">
      <Note primary date={contact.updated_at}>
        {contact.notes ||
          "Add relationship context, renewal risk, and buying committee notes here."}
      </Note>
      <Note date={contact.created_at}>
        Personal and source notes can be carried forward from lead conversion or manual contact
        creation.
      </Note>
    </div>
  );
}

function OriginPanel({ contact }: { contact: ContactDetail }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-xs)]">
      <div className="border-b border-border bg-muted p-4">
        <h3 className="text-[16px] font-semibold text-foreground">
          Landing Page Submission Details
        </h3>
      </div>
      <div className="grid grid-cols-2 gap-x-12 gap-y-6 p-6">
        <Field label="Source" value={contact.source || "Manual Entry"} />
        <Field label="UTM Source" value="crm_directory" />
        <Field label="Lead Magnet" value="Account relationship import" />
        <Field label="Submission IP" value="Not captured on contact record" />
        <div className="col-span-2">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-text-muted">
            Message Payload
          </p>
          <div className="rounded-lg border border-border bg-background p-4 text-sm italic text-text-secondary">
            {contact.notes ||
              `${contact.first_name} ${contact.last_name} was added to the contact directory.`}
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-xs)]">
      <p className="mb-1 text-[11px] font-bold text-text-secondary">{label}</p>
      <p className={`text-[24px] font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-text-muted">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-text-muted">
        {title}
      </h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function InfoLine({ icon, value }: { icon: string; value: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="material-symbols-outlined text-[18px] text-text-secondary">{icon}</span>
      <span>{value}</span>
    </div>
  );
}

function ActionButton({ icon, label }: { icon: string; label: string }) {
  return (
    <button className="flex items-center justify-center gap-1 rounded-lg border border-border py-2 text-xs font-semibold text-text-secondary transition-colors hover:bg-muted">
      <span className="material-symbols-outlined text-[18px]">{icon}</span>
      {label}
    </button>
  );
}

function Tags({ tags }: { tags: string[] }) {
  return (
    <>
      {tags.slice(0, 2).map((tag, index) => (
        <span
          key={tag}
          className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
            index % 2 ? "bg-accent-light text-accent-foreground" : "bg-primary-light text-primary"
          }`}
        >
          {tag}
        </span>
      ))}
    </>
  );
}

function RepAvatar({ contact, size }: { contact: ContactDetail; size: "sm" | "lg" }) {
  const classes = size === "lg" ? "h-8 w-8" : "h-5 w-5";
  return (
    <span
      className={`flex ${classes} items-center justify-center overflow-hidden rounded-full bg-primary-light text-[10px] font-bold text-primary`}
    >
      {contact.assigned_rep?.avatar_url ? (
        <img
          src={contact.assigned_rep.avatar_url}
          alt={contact.assigned_rep.full_name ?? "Rep"}
          className="h-full w-full object-cover"
        />
      ) : (
        initials(contact.assigned_rep?.full_name ?? "TR")
      )}
    </span>
  );
}

function Note({
  date,
  primary,
  children,
}: {
  date: string;
  primary?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-xs)] ${primary ? "border-l-4 border-l-primary" : "border-l-4 border-l-border"}`}
    >
      <div className="mb-2 flex justify-between">
        <span className="text-[11px] font-semibold text-text-muted">
          {new Date(date).toLocaleString()}
        </span>
        <span className="material-symbols-outlined cursor-pointer text-[18px] text-text-muted hover:text-danger">
          delete
        </span>
      </div>
      <p className="text-sm text-foreground">{children}</p>
    </div>
  );
}

function fallbackTags(contact: ContactDetail) {
  if (contact.open_deal_count > 0) return ["Collab", "VIP"];
  if (contact.tags?.length) return contact.tags;
  return ["Rated"];
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function relative(date: string) {
  const days = Math.round((Date.now() - new Date(date).getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "1d ago";
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}
