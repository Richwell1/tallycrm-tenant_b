import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader, ToolbarButton, FilterBar } from "@/components/layout";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common";
import { CompaniesGrid } from "@/components/companies/CompaniesGrid";
import { CompaniesTable } from "@/components/companies/CompaniesTable";
import { AddCompanyModal } from "@/components/companies/AddCompanyModal";
import { useCompanies } from "@/lib/companies-data";

export const Route = createFileRoute("/_authenticated/app/companies/")({
  component: CompaniesIndex,
});

type View = "grid" | "table";

function CompaniesIndex() {
  const { data: companies, isLoading, isError, error, refetch } = useCompanies();
  const [view, setView] = useState<View>("grid");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const filtered = useMemo(() => {
    let list = companies ?? [];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((c) =>
        [c.name, c.industry, c.city, c.country]
          .filter(Boolean)
          .some((v) => (v as string).toLowerCase().includes(q))
      );
    }
    return list;
  }, [companies, search]);

  return (
    <>
      <PageHeader
        title="Companies"
        count={companies?.length}
        actions={
          <>
            <div className="mr-2 flex overflow-hidden rounded-lg border border-border bg-surface text-[12px] font-semibold">
              {(["grid", "table"] as View[]).map((vw) => (
                <button
                  key={vw}
                  onClick={() => setView(vw)}
                  className={`px-3 py-2 ${
                    view === vw
                      ? "bg-primary text-primary-foreground"
                      : "text-text-secondary hover:bg-surface-hover"
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px] align-middle">
                    {vw === "grid" ? "grid_view" : "table_rows"}
                  </span>
                  <span className="ml-1.5">{vw === "grid" ? "Grid" : "Table"}</span>
                </button>
              ))}
            </div>
            <ToolbarButton icon="refresh" onClick={() => refetch?.()}>
              Refresh
            </ToolbarButton>
            <ToolbarButton icon="add" variant="cta" onClick={() => setAddOpen(true)}>
              Add company
            </ToolbarButton>
          </>
        }
      />

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search companies by name or industry..."
      />

      {isLoading ? (
        <TableSkeleton rows={6} />
      ) : isError ? (
        <ErrorState
          description={(error as Error)?.message ?? "Could not load companies"}
          onRetry={() => refetch?.()}
        />
      ) : (companies?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<span className="material-symbols-outlined text-[28px]">corporate_fare</span>}
          title="No companies yet"
          description="Add an organisation record. Contacts and deals can be linked to it."
          action={
            <button
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-cta px-4 py-2 text-sm font-semibold text-cta-foreground hover:bg-cta-hover"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Add your first company
            </button>
          }
        />
      ) : view === "grid" ? (
        <CompaniesGrid companies={filtered} />
      ) : (
        <CompaniesTable companies={filtered} />
      )}

      <AddCompanyModal open={addOpen} onOpenChange={setAddOpen} />
    </>
  );
}
