import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader, ToolbarButton, FilterBar } from "@/components/layout";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common";
import { ContactsTable } from "@/components/contacts/ContactsTable";
import { ContactsGrid } from "@/components/contacts/ContactsGrid";
import { AddContactModal } from "@/components/contacts/AddContactModal";
import { useContacts } from "@/lib/contacts-data";

export const Route = createFileRoute("/_authenticated/app/contacts/")({
  component: ContactsIndex,
});

type View = "grid" | "table";

function ContactsIndex() {
  const { data: contacts, isLoading, isError, error, refetch } = useContacts();
  const [view, setView] = useState<View>("grid");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const filtered = useMemo(() => {
    let list = contacts ?? [];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((c) =>
        [c.first_name, c.last_name, c.email, c.company?.name, c.job_title]
          .filter(Boolean)
          .some((v) => (v as string).toLowerCase().includes(q))
      );
    }
    return list;
  }, [contacts, search]);

  return (
    <>
      <PageHeader
        title="Contacts"
        count={contacts?.length}
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
              Add contact
            </ToolbarButton>
          </>
        }
      />

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search contacts by name, email, company..."
      />

      {isLoading ? (
        <TableSkeleton rows={6} />
      ) : isError ? (
        <ErrorState
          description={(error as Error)?.message ?? "Could not load contacts"}
          onRetry={() => refetch?.()}
        />
      ) : (contacts?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<span className="material-symbols-outlined text-[28px]">contacts</span>}
          title="No contacts yet"
          description="Convert a qualified lead, or add a contact manually."
          action={
            <button
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-cta px-4 py-2 text-sm font-semibold text-cta-foreground hover:bg-cta-hover"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Add your first contact
            </button>
          }
        />
      ) : view === "grid" ? (
        <ContactsGrid contacts={filtered} />
      ) : (
        <ContactsTable contacts={filtered} />
      )}

      <AddContactModal open={addOpen} onOpenChange={setAddOpen} />
    </>
  );
}
