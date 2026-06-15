import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, ToolbarButton, SectionCard } from "@/components/layout";
import { ErrorState, TableSkeleton } from "@/components/common";
import {
  useCompany,
  useCompanyContacts,
  useCompanyDeals,
  useDeleteCompany,
} from "@/lib/companies-data";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/companies/$id")({
  component: CompanyDetail,
});

type Tab = "overview" | "contacts" | "deals" | "activities" | "notes";

function CompanyDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: company, isLoading, isError, error, refetch } = useCompany(id);
  const contacts = useCompanyContacts(id);
  const deals = useCompanyDeals(id);
  const del = useDeleteCompany();
  const [tab, setTab] = useState<Tab>("overview");

  if (isLoading) return <TableSkeleton rows={4} />;
  if (isError || !company)
    return (
      <ErrorState
        description={(error as Error)?.message ?? "Company not found"}
        onRetry={() => refetch?.()}
      />
    );

  async function onDelete() {
    if (!confirm("Delete this company?")) return;
    try {
      await del.mutateAsync(id);
      toast.success("Company deleted");
      navigate({ to: "/app/companies" });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <>
      <PageHeader
        title={company.name}
        breadcrumbs={[{ label: "Companies", to: "/app/companies" }, { label: company.name }]}
        actions={
          <ToolbarButton icon="delete" onClick={onDelete}>
            Delete
          </ToolbarButton>
        }
      />

      <div className="mb-6 flex gap-2 border-b border-border">
        {(["overview", "contacts", "deals", "activities", "notes"] as Tab[]).map((t) => (
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
        <SectionCard title="Company details">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary-light text-primary">
              {company.logo_url ? (
                <img src={company.logo_url} alt={company.name} className="h-16 w-16 rounded-lg object-cover" />
              ) : (
                <span className="material-symbols-outlined text-3xl">corporate_fare</span>
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold">{company.name}</h2>
              <p className="text-sm text-text-secondary">{company.industry ?? "—"}</p>
              {company.rating ? (
                <div className="mt-1 flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span
                      key={i}
                      className={`material-symbols-outlined text-[16px] ${
                        i < (company.rating ?? 0) ? "text-warning" : "text-border-strong"
                      }`}
                      style={{ fontVariationSettings: '"FILL" 1' }}
                    >
                      star
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
            <Row label="Email">{company.email ?? "—"}</Row>
            <Row label="Phone">{company.phone ?? "—"}</Row>
            <Row label="Website">
              {company.website ? (
                <a href={company.website} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  {company.website}
                </a>
              ) : (
                "—"
              )}
            </Row>
            <Row label="LinkedIn">
              {company.linkedin ? (
                <a href={company.linkedin} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  View
                </a>
              ) : (
                "—"
              )}
            </Row>
            <Row label="Address">{company.address ?? "—"}</Row>
            <Row label="Location">
              {[company.city, company.country].filter(Boolean).join(", ") || "—"}
            </Row>
          </dl>
          {company.notes && (
            <div className="mt-4 border-t border-border pt-4">
              <p className="text-xs font-bold uppercase tracking-wider text-text-muted">Notes</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-text-secondary">{company.notes}</p>
            </div>
          )}
        </SectionCard>
      )}

      {tab === "contacts" && (
        <SectionCard title="Linked contacts">
          {(contacts.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-text-muted">No contacts linked yet.</p>
          ) : (
            <ul className="space-y-2">
              {contacts.data!.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3"
                >
                  <Link
                    to="/app/contacts/$id"
                    params={{ id: c.id }}
                    className="text-sm font-semibold hover:text-primary"
                  >
                    {c.first_name} {c.last_name}
                  </Link>
                  <span className="text-xs text-text-secondary">
                    {c.job_title ?? "—"} · {c.email ?? "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}

      {tab === "deals" && (
        <SectionCard title="Linked deals">
          {(deals.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-text-muted">No deals for this company yet.</p>
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
        <SectionCard title="Activities">
          <p className="text-sm text-text-muted">
            Activities are shown on the contact and deal records linked to this company.
          </p>
        </SectionCard>
      )}

      {tab === "notes" && (
        <SectionCard title="Notes">
          {company.notes ? (
            <p className="whitespace-pre-wrap text-sm text-text-secondary">{company.notes}</p>
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
