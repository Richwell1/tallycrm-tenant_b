import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common";
import { CrmToolbar, PageHeader, ToolbarButton } from "@/components/layout";
import { WarehouseLocationModal } from "@/components/warehouse-locations/WarehouseLocationModal";
import { type WarehouseLocationRow, useWarehouseLocations } from "@/lib/warehouse-locations-data";

export const Route = createFileRoute("/_authenticated/app/warehouses")({
  component: WarehouseLocationsPage,
});

function WarehouseLocationsPage() {
  const { data, isLoading, isError, error, refetch } = useWarehouseLocations();
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<WarehouseLocationRow | null>(null);
  const locations = useMemo(
    () =>
      (data ?? []).filter(
        (location) => statusFilter === "all" || location.is_active === (statusFilter === "active"),
      ),
    [data, statusFilter],
  );

  function openNew() {
    setSelected(null);
    setModalOpen(true);
  }

  function openEdit(location: WarehouseLocationRow) {
    setSelected(location);
    setModalOpen(true);
  }

  return (
    <>
      <PageHeader
        title="Warehouse Locations"
        count={data?.length}
        actions={
          <>
            <ToolbarButton icon="refresh" onClick={() => refetch()}>
              Refresh
            </ToolbarButton>
            <ToolbarButton icon="warehouse" variant="cta" onClick={openNew}>
              Add Warehouse
            </ToolbarButton>
          </>
        }
      />
      <CrmToolbar
        filters={[
          {
            label: "Status",
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ],
          },
        ]}
      />
      {isLoading ? (
        <TableSkeleton rows={6} />
      ) : isError ? (
        <ErrorState
          description={(error as Error)?.message ?? "Could not load warehouses"}
          onRetry={() => refetch()}
        />
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<span className="material-symbols-outlined text-[28px]">warehouse</span>}
          title="No warehouse locations yet"
          description="Add the first site goods can be dispatched from."
          action={
            <button
              onClick={openNew}
              className="rounded-lg bg-cta px-4 py-2 text-sm font-semibold text-cta-foreground"
            >
              Add Warehouse
            </button>
          }
        />
      ) : locations.length === 0 ? (
        <EmptyState
          icon={<span className="material-symbols-outlined text-[28px]">filter_alt_off</span>}
          title="No warehouses match this status"
          description="Choose another status or clear the filter."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted text-[11px] uppercase tracking-wide text-text-secondary">
                  <th className="px-4 py-3 text-left font-semibold">Code</th>
                  <th className="px-4 py-3 text-left font-semibold">Name</th>
                  <th className="px-4 py-3 text-left font-semibold">Address</th>
                  <th className="px-4 py-3 text-left font-semibold">Contact</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {locations.map((location) => (
                  <tr key={location.id} className="border-b border-border/70 hover:bg-muted/50">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">
                      {location.code}
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground">{location.name}</td>
                    <td className="max-w-xs px-4 py-3 text-text-secondary">
                      {location.address ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      <p>{location.contact_name ?? "—"}</p>
                      {location.contact_phone ? (
                        <p className="text-xs text-text-muted">{location.contact_phone}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          location.is_active
                            ? "rounded-full bg-success-light px-2.5 py-1 text-xs font-semibold text-success"
                            : "rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-text-secondary"
                        }
                      >
                        {location.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(location)}
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <WarehouseLocationModal open={modalOpen} onOpenChange={setModalOpen} location={selected} />
    </>
  );
}
