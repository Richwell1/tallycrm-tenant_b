import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState, ErrorState, GridSkeleton, TableSkeleton } from "@/components/common";
import { PageHeader, ToolbarButton as LayoutToolbarButton, CrmToolbar } from "@/components/layout";
import { AddContactModal } from "@/components/contacts/AddContactModal";
import { EditContactModal } from "@/components/contacts/EditContactModal";
import { useCurrentRole } from "@/lib/auth-context";
import { type ContactSummary, useContacts, useDeleteContact } from "@/lib/contacts-data";
import { formatRelative } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/contacts/")({
  component: ContactsIndex,
});

type View = "grid" | "table";
type ContactSort = "recent" | "name" | "company" | "lastActivity";

function ContactsIndex() {
  const { data: contacts, isLoading, isError, error, refetch } = useContacts();
  const role = useCurrentRole();
  const deleteContact = useDeleteContact();
  const [view, setView] = useState<View>("grid");
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [sortKey, setSortKey] = useState<ContactSort>("recent");
  const [addOpen, setAddOpen] = useState(false);
  const [editContact, setEditContact] = useState<ContactSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContactSummary | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const canDelete = role === "admin" || role === "manager";

  const companyOptions = useMemo(
    () =>
      Array.from(new Set((contacts ?? []).map((contact) => contact.company?.name).filter(Boolean)))
        .sort()
        .map((name) => name!),
    [contacts],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (contacts ?? []).filter((contact) => {
      const companyMatch = companyFilter === "all" || contact.company?.name === companyFilter;
      const searchMatch =
        !q ||
        [
          contact.first_name,
          contact.last_name,
          contact.email,
          contact.phone,
          contact.job_title,
          contact.company?.name,
          contact.company?.country,
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(q));
      return companyMatch && searchMatch;
    });

    return list.sort((a, b) => {
      if (sortKey === "name")
        return `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`);
      if (sortKey === "company")
        return (a.company?.name ?? "").localeCompare(b.company?.name ?? "");
      if (sortKey === "lastActivity")
        return dateRank(b.last_activity_at) - dateRank(a.last_activity_at);
      return dateRank(b.created_at) - dateRank(a.created_at);
    });
  }, [companyFilter, contacts, search, sortKey]);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((current) =>
      current.size === filtered.length ? new Set() : new Set(filtered.map((contact) => contact.id)),
    );
  }

  return (
    <>
      <PageHeader
        title="Contacts"
        count={contacts?.length ?? 0}
        breadcrumbs={[{ label: "Directory" }, { label: "Accounts" }]}
        actions={
          <>
            <LayoutToolbarButton icon="ios_share">Export</LayoutToolbarButton>
            <LayoutToolbarButton icon="refresh" onClick={() => refetch()}>
              Refresh
            </LayoutToolbarButton>
            <LayoutToolbarButton icon="add" variant="cta" onClick={() => setAddOpen(true)}>
              Add Contact
            </LayoutToolbarButton>
          </>
        }
      />

      <CrmToolbar<View>
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search contacts..."
        view={view}
        onViewChange={setView}
        viewOptions={[
          { value: "grid", icon: "grid_view", label: "Grid" },
          { value: "table", icon: "format_list_bulleted", label: "List" },
        ]}
        filters={[
          {
            label: "Company",
            value: companyFilter,
            onChange: setCompanyFilter,
            options: companyOptions.map((c) => ({ value: c, label: c })),
          },
        ]}
        sort={{
          value: sortKey,
          onChange: (v) => setSortKey(v as ContactSort),
          options: [
            { value: "recent", label: "Recently created" },
            { value: "name", label: "Name" },
            { value: "company", label: "Company" },
            { value: "lastActivity", label: "Last activity" },
          ],
        }}
        trailing={
          <button className="flex items-center gap-1 text-[11px] font-bold text-primary hover:underline">
            <span className="material-symbols-outlined text-[18px]">tune</span>
            Advanced Filters
          </button>
        }
        resultCount={filtered.length}
        resultNoun="contacts"
      />

      {isLoading ? (
        view === "grid" ? (
          <GridSkeleton count={8} />
        ) : (
          <TableSkeleton rows={8} columns={9} />
        )
      ) : isError ? (
        <ErrorState
          description={(error as Error)?.message ?? "Could not load contacts"}
          onRetry={() => refetch()}
        />
      ) : (contacts?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<span className="material-symbols-outlined text-[28px]">contacts</span>}
          title="No contacts yet"
          description="Qualified leads and manually added people will appear in this directory."
          action={
            <button
              onClick={() => setAddOpen(true)}
              className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white"
            >
              Add Contact
            </button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<span className="material-symbols-outlined text-[28px]">search_off</span>}
          title="No contacts match your filters"
          description="Adjust search, company, or sort criteria to widen the result set."
        />
      ) : view === "grid" ? (
        <ContactsGrid
          contacts={filtered}
          onEdit={setEditContact}
          onDelete={canDelete ? setDeleteTarget : undefined}
        />
      ) : (
        <ContactsTable
          contacts={filtered}
          selected={selected}
          onToggle={toggle}
          onToggleAll={toggleAll}
          onEdit={setEditContact}
          onDelete={canDelete ? setDeleteTarget : undefined}
        />
      )}

      <div className="mt-12 flex items-center justify-between">
        <p className="text-xs font-semibold text-text-muted">
          Showing 1 to {Math.min(filtered.length, view === "grid" ? 8 : 10)} of {filtered.length}{" "}
          contacts
        </p>
        <Pagination last={view === "grid" ? 16 : 13} />
      </div>

      <BulkActions count={selected.size} onClose={() => setSelected(new Set())} />
      <AddContactModal open={addOpen} onOpenChange={setAddOpen} />
      {editContact && (
        <EditContactModal
          contact={editContact}
          open={!!editContact}
          onOpenChange={(open) => !open && setEditContact(null)}
        />
      )}
      {deleteTarget && (
        <ConfirmDelete
          name={`${deleteTarget.first_name} ${deleteTarget.last_name}`}
          isPending={deleteContact.isPending}
          onConfirm={() => {
            deleteContact.mutate(deleteTarget.id, {
              onSuccess: () => {
                toast.success("Contact deleted");
                setDeleteTarget(null);
              },
              onError: (error) =>
                toast.error("Could not delete contact", {
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

function ContactsGrid({
  contacts,
  onEdit,
  onDelete,
}: {
  contacts: ContactSummary[];
  onEdit: (contact: ContactSummary) => void;
  onDelete?: (contact: ContactSummary) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
      {contacts.map((contact) => (
        <div
          key={contact.id}
          className="group flex h-full flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-[var(--shadow-xs)] transition-all hover:-translate-y-1 hover:border-primary"
        >
          <Link to="/app/contacts/$id" params={{ id: contact.id }} className="flex-1 p-6">
            <div className="mb-4 flex items-start justify-between">
              <Avatar contact={contact} size="md" />
              <Tags tags={contact.tags ?? fallbackTags(contact)} compact />
            </div>
            <h3 className="mb-1 text-[16px] font-semibold text-foreground transition-colors group-hover:text-primary">
              {contact.first_name} {contact.last_name}
            </h3>
            <p className="mb-4 text-xs font-semibold text-text-muted">
              {contact.job_title || "Contact"}
            </p>
            <div className="space-y-2 text-sm text-text-secondary">
              <IconLine icon="mail">{contact.email || "No email"}</IconLine>
              <IconLine icon="call">{contact.phone || "No phone"}</IconLine>
              <IconLine icon="business">{contact.company?.name || "No company"}</IconLine>
              <IconLine icon="location_on">
                {[contact.company?.city, contact.company?.country].filter(Boolean).join(", ") ||
                  "No location"}
              </IconLine>
            </div>
          </Link>
          <div className="flex items-center justify-between border-t border-border bg-muted/40 px-6 py-4">
            <div className="flex items-center gap-1 text-text-muted">
              <Link
                to="/app/contacts/$id"
                params={{ id: contact.id }}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold transition-colors hover:bg-muted hover:text-primary"
                title="View"
              >
                <span className="material-symbols-outlined text-[18px]">visibility</span>
                View
              </Link>
              <button
                onClick={() => onEdit(contact)}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold transition-colors hover:bg-muted hover:text-primary"
                title="Edit"
              >
                <span className="material-symbols-outlined text-[18px]">edit</span>
                Edit
              </button>
              {onDelete && (
                <button
                  onClick={() => onDelete(contact)}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold transition-colors hover:bg-danger-light hover:text-danger"
                  title="Delete"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                  Delete
                </button>
              )}
            </div>
            <RepAvatar rep={contact.assigned_rep} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ContactsTable({
  contacts,
  selected,
  onToggle,
  onToggleAll,
  onEdit,
  onDelete,
}: {
  contacts: ContactSummary[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onEdit: (contact: ContactSummary) => void;
  onDelete?: (contact: ContactSummary) => void;
}) {
  return (
    <div className="flex min-h-[540px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-xs)]">
      <div className="flex-1 overflow-x-auto">
        <table className="w-full min-w-[1120px] border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-muted">
            <tr className="border-b border-border">
              <TableHead className="w-12">
                <input
                  type="checkbox"
                  checked={contacts.length > 0 && selected.size === contacts.length}
                  onChange={onToggleAll}
                  className="h-4 w-4 cursor-pointer rounded border-border text-primary focus:ring-primary"
                />
              </TableHead>
              <TableHead className="min-w-[220px]">Name</TableHead>
              <TableHead>Job Title</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Assigned Rep</TableHead>
              <TableHead>Created Date</TableHead>
              <TableHead className="w-16" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {contacts.map((contact, index) => (
              <tr
                key={contact.id}
                className={`group transition-colors hover:bg-primary-light/50 ${index % 2 ? "bg-muted/40" : "bg-card"}`}
              >
                <td className="p-4">
                  <input
                    type="checkbox"
                    checked={selected.has(contact.id)}
                    onChange={() => onToggle(contact.id)}
                    className="h-4 w-4 cursor-pointer rounded border-border text-primary focus:ring-primary"
                  />
                </td>
                <td className="p-4">
                  <Link
                    to="/app/contacts/$id"
                    params={{ id: contact.id }}
                    className="flex items-center gap-3"
                  >
                    <Avatar contact={contact} size="sm" />
                    <span className="min-w-0">
                      <span className="block text-[16px] font-semibold text-foreground transition-colors group-hover:text-primary">
                        {contact.first_name} {contact.last_name}
                      </span>
                      <span className="block text-[11px] text-text-secondary">
                        {contact.source || "LinkedIn Verified"}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="p-4 text-sm text-text-secondary">{contact.job_title || "—"}</td>
                <td className="p-4 text-sm text-primary underline decoration-primary/30">
                  {contact.email || "—"}
                </td>
                <td className="whitespace-nowrap p-4 text-sm text-text-secondary">
                  {contact.phone || "—"}
                </td>
                <td className="p-4 text-sm text-text-secondary">{contact.company?.name || "—"}</td>
                <td className="p-4 text-sm text-text-secondary">
                  {contact.company?.country || "—"}
                </td>
                <td className="p-4">
                  <Tags tags={contact.tags ?? fallbackTags(contact)} />
                </td>
                <td className="p-4">
                  <RepAvatar rep={contact.assigned_rep} />
                </td>
                <td className="p-4 text-sm text-text-secondary">
                  {new Date(contact.created_at).toLocaleDateString()}
                </td>
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => onEdit(contact)}
                      className="rounded p-1 text-text-muted transition-colors hover:bg-muted hover:text-primary"
                      title="Edit"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    {onDelete && (
                      <button
                        onClick={() => onDelete(contact)}
                        className="rounded p-1 text-text-muted transition-colors hover:bg-muted hover:text-danger"
                        title="Delete"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="flex items-center justify-between border-t border-border bg-card p-4">
        <p className="text-sm text-text-secondary">
          Showing <span className="font-bold text-foreground">1-10</span> of{" "}
          <span className="font-bold text-foreground">{contacts.length}</span> entries
        </p>
        <Pagination last={13} compact />
      </footer>
    </div>
  );
}

function TableHead({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`p-4 text-[11px] font-bold uppercase tracking-wider text-text-secondary ${className}`}
    >
      {children}
    </th>
  );
}

function Avatar({ contact, size }: { contact: ContactSummary; size: "sm" | "md" }) {
  const classes = size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-[16px]";
  return (
    <span
      className={`flex ${classes} shrink-0 items-center justify-center rounded-full border-2 border-white bg-primary-light font-bold text-primary shadow-[var(--shadow-xs)]`}
    >
      {initials(`${contact.first_name} ${contact.last_name}`)}
    </span>
  );
}

function RepAvatar({ rep }: { rep?: ContactSummary["assigned_rep"] }) {
  return (
    <span className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border border-white bg-primary-light text-[10px] font-bold text-primary shadow-[var(--shadow-xs)] ring-1 ring-border">
      {rep?.avatar_url ? (
        <img
          src={rep.avatar_url}
          alt={rep.full_name ?? "Rep"}
          className="h-full w-full object-cover"
        />
      ) : (
        initials(rep?.full_name ?? "T")
      )}
    </span>
  );
}

function Tags({ tags, compact }: { tags: string[]; compact?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1">
      {tags.slice(0, compact ? 2 : 3).map((tag, index) => (
        <span
          key={tag}
          className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
            index % 2 ? "bg-primary-light text-primary" : "bg-primary-light/60 text-primary"
          }`}
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

function IconLine({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="material-symbols-outlined shrink-0 text-[18px] text-text-muted">{icon}</span>
      <span className="truncate">{children}</span>
    </div>
  );
}

function Pagination({ last, compact }: { last: number; compact?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-border transition-colors hover:bg-muted">
        <span className="material-symbols-outlined">chevron_left</span>
      </button>
      {[1, 2, 3].map((page) => (
        <button
          key={page}
          className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold ${
            page === 1 ? "bg-primary text-white" : "text-text-secondary hover:bg-muted"
          }`}
        >
          {page}
        </button>
      ))}
      {!compact ? <span className="mx-1 text-text-muted">...</span> : null}
      <button className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold text-text-secondary hover:bg-muted">
        {last}
      </button>
      <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-border transition-colors hover:bg-muted">
        <span className="material-symbols-outlined">chevron_right</span>
      </button>
    </div>
  );
}

function BulkActions({ count, onClose }: { count: number; onClose: () => void }) {
  return (
    <div
      className={`fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-8 rounded-2xl bg-sidebar px-6 py-4 text-white shadow-2xl transition-all duration-300 ${
        count > 0 ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-32 opacity-0"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold">
          {count}
        </span>
        <p className="text-xs font-semibold">Contacts selected</p>
      </div>
      <div className="h-6 w-px bg-white/20" />
      <div className="flex items-center gap-2">
        {["edit", "mail", "folder_move", "delete"].map((icon) => (
          <button key={icon} className="rounded-lg px-3 py-1.5 transition-colors hover:bg-white/10">
            <span className="material-symbols-outlined text-[18px]">{icon}</span>
          </button>
        ))}
      </div>
      <button onClick={onClose} className="rounded-full p-1 transition-colors hover:bg-white/10">
        <span className="material-symbols-outlined">close</span>
      </button>
    </div>
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
        <h3 className="mb-2 text-lg font-semibold text-foreground">Delete Contact</h3>
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

function fallbackTags(contact: ContactSummary) {
  if (contact.open_deal_count > 0) return ["Decision Maker", "High Value"];
  if (contact.tags?.length) return contact.tags;
  return ["Collab"];
}

function dateRank(value: string | null | undefined) {
  return value ? new Date(value).getTime() : 0;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
