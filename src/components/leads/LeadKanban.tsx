import { Link } from "@tanstack/react-router";
import {
  LEAD_STATUSES,
  useUpdateLeadStatus,
  type LeadRow,
  type LeadStatus,
} from "@/lib/leads-data";
import { useState } from "react";
import type { DragEvent, ReactNode } from "react";
import { toast } from "sonner";

export function LeadKanban({
  leads,
  onConvert,
  onDisqualify,
}: {
  leads: LeadRow[];
  onConvert: (lead: LeadRow) => void;
  onDisqualify: (lead: LeadRow) => void;
}) {
  const update = useUpdateLeadStatus();
  const [dragOver, setDragOver] = useState<LeadStatus | null>(null);

  function onDrop(status: LeadStatus, e: DragEvent) {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData("text/lead-id");
    if (!id) return;
    const lead = leads.find((item) => item.id === id);
    if (!lead) return;
    if (status === "converted") {
      onConvert(lead);
      return;
    }
    if (status === "disqualified") {
      onDisqualify(lead);
      return;
    }
    update.mutate(
      { id, status },
      {
        onSuccess: () =>
          toast.success(`Moved to ${LEAD_STATUSES.find((s) => s.id === status)?.label}`),
        onError: (err) => toast.error("Could not update", { description: (err as Error).message }),
      },
    );
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-[1200px] gap-6">
        {LEAD_STATUSES.map((col) => {
          const items = leads.filter((l) => l.status === col.id);
          const tone = columnTone(col.id);
          return (
            <div
              key={col.id}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(col.id);
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => onDrop(col.id, e)}
              className={`flex min-h-[calc(100vh-240px)] flex-1 flex-col gap-4 transition-colors ${
                dragOver === col.id ? "rounded-lg bg-primary-light/40 ring-2 ring-primary/30" : ""
              }`}
            >
              <div
                className={`flex items-center justify-between border-t-4 ${tone.border} px-1 pt-4`}
              >
                <div className="flex items-center gap-2">
                  <span className={`h-3 w-3 rounded-full ${tone.dot}`} />
                  <h3 className="text-[16px] font-semibold text-foreground">{col.label}</h3>
                  <span className="ml-1 text-xs font-semibold text-text-secondary">
                    {items.length}
                  </span>
                </div>
                <button
                  className="text-text-muted transition-colors hover:text-primary"
                  title={`Add ${col.label} lead`}
                >
                  <span className="material-symbols-outlined">add_circle</span>
                </button>
              </div>
              <div className="flex flex-col gap-4 pr-1">
                {items.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border bg-card p-6 text-center text-xs text-text-muted">
                    No leads
                  </div>
                ) : (
                  items.map((l) => (
                    <LeadCard
                      key={l.id}
                      lead={l}
                      tone={tone}
                      onConvert={() => onConvert(l)}
                      onDisqualify={() => onDisqualify(l)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LeadCard({
  lead,
  tone,
  onConvert,
  onDisqualify,
}: {
  lead: LeadRow;
  tone: ReturnType<typeof columnTone>;
  onConvert: () => void;
  onDisqualify: () => void;
}) {
  const name = `${lead.first_name} ${lead.last_name}`;
  const value =
    typeof lead.value === "number" ? money(lead.value, lead.currency ?? "USD") : "Unvalued";

  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/lead-id", lead.id)}
      className="group block cursor-grab overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-xs)] transition-shadow hover:shadow-[var(--shadow-sm)] active:cursor-grabbing"
    >
      <div className={`h-1 w-full ${tone.dot}`} />
      <div className="p-4">
        <Link to="/app/leads/$id" params={{ id: lead.id }} className="block">
          <div className="mb-4 flex items-start justify-between">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full ${tone.avatar} text-sm font-bold`}
            >
              {initials(name)}
            </div>
            <span className="material-symbols-outlined text-text-muted/50">drag_indicator</span>
          </div>
          <h4 className="mb-1 text-[16px] font-semibold text-foreground">{name}</h4>
          <div
            className={`mb-4 text-xs font-bold ${lead.status === "converted" ? "text-success" : "text-primary"}`}
          >
            {value}
          </div>
          <div className="mb-5 space-y-2 text-sm text-text-secondary">
            <IconLine icon="mail">{lead.email}</IconLine>
            <IconLine icon="call">{lead.phone || "No phone"}</IconLine>
            <IconLine icon="business">{lead.company_name || "No company"}</IconLine>
          </div>
        </Link>
        <div className="flex items-center justify-between border-t border-border pt-4">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-text-secondary">
            <span className="material-symbols-outlined text-[16px]">
              {lead.source?.toLowerCase().includes("landing") ? "web" : "person"}
            </span>
            {lead.source || "Manual Entry"}
          </div>
          {lead.status !== "converted" && lead.status !== "disqualified" ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onConvert}
                className="rounded p-1 text-text-muted transition-colors hover:bg-primary-light hover:text-primary"
                title="Convert to deal"
              >
                <span className="material-symbols-outlined text-[20px]">handshake</span>
              </button>
              <button
                type="button"
                onClick={onDisqualify}
                className="rounded p-1 text-text-muted transition-colors hover:bg-danger-light hover:text-danger"
                title="Disqualify"
              >
                <span className="material-symbols-outlined text-[20px]">block</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function IconLine({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="material-symbols-outlined shrink-0 text-[18px]">{icon}</span>
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

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function columnTone(status: LeadStatus) {
  switch (status) {
    case "new":
      return {
        border: "border-t-primary",
        dot: "bg-primary",
        avatar: "bg-primary-light text-primary",
      };
    case "contacted":
      return {
        border: "border-t-accent",
        dot: "bg-accent",
        avatar: "bg-accent-light text-accent-foreground",
      };
    case "qualified":
      return {
        border: "border-t-success",
        dot: "bg-success",
        avatar: "bg-success-light text-success",
      };
    case "converted":
      return {
        border: "border-t-primary",
        dot: "bg-primary",
        avatar: "bg-primary-light text-primary",
      };
    case "disqualified":
      return { border: "border-t-danger", dot: "bg-danger", avatar: "bg-danger-light text-danger" };
    default:
      return {
        border: "border-t-border-strong",
        dot: "bg-text-muted",
        avatar: "bg-muted text-text-secondary",
      };
  }
}
