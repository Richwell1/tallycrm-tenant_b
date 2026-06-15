import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common";
import { EditCompanyModal } from "@/components/companies/EditCompanyModal";
import { useCurrentRole } from "@/lib/auth-context";
import { type CompanyDetail, useCompany, useDeleteCompany } from "@/lib/companies-data";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/companies/$id")({
  component: CompanyDetailPage,
});

type Tab = "overview" | "contacts" | "deals" | "activities" | "notes";

function CompanyDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: company, isLoading, isError, error, refetch } = useCompany(id);
  const role = useCurrentRole();
  const deleteCompany = useDeleteCompany();
  const [tab, setTab] = useState<Tab>("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const canDelete = role === "admin" || role === "manager";

  if (isLoading) return <TableSkeleton rows={8} />;
  if (isError) {
    return (
      <ErrorState
        description={(error as Error)?.message ?? "Could not load company"}
        onRetry={() => refetch()}
      />
    );
  }
  if (!company) {
    return (
      <EmptyState
        icon={<span className="material-symbols-outlined text-[28px]">business</span>}
        title="Company not found"
        description="This company may have been deleted or moved."
      />
    );
  }

  return (
    <div className="-m-6 flex min-h-[calc(100vh-64px)] bg-background">
      <section className="flex w-[30%] min-w-[320px] flex-col gap-8 border-r border-border bg-card p-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted p-1 text-2xl font-bold text-primary shadow-[var(--shadow-xs)]">
            {company.logo_url ? (
              <img
                src={company.logo_url}
                alt={company.name}
                className="h-full w-full rounded-lg object-contain"
              />
            ) : (
              initials(company.name)
            )}
          </div>
          <h1 className="text-[24px] font-semibold text-foreground">{company.name}</h1>
          <div className="mt-1 flex items-center justify-center gap-1 text-text-secondary">
            <Rating value={company.rating ?? 0} />
            <span className="text-xs font-semibold">{company.rating ?? 0}.0 Account</span>
          </div>
          {company.industry ? (
            <span className="mt-3 inline-flex rounded-full bg-primary-light px-4 py-1 text-xs font-semibold text-primary">
              {company.industry}
            </span>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <ActionTile icon="add_call" label="Call" />
          <ActionTile icon="mail" label="Email" />
          <ActionTile icon="edit" label="Edit" onClick={() => setEditOpen(true)} />
          {canDelete ? (
            <ActionTile icon="delete" label="Delete" onClick={() => setDeleteOpen(true)} danger />
          ) : (
            <ActionTile icon="calendar_today" label="Meet" />
          )}
        </div>

        <div className="space-y-8">
          <InfoSection title="Contact Info">
            <InfoLine
              icon="language"
              label="Website"
              value={company.website || "—"}
              link={company.website || undefined}
            />
            <InfoLine
              icon="location_on"
              label="Address"
              value={
                [company.address, company.city, company.country].filter(Boolean).join(", ") || "—"
              }
            />
            <InfoLine icon="mail" label="Email" value={company.email || "—"} />
            <InfoLine icon="call" label="Phone" value={company.phone || "—"} />
          </InfoSection>

          <InfoSection title="Assignment">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-border bg-primary-light text-xs font-bold text-primary">
                {company.account_manager?.avatar_url ? (
                  <img
                    src={company.account_manager.avatar_url}
                    alt={company.account_manager.full_name ?? "Manager"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials(company.account_manager?.full_name ?? "U")
                )}
              </span>
              <span>
                <span className="block text-[16px] font-semibold text-foreground">
                  {company.account_manager?.full_name || "Unassigned"}
                </span>
                <span className="block text-xs font-semibold text-text-secondary">
                  Key Account Manager
                </span>
              </span>
            </div>
          </InfoSection>
        </div>
      </section>

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="overflow-x-auto border-b border-border bg-card px-6">
          <div className="flex h-14 items-center gap-12">
            {[
              ["overview", "Overview"],
              ["contacts", "Contacts"],
              ["deals", "Deals"],
              ["activities", "Activities"],
              ["notes", "Notes"],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id as Tab)}
                className={`relative flex h-full items-center transition-colors ${
                  tab === id
                    ? "font-semibold text-primary"
                    : "text-text-secondary hover:text-primary"
                }`}
              >
                {label}
                {tab === id ? (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                ) : null}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === "overview" && <Overview company={company} />}
          {tab === "contacts" && <ContactsPanel company={company} />}
          {tab === "deals" && <DealsPanel company={company} />}
          {tab === "activities" && <ActivitiesPanel company={company} />}
          {tab === "notes" && <NotesPanel company={company} />}
        </div>
      </section>

      {editOpen && company && (
        <EditCompanyModal company={company} open={editOpen} onOpenChange={setEditOpen} />
      )}
      {deleteOpen && company && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-[400px] rounded-xl bg-card p-6 shadow-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger/10">
              <span className="material-symbols-outlined text-danger">delete</span>
            </div>
            <h3 className="mb-2 text-lg font-semibold text-foreground">Delete Company</h3>
            <p className="mb-6 text-sm text-text-secondary">
              Are you sure you want to delete{" "}
              <span className="font-semibold">{company.name}</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteOpen(false)}
                className="rounded px-4 py-2 text-sm font-semibold text-text-secondary hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteCompany.mutate(company.id, {
                    onSuccess: () => {
                      toast.success("Company deleted");
                      navigate({ to: "/app/companies" });
                    },
                    onError: (error) =>
                      toast.error("Could not delete company", {
                        description: (error as Error).message,
                      }),
                  });
                }}
                disabled={deleteCompany.isPending}
                className="rounded bg-danger px-4 py-2 text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-60"
              >
                {deleteCompany.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Overview({ company }: { company: CompanyDetail }) {
  const wonValue = company.deals
    .filter((deal) => deal.actual_close_date && !deal.lost_reason)
    .reduce((sum, deal) => sum + Number(deal.actual_value ?? deal.value ?? 0), 0);
  const totalRevenue = wonValue + company.open_deal_value;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-6">
        <MetricCard icon="group" label="Total Contacts" value={String(company.contact_count)} />
        <MetricCard
          icon="monetization_on"
          label="Open Deal Value"
          value={formatCurrency(company.open_deal_value)}
          tone="soft"
        />
        <MetricCard
          icon="receipt_long"
          label="Total Revenue"
          value={formatCurrency(totalRevenue)}
          tone="warm"
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <section className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-xs)]">
          <PanelHeader title="Company Health" icon="info" />
          <div className="flex flex-1 items-center justify-center p-8">
            <div className="relative h-48 w-48">
              <svg className="h-full w-full" viewBox="0 0 100 100">
                <circle
                  className="text-muted"
                  cx="50"
                  cy="50"
                  fill="transparent"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="10"
                />
                <circle
                  className="text-primary"
                  cx="50"
                  cy="50"
                  fill="transparent"
                  r="40"
                  stroke="currentColor"
                  strokeDasharray="251.2"
                  strokeDashoffset={healthOffset(company)}
                  strokeLinecap="round"
                  strokeWidth="10"
                  transform="rotate(-90 50 50)"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold text-primary">{healthScore(company)}</span>
                <span className="text-xs font-semibold text-text-secondary">Health Score</span>
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-xs)]">
          <PanelHeader title="Active Forecast" action="View Report" />
          <div className="space-y-5 p-6">
            <ForecastRow label="Closed Won" value={formatCurrency(wonValue)} pct={65} />
            <ForecastRow
              label="In Pipeline"
              value={formatCurrency(company.open_deal_value)}
              pct={45}
            />
            <ForecastRow
              label="Target"
              value={formatCurrency(Math.max(totalRevenue, 1) * 1.35)}
              pct={80}
              muted
            />
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-xs)]">
        <PanelHeader title="Recent Activity" icon="filter_list" />
        <div>
          {company.activities.slice(0, 4).map((activity) => (
            <ActivityItem
              key={activity.id}
              icon={activity.type === "call" ? "call" : "mail"}
              title={activity.title}
              time={activity.created_at}
            >
              {activity.notes || activity.type}
            </ActivityItem>
          ))}
          {company.activities.length === 0 ? (
            <>
              <ActivityItem icon="mail" title="Company account created" time={company.created_at}>
                Initial company profile is ready for qualification and account planning.
              </ActivityItem>
              <ActivityItem
                icon="add_task"
                title="Account review pending"
                time={company.updated_at}
              >
                Add contacts, link active deals, and capture notes for the account plan.
              </ActivityItem>
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function ContactsPanel({ company }: { company: CompanyDetail }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {company.contacts.map((contact) => (
        <div
          key={contact.id}
          className="flex cursor-pointer items-center gap-4 rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-[var(--shadow-sm)]"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-primary-light text-sm font-bold text-primary">
            {initials(`${contact.first_name} ${contact.last_name}`)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[16px] font-semibold text-foreground">
              {contact.first_name} {contact.last_name}
            </span>
            <span className="block truncate text-xs font-semibold text-text-secondary">
              {contact.job_title || contact.email || "Contact"}
            </span>
          </span>
          <span className="material-symbols-outlined text-text-muted">chevron_right</span>
        </div>
      ))}
      {company.contacts.length === 0 ? (
        <EmptyPanel label="No contacts linked to this company yet." />
      ) : null}
    </div>
  );
}

function DealsPanel({ company }: { company: CompanyDetail }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-xs)]">
      <table className="w-full text-left">
        <thead className="bg-muted text-[11px] font-bold uppercase tracking-wider text-text-muted">
          <tr>
            <th className="px-6 py-4">Deal Name</th>
            <th className="px-6 py-4">Amount</th>
            <th className="px-6 py-4">Stage</th>
            <th className="px-6 py-4">Probability</th>
            <th className="px-6 py-4 text-right">Closing Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {company.deals.map((deal) => (
            <tr key={deal.id} className="transition-colors hover:bg-muted">
              <td className="px-6 py-4 font-semibold text-primary">{deal.name}</td>
              <td className="px-6 py-4">
                {formatCurrency(Number(deal.value ?? 0), deal.currency)}
              </td>
              <td className="px-6 py-4">
                <span className="rounded bg-primary-light px-2 py-1 text-[11px] font-semibold text-primary">
                  {deal.stage?.name || "Pipeline"}
                </span>
              </td>
              <td className="px-6 py-4">{deal.probability}%</td>
              <td className="px-6 py-4 text-right text-text-secondary">
                {deal.expected_close_date || "—"}
              </td>
            </tr>
          ))}
          {company.deals.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-6 py-10 text-center text-sm text-text-muted">
                No deals linked to this company yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function ActivitiesPanel({ company }: { company: CompanyDetail }) {
  const items = company.activities.length
    ? company.activities.map((activity) => ({
        id: activity.id,
        icon: activity.type === "call" ? "call" : "edit_calendar",
        title: activity.title,
        time: activity.created_at,
        body: activity.notes || activity.type,
      }))
    : [
        {
          id: "created",
          icon: "edit_calendar",
          title: "Company Created",
          time: company.created_at,
          body: "Account profile is ready for activity logging.",
        },
      ];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {items.map((item) => (
        <div key={item.id} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white">
              <span className="material-symbols-outlined">{item.icon}</span>
            </div>
            <div className="h-full w-px bg-border" />
          </div>
          <div className="flex-1 pb-6">
            <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-xs)]">
              <div className="mb-2 flex items-center justify-between gap-4">
                <h4 className="text-[16px] font-semibold">{item.title}</h4>
                <span className="text-xs font-semibold text-text-muted">
                  {new Date(item.time).toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-text-secondary">{item.body}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function NotesPanel({ company }: { company: CompanyDetail }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-xs)]">
        <textarea
          className="h-24 w-full resize-none border-none bg-transparent p-0 text-sm outline-none placeholder:text-text-muted focus:ring-0"
          placeholder={`Write a new note about ${company.name}...`}
        />
        <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
          <div className="flex gap-4 text-text-muted">
            <button className="material-symbols-outlined hover:text-primary">format_bold</button>
            <button className="material-symbols-outlined hover:text-primary">format_italic</button>
            <button className="material-symbols-outlined hover:text-primary">attach_file</button>
          </div>
          <button className="rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-white">
            Save Note
          </button>
        </div>
      </div>
      <div className="relative rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-6 shadow-[var(--shadow-xs)]">
        <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#D97706]">
          Pinned Note
        </h4>
        <p className="text-sm text-[#92400E]">
          {company.notes ||
            "Keep account strategy, renewal risks, and executive preferences here for the sales team."}
        </p>
        <div className="mt-4 flex items-center gap-2 text-[11px] font-semibold text-[#92400E]">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#FDE68A]">
            {initials(company.account_manager?.full_name ?? "TM")}
          </span>
          {company.account_manager?.full_name || "Tally CRM"} •{" "}
          {new Date(company.updated_at).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}

function ActionTile({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: string;
  label: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`group flex flex-col items-center justify-center rounded-lg border p-4 transition-colors ${
        danger
          ? "border-danger/30 hover:bg-danger/10"
          : "border-border hover:bg-muted"
      }`}
    >
      <span className={`material-symbols-outlined mb-1 ${danger ? "text-danger" : "text-primary"}`}>
        {icon}
      </span>
      <span
        className={`text-xs font-semibold ${
          danger
            ? "text-danger"
            : "text-text-secondary group-hover:text-primary"
        }`}
      >
        {label}
      </span>
    </button>
  );
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border pt-6">
      <h3 className="mb-4 text-[11px] font-bold uppercase tracking-wider text-text-muted">
        {title}
      </h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function InfoLine({
  icon,
  label,
  value,
  link,
}: {
  icon: string;
  label: string;
  value: string;
  link?: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <span className="material-symbols-outlined text-text-muted">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[11px] font-bold text-text-muted">{label}</span>
        {link ? (
          <a
            href={href(link)}
            target="_blank"
            rel="noreferrer"
            className="truncate text-sm text-primary hover:underline"
          >
            {value}
          </a>
        ) : (
          <span className="block text-sm text-foreground">{value}</span>
        )}
      </span>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  tone = "primary",
}: {
  icon: string;
  label: string;
  value: string;
  tone?: string;
}) {
  const toneClass =
    tone === "warm"
      ? "bg-accent-light text-accent-foreground"
      : tone === "soft"
        ? "bg-primary-light text-primary"
        : "bg-primary/10 text-primary";
  return (
    <section className="relative flex items-center gap-6 overflow-hidden rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-xs)]">
      <div className={`rounded-full p-4 ${toneClass}`}>
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <div>
        <p className="text-xs font-semibold text-text-secondary">{label}</p>
        <h4 className="text-[24px] font-semibold text-foreground">{value}</h4>
      </div>
      <span className="material-symbols-outlined absolute -bottom-5 -right-4 text-[100px] text-foreground opacity-5">
        {icon}
      </span>
    </section>
  );
}

function PanelHeader({ title, icon, action }: { title: string; icon?: string; action?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
      <h3 className="text-[16px] font-semibold">{title}</h3>
      {action ? <button className="text-xs font-semibold text-primary">{action}</button> : null}
      {icon ? <span className="material-symbols-outlined text-text-muted">{icon}</span> : null}
    </div>
  );
}

function ForecastRow({
  label,
  value,
  pct,
  muted,
}: {
  label: string;
  value: string;
  pct: number;
  muted?: boolean;
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs font-semibold">
        <span className="text-text-secondary">{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full ${muted ? "bg-border-strong" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ActivityItem({
  icon,
  title,
  time,
  children,
}: {
  icon: string;
  title: string;
  time: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4 border-b border-border p-6 last:border-b-0">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
      </div>
      <div className="flex-1">
        <p className="text-sm text-foreground">
          <strong>{title}</strong>
        </p>
        <p className="mt-2 text-sm italic text-text-secondary">{children}</p>
        <span className="mt-2 block text-[11px] font-semibold text-text-muted">
          {new Date(time).toLocaleString()}
        </span>
      </div>
    </div>
  );
}

function EmptyPanel({ label }: { label: string }) {
  return (
    <div className="col-span-2 rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-text-muted">
      {label}
    </div>
  );
}

function Rating({ value }: { value: number }) {
  return (
    <div className="flex text-accent">
      {Array.from({ length: 5 }).map((_, index) => (
        <span
          key={index}
          className={`material-symbols-outlined text-[18px] ${index < value ? "text-accent" : "text-border-strong"}`}
          style={{ fontVariationSettings: index < value ? "'FILL' 1" : "'FILL' 0" }}
        >
          star
        </span>
      ))}
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

function href(url: string) {
  return url.startsWith("http") ? url : `https://${url}`;
}

function healthScore(company: CompanyDetail) {
  return Math.min(
    98,
    50 +
      (company.rating ?? 0) * 6 +
      company.open_deal_count * 5 +
      Math.min(company.contact_count, 8),
  );
}

function healthOffset(company: CompanyDetail) {
  return 251.2 - (251.2 * healthScore(company)) / 100;
}
