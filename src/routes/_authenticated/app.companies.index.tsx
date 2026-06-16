import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common";
import { PageHeader, ToolbarButton, CrmToolbar } from "@/components/layout";
import { AddCompanyModal } from "@/components/companies/AddCompanyModal";
import { EditCompanyModal } from "@/components/companies/EditCompanyModal";
import { useCurrentRole } from "@/lib/auth-context";
import { type CompanySummary, useCompanies, useDeleteCompany } from "@/lib/companies-data";

export const Route = createFileRoute("/_authenticated/app/companies/")({
  component: CompaniesIndex,
});

type View = "table" | "grid";
type CompanySort = "name" | "rating" | "deals" | "value";

function CompaniesIndex() {
  const { data: companies, isLoading, isError, error, refetch } = useCompanies();
  const role = useCurrentRole();
  const deleteCompany = useDeleteCompany();
  const [view, setView] = useState<View>("table");
  const [search, setSearch] = useState("");
  const [industryFilter, setIndustryFilter] = useState("all");
  const [sortKey, setSortKey] = useState<CompanySort>("name");
  const [addOpen, setAddOpen] = useState(false);
  const [editCompany, setEditCompany] = useState<CompanySummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CompanySummary | null>(null);
  const canDelete = role === "admin" || role === "manager";

  const industries = useMemo(
    () =>
      Array.from(new Set((companies ?? []).map((company) => company.industry).filter(Boolean)))
        .sort()
        .map((industry) => industry!),
    [companies],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (companies ?? []).filter((company) => {
      const industryMatch = industryFilter === "all" || company.industry === industryFilter;
      const searchMatch =
        !q ||
        [
          company.name,
          company.website,
          company.email,
          company.city,
          company.country,
          company.industry,
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(q));
      return industryMatch && searchMatch;
    });

    return list.sort((a, b) => {
      if (sortKey === "rating") return Number(b.rating ?? 0) - Number(a.rating ?? 0);
      if (sortKey === "deals") return b.open_deal_count - a.open_deal_count;
      if (sortKey === "value") return b.open_deal_value - a.open_deal_value;
      return a.name.localeCompare(b.name);
    });
  }, [companies, industryFilter, search, sortKey]);

  return (
    <>
      <PageHeader
        title="Companies"
        count={companies?.length}
        actions={
          <>
            <ToolbarButton icon="refresh" onClick={() => refetch()}>
              Refresh
            </ToolbarButton>
            <ToolbarButton icon="add" variant="cta" onClick={() => setAddOpen(true)}>
              Add Company
            </ToolbarButton>
          </>
        }
      />

      <CrmToolbar<View>
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search companies, domains, managers..."
        view={view}
        onViewChange={setView}
        viewOptions={[
          { value: "table", icon: "table_rows", label: "Table" },
          { value: "grid", icon: "grid_view", label: "Grid" },
        ]}
        filters={[
          {
            label: "Industry",
            value: industryFilter,
            onChange: setIndustryFilter,
            options: industries.map((i) => ({ value: i, label: i })),
          },
        ]}
        sort={{
          value: sortKey,
          onChange: (v) => setSortKey(v as CompanySort),
          options: [
            { value: "name", label: "Name" },
            { value: "rating", label: "Rating" },
            { value: "deals", label: "Open deals" },
            { value: "value", label: "Pipeline value" },
          ],
        }}
        resultCount={filtered.length}
        resultNoun="companies"
      />

      {isLoading ? (
        <TableSkeleton rows={7} />
      ) : isError ? (
        <ErrorState
          description={(error as Error)?.message ?? "Could not load companies"}
          onRetry={() => refetch()}
        />
      ) : (companies?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<span className="material-symbols-outlined text-[28px]">business</span>}
          title="No companies yet"
          description="Create companies manually or convert qualified leads into account records."
          action={
            <button
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white"
            >
              <span className="material-symbols-outlined text-[18px]">add_business</span>
              Add Company
            </button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<span className="material-symbols-outlined text-[28px]">search_off</span>}
          title="No companies match your filters"
          description="Adjust the search term or industry filter to widen the result set."
        />
      ) : view === "table" ? (
        <CompaniesTable
          companies={filtered}
          onEdit={setEditCompany}
          onDelete={canDelete ? setDeleteTarget : undefined}
        />
      ) : (
        <CompaniesGrid
          companies={filtered}
          onEdit={setEditCompany}
          onDelete={canDelete ? setDeleteTarget : undefined}
        />
      )}

      <AddCompanyModal open={addOpen} onOpenChange={setAddOpen} />
      {editCompany && (
        <EditCompanyModal
          company={editCompany}
          open={!!editCompany}
          onOpenChange={(open) => !open && setEditCompany(null)}
        />
      )}
      {deleteTarget && (
        <ConfirmDelete
          name={deleteTarget.name}
          isPending={deleteCompany.isPending}
          onConfirm={() => {
            deleteCompany.mutate(deleteTarget.id, {
              onSuccess: () => {
                toast.success("Company deleted");
                setDeleteTarget(null);
              },
              onError: (error) =>
                toast.error("Could not delete company", {
                  description: (error as Error).message,
                }),
            });
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}

function CompaniesTable({
  companies,
  onEdit,
  onDelete,
}: {
  companies: CompanySummary[];
  onEdit: (company: CompanySummary) => void;
  onDelete?: (company: CompanySummary) => void;
}) {
  return (
    <div className="flex h-[calc(100vh-220px)] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-xs)]">
      <div className="flex-1 overflow-auto">
        <table className="w-full min-w-[1180px] border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-muted">
            <tr className="border-b border-border">
              <TableHead className="w-12">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
              </TableHead>
              <TableHead className="min-w-[240px]">Logo & Name</TableHead>
              <TableHead className="min-w-[120px]">Rating</TableHead>
              <TableHead className="min-w-[190px]">Email</TableHead>
              <TableHead className="min-w-[140px]">Phone</TableHead>
              <TableHead className="min-w-[120px]">City</TableHead>
              <TableHead className="min-w-[120px]">Country</TableHead>
              <TableHead className="min-w-[180px]">Account Manager</TableHead>
              <TableHead className="min-w-[150px]">Tags</TableHead>
              <TableHead className="text-center">Contacts</TableHead>
              <TableHead className="text-center">Deals</TableHead>
              <TableHead className="sticky right-0 border-l border-border bg-muted text-center">
                Actions
              </TableHead>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {companies.map((company, index) => (
              <tr
                key={company.id}
                className={`group transition-colors hover:bg-primary/5 ${index % 2 ? "bg-slate-50" : ""}`}
              >
                <td className="p-4">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                </td>
                <td className="p-4">
                  <Link
                    to="/app/companies/$id"
                    params={{ id: company.id }}
                    className="flex items-center gap-4"
                  >
                    <CompanyLogo company={company} />
                    <span className="min-w-0">
                      <span className="block max-w-[170px] truncate text-[16px] font-semibold text-primary">
                        {company.name}
                      </span>
                      <span className="block text-[11px] font-semibold text-text-muted">
                        {displayDomain(company.website)}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="p-4">
                  <Rating value={company.rating ?? 0} />
                </td>
                <td className="p-4 text-sm text-text-secondary">{company.email || "—"}</td>
                <td className="p-4 text-sm text-text-secondary">{company.phone || "—"}</td>
                <td className="p-4 text-sm text-text-secondary">{company.city || "—"}</td>
                <td className="p-4 text-sm text-text-secondary">{company.country || "—"}</td>
                <td className="p-4">
                  <Manager manager={company.account_manager} />
                </td>
                <td className="p-4">
                  <Tags tags={company.tags.length ? company.tags : fallbackTags(company)} />
                </td>
                <td className="p-4 text-center text-sm font-semibold">{company.contact_count}</td>
                <td className="p-4 text-center">
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-bold text-green-700">
                    {company.open_deal_count} Active
                  </span>
                </td>
                <td className="sticky right-0 border-l border-border bg-inherit p-4 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => onEdit(company)}
                      className="rounded-lg p-2 transition-colors hover:bg-muted hover:text-primary"
                      title="Edit"
                    >
                      <span className="material-symbols-outlined text-[18px] text-text-muted">
                        edit
                      </span>
                    </button>
                    {onDelete && (
                      <button
                        onClick={() => onDelete(company)}
                        className="rounded-lg p-2 transition-colors hover:bg-muted hover:text-danger"
                        title="Delete"
                      >
                        <span className="material-symbols-outlined text-[18px] text-text-muted">
                          delete
                        </span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-border bg-muted px-4 py-4">
        <div className="flex items-center gap-4">
          <select className="h-8 rounded border border-border bg-card px-2 text-xs font-semibold">
            <option>10 rows</option>
            <option>25 rows</option>
            <option>50 rows</option>
          </select>
          <span className="text-[11px] font-semibold text-text-muted">
            Page 1 of {Math.max(1, Math.ceil(companies.length / 25))}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {["chevron_left", "1", "2", "3", "chevron_right"].map((item) => (
            <button
              key={item}
              disabled={item === "chevron_left"}
              className={`flex h-8 w-8 items-center justify-center rounded border text-xs font-bold ${
                item === "1"
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-card text-text-secondary hover:bg-border"
              } disabled:opacity-50`}
            >
              {item.includes("chevron") ? (
                <span className="material-symbols-outlined text-[20px]">{item}</span>
              ) : (
                item
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function CompaniesGrid({
  companies,
  onEdit,
  onDelete,
}: {
  companies: CompanySummary[];
  onEdit: (company: CompanySummary) => void;
  onDelete?: (company: CompanySummary) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {companies.map((company) => (
          <div
            key={company.id}
            className="group flex flex-col rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-xs)] transition-all hover:border-primary"
          >
            <div className="mb-4 flex items-start justify-between">
              <Link to="/app/companies/$id" params={{ id: company.id }}>
                <CompanyLogo company={company} rounded="full" size="lg" />
              </Link>
              <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => onEdit(company)}
                  className="rounded p-1 text-text-muted hover:bg-muted hover:text-primary"
                  title="Edit"
                >
                  <span className="material-symbols-outlined text-[20px]">edit</span>
                </button>
                {onDelete && (
                  <button
                    onClick={() => onDelete(company)}
                    className="rounded p-1 text-text-muted hover:bg-muted hover:text-danger"
                    title="Delete"
                  >
                    <span className="material-symbols-outlined text-[20px]">delete</span>
                  </button>
                )}
              </div>
            </div>
            <Link to="/app/companies/$id" params={{ id: company.id }}>
              <h3 className="truncate text-[16px] font-semibold text-foreground hover:text-primary">
                {company.name}
              </h3>
            </Link>
            <div className="mt-1">
              <Rating value={company.rating ?? 0} />
            </div>
            <div className="mt-4 flex-1 space-y-2 text-sm text-text-secondary">
              <IconLine icon="mail">{company.email || "No email"}</IconLine>
              <IconLine icon="phone">{company.phone || "No phone"}</IconLine>
              <IconLine icon="location_on">
                {[company.city, company.country].filter(Boolean).join(", ") || "No location"}
              </IconLine>
              <div className="border-t border-border pt-2">
                <IconLine icon="account_circle">
                  {company.account_manager?.full_name || "Unassigned"}
                </IconLine>
              </div>
            </div>
            <div className="mt-4">
              <Tags tags={company.tags.length ? company.tags : fallbackTags(company)} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-4">
              <Link
                to="/app/companies/$id"
                params={{ id: company.id }}
                className="inline-flex items-center justify-center gap-1 rounded border border-border px-2 py-1.5 text-xs font-semibold text-text-secondary hover:bg-muted hover:text-primary"
              >
                <span className="material-symbols-outlined text-[16px]">visibility</span>
                View
              </Link>
              <button
                onClick={() => onEdit(company)}
                className="inline-flex items-center justify-center gap-1 rounded border border-border px-2 py-1.5 text-xs font-semibold text-text-secondary hover:bg-muted hover:text-primary"
                type="button"
              >
                <span className="material-symbols-outlined text-[16px]">edit</span>
                Edit
              </button>
              {onDelete ? (
                <button
                  onClick={() => onDelete(company)}
                  className="inline-flex items-center justify-center gap-1 rounded border border-danger/20 px-2 py-1.5 text-xs font-semibold text-danger hover:bg-danger-light"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                  Delete
                </button>
              ) : (
                <span className="inline-flex items-center justify-center rounded border border-border px-2 py-1.5 text-xs font-semibold text-text-muted">
                  Locked
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
        <p className="text-sm text-text-secondary">Showing {companies.length} companies</p>
        <div className="flex gap-2">
          <button
            disabled
            className="rounded border border-border px-4 py-1.5 text-xs font-semibold opacity-50"
          >
            Previous
          </button>
          <button className="rounded border border-border px-4 py-1.5 text-xs font-semibold hover:bg-muted">
            Next
          </button>
        </div>
      </div>
    </>
  );
}

function ConfirmDelete({
  name,
  isPending,
  onConfirm,
  onCancel,
}: {
  name: string;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-[400px] rounded-xl bg-card p-6 shadow-2xl">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger/10">
          <span className="material-symbols-outlined text-danger">delete</span>
        </div>
        <h3 className="mb-2 text-lg font-semibold text-foreground">Delete Company</h3>
        <p className="mb-6 text-sm text-text-secondary">
          Are you sure you want to delete <span className="font-semibold">{name}</span>? This action
          cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded px-4 py-2 text-sm font-semibold text-text-secondary hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="rounded bg-danger px-4 py-2 text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-60"
          >
            {isPending ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}


function TableHead({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`p-4 text-[11px] font-bold uppercase tracking-wider text-text-muted ${className}`}
    >
      {children}
    </th>
  );
}

function CompanyLogo({
  company,
  rounded = "lg",
  size = "md",
}: {
  company: CompanySummary;
  rounded?: "lg" | "full";
  size?: "md" | "lg";
}) {
  const dimension = size === "lg" ? "h-12 w-12" : "h-10 w-10";
  const shape = rounded === "full" ? "rounded-full" : "rounded-lg";
  return (
    <span
      className={`flex ${dimension} shrink-0 items-center justify-center overflow-hidden ${shape} bg-primary text-sm font-bold text-white`}
    >
      {company.logo_url ? (
        <img src={company.logo_url} alt={company.name} className="h-full w-full object-cover" />
      ) : (
        initials(company.name)
      )}
    </span>
  );
}

function Rating({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, index) => (
        <span
          key={index}
          className={`material-symbols-outlined text-[16px] ${index < value ? "text-accent" : "text-border-strong"}`}
          style={{ fontVariationSettings: index < value ? "'FILL' 1" : "'FILL' 0" }}
        >
          star
        </span>
      ))}
    </div>
  );
}

function Manager({ manager }: { manager?: CompanySummary["account_manager"] }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-primary-light text-[10px] font-bold text-primary">
        {manager?.avatar_url ? (
          <img
            src={manager.avatar_url}
            alt={manager.full_name ?? "Manager"}
            className="h-full w-full object-cover"
          />
        ) : (
          initials(manager?.full_name ?? "U")
        )}
      </span>
      <span className="text-sm font-medium text-text-secondary">
        {manager?.full_name || "Unassigned"}
      </span>
    </div>
  );
}

function Tags({ tags }: { tags: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {tags.slice(0, 2).map((tag, index) => (
        <span
          key={tag}
          className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
            index % 2 ? "bg-accent-light text-accent-foreground" : "bg-primary-light text-primary"
          }`}
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

function FilterChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1 rounded border border-primary/20 bg-primary/5 px-2 py-1 text-xs font-semibold text-primary">
      {children}
      <span className="material-symbols-outlined text-[14px]">close</span>
    </span>
  );
}

function IconLine({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="material-symbols-outlined shrink-0 text-[16px] text-text-muted">{icon}</span>
      <span className="truncate">{children}</span>
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

function displayDomain(website: string | null) {
  if (!website) return "No website";
  return website.replace(/^https?:\/\//, "").replace(/^www\./, "");
}

function fallbackTags(company: CompanySummary) {
  return [company.industry || "Account", company.open_deal_value > 100000 ? "High Value" : "Rated"];
}
