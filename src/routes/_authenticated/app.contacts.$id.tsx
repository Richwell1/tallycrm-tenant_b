import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, ToolbarButton, SectionCard } from "@/components/layout";
import { ErrorState, TableSkeleton } from "@/components/common";
import {
  useContact,
  useContactActivities,
  useContactDeals,
  useDeleteContact,
} from "@/lib/contacts-data";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/contacts/$id")({
  component: ContactDetail,
});

type Tab = "overview" | "deals" | "activities" | "notes";

function ContactDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: contact, isLoading, isError, error, refetch } = useContact(id);
  const deals = useContactDeals(id);
  const acts = useContactActivities(id);
  const del = useDeleteContact();
  const [tab, setTab] = useState<Tab>("overview");

  if (isLoading) return <TableSkeleton rows={4} />;
  if (isError || !contact)
    return (
      <ErrorState
        description={(error as Error)?.message ?? "Contact not found"}
        onRetry={() => refetch?.()}
      />
    );

  async function onDelete() {
    if (!confirm("Delete this contact?")) return;
    try {
      await del.mutateAsync(id);
      toast.success("Contact deleted");
      navigate({ to: "/app/contacts" });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <>
      <PageHeader
        title={`${contact.first_name} ${contact.last_name}`}
        breadcrumbs={[
          { label: "Contacts", to: "/app/contacts" },
          { label: `${contact.first_name} ${contact.last_name}` },
        ]}
        actions={
          <>
            <ToolbarButton icon="delete" onClick={onDelete}>
              Delete
            </ToolbarButton>
          </>
        }
      />

      <div className="mb-6 flex gap-2 border-b border-border">
        {(["overview", "deals", "activities", "notes"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold capitalize ${
              tab === t
                ? "border-b-2 border-primary text-primary"
                : "text-text-secondary hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <SectionCard title="Contact details">
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <Row label="Email">
                {contact.email ? (
                  <a href={`mailto:${contact.email}`} className="text-primary hover:underline">
                    {contact.email}
                  </a>
                ) : (
                  "—"
                )}
              </Row>
              <Row label="Phone">{contact.phone ?? "—"}</Row>
              <Row label="Job Title">{contact.job_title ?? "—"}</Row>
              <Row label="Company">
                {contact.company ? (
                  <Link
                    to="/app/companies/$id"
                    params={{ id: contact.company.id }}
                    className="text-primary hover:underline"
                  >
                    {contact.company.name}
                  </Link>
                ) : (
                  "—"
                )}
              </Row>
              <Row label="Source">{contact.source ?? "—"}</Row>
              <Row label="Created">{new Date(contact.created_at).toLocaleString()}</Row>
            </dl>
            {contact.notes && (
              <div className="mt-4 border-t border-border pt-4">
                <p className="text-xs font-bold uppercase tracking-wider text-text-muted">Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-text-secondary">{contact.notes}</p>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Lead origin">
            <p className="text-sm text-text-secondary">
              Source: <strong>{contact.source ?? "Unknown"}</strong>
            </p>
            <p className="mt-2 text-xs text-text-muted">
              When this contact came from the landing page, its original lead record stays linked
              for full audit history.
            </p>
          </SectionCard>
        </div>
      )}

      {tab === "deals" && (
        <SectionCard title="Linked deals">
          {(deals.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-text-muted">No deals linked to this contact.</p>
          ) : (
            <ul className="space-y-2">
              {deals.data!.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3"
                >
                  <Link
                    to="/app/deals/$id"
                    params={{ id: d.id }}
                    className="text-sm font-semibold hover:text-primary"
                  >
                    {d.name}
                  </Link>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-primary">
                      {formatCurrency(Number(d.value), d.currency)}
                    </span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
                      style={{ backgroundColor: d.stage?.color ?? "#999" }}
                    >
                      {d.stage?.name}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}

      {tab === "activities" && (
        <SectionCard title="Activity timeline">
          {(acts.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-text-muted">No activities logged yet.</p>
          ) : (
            <ul className="space-y-3">
              {acts.data!.map((a) => (
                <li key={a.id} className="rounded-lg border border-border bg-surface p-3">
                  <p className="text-sm font-semibold">{a.title}</p>
                  <p className="text-xs text-text-muted">
                    {a.type} · {new Date(a.created_at).toLocaleString()}
                  </p>
                  {a.notes && <p className="mt-1 text-sm text-text-secondary">{a.notes}</p>}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}

      {tab === "notes" && (
        <SectionCard title="Notes">
          {contact.notes ? (
            <p className="whitespace-pre-wrap text-sm text-text-secondary">{contact.notes}</p>
          ) : (
            <p className="text-sm text-text-muted">No notes yet.</p>
          )}
        </SectionCard>
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
