import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { CompanyRow, ContactRow, ProfileRow } from "@/lib/quotes-data";
import type { InvoiceRow } from "@/lib/invoices-data";

export type DeliveryNoteRow = Database["public"]["Tables"]["delivery_notes"]["Row"];
export type DeliveryNoteInsert = Database["public"]["Tables"]["delivery_notes"]["Insert"];
export type DeliveryNoteUpdate = Database["public"]["Tables"]["delivery_notes"]["Update"];
export type DeliveryNoteItemRow = Database["public"]["Tables"]["delivery_note_items"]["Row"];
export type DeliveryNoteItemInsert = Database["public"]["Tables"]["delivery_note_items"]["Insert"];
export type DeliveryNoteStatusHistoryRow =
  Database["public"]["Tables"]["delivery_note_status_history"]["Row"];
export type DeliveryNoteStatus = Database["public"]["Enums"]["delivery_note_status"];

export type DeliveryNoteInvoice = Pick<
  InvoiceRow,
  | "id"
  | "invoice_number"
  | "title"
  | "status"
  | "issue_date"
  | "contact_id"
  | "company_id"
  | "assigned_to"
>;

export interface DeliveryNoteSummary extends DeliveryNoteRow {
  invoice?: DeliveryNoteInvoice | null;
  contact?: ContactRow | null;
  company?: CompanyRow | null;
  assigned_rep?: ProfileRow | null;
  item_count: number;
}

export interface DeliveryNoteDetail extends DeliveryNoteSummary {
  items: DeliveryNoteItemRow[];
  status_history: DeliveryNoteStatusHistoryRow[];
}

export interface DeliveryNoteItemDraft {
  id?: string;
  catalog_item_id?: string | null;
  name: string;
  description?: string | null;
  unit: string;
  quantity: number;
}

export interface CreateDeliveryNoteInput {
  invoice_id?: string | null;
  company_id?: string | null;
  contact_id?: string | null;
  delivery_date: string;
  recipient_name?: string | null;
  delivery_address?: string | null;
  carrier?: string | null;
  tracking_reference?: string | null;
  notes?: string | null;
}

export const deliveryNotesKey = ["delivery_notes"] as const;
const INVOICE_SELECT =
  "id,invoice_number,title,status,issue_date,contact_id,company_id,assigned_to";

export function useDeliveryNotes() {
  return useQuery({
    queryKey: deliveryNotesKey,
    queryFn: async () => {
      const [notesRes, itemsRes, invoicesRes, contactsRes, companiesRes, profilesRes] =
        await Promise.all([
          supabase
            .from("delivery_notes")
            .select("*")
            .is("deleted_at", null)
            .order("delivery_date", { ascending: false })
            .order("created_at", { ascending: false }),
          supabase.from("delivery_note_items").select("delivery_note_id"),
          supabase.from("invoices").select(INVOICE_SELECT).is("deleted_at", null),
          supabase.from("contacts").select("*").is("deleted_at", null),
          supabase.from("companies").select("*").is("deleted_at", null),
          supabase.from("profiles").select("*"),
        ]);
      if (notesRes.error) throw notesRes.error;
      if (itemsRes.error) throw itemsRes.error;
      if (invoicesRes.error) throw invoicesRes.error;
      if (contactsRes.error) throw contactsRes.error;
      if (companiesRes.error) throw companiesRes.error;
      if (profilesRes.error) throw profilesRes.error;
      const counts = new Map<string, number>();
      for (const item of (itemsRes.data ?? []) as Array<{ delivery_note_id: string }>) {
        counts.set(item.delivery_note_id, (counts.get(item.delivery_note_id) ?? 0) + 1);
      }
      return ((notesRes.data ?? []) as DeliveryNoteRow[]).map((note) =>
        summarizeDeliveryNote(
          note,
          (invoicesRes.data ?? []) as DeliveryNoteInvoice[],
          (contactsRes.data ?? []) as ContactRow[],
          (companiesRes.data ?? []) as CompanyRow[],
          (profilesRes.data ?? []) as ProfileRow[],
          counts,
        ),
      );
    },
  });
}

export function useDeliveryNote(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ["delivery_note", id],
    queryFn: async (): Promise<DeliveryNoteDetail> => {
      const noteRes = await supabase.from("delivery_notes").select("*").eq("id", id!).single();
      if (noteRes.error) throw noteRes.error;
      const note = noteRes.data as DeliveryNoteRow;
      const [itemsRes, invoicesRes, contactsRes, companiesRes, profilesRes, historyRes] =
        await Promise.all([
          supabase
            .from("delivery_note_items")
            .select("*")
            .eq("delivery_note_id", id!)
            .order("position", { ascending: true }),
          supabase.from("invoices").select(INVOICE_SELECT).is("deleted_at", null),
          supabase.from("contacts").select("*").is("deleted_at", null),
          supabase.from("companies").select("*").is("deleted_at", null),
          supabase.from("profiles").select("*"),
          supabase
            .from("delivery_note_status_history")
            .select("*")
            .eq("delivery_note_id", id!)
            .order("changed_at", { ascending: false }),
        ]);
      for (const result of [
        itemsRes,
        invoicesRes,
        contactsRes,
        companiesRes,
        profilesRes,
        historyRes,
      ]) {
        if (result.error) throw result.error;
      }
      const items = (itemsRes.data ?? []) as DeliveryNoteItemRow[];
      return {
        ...summarizeDeliveryNote(
          note,
          (invoicesRes.data ?? []) as DeliveryNoteInvoice[],
          (contactsRes.data ?? []) as ContactRow[],
          (companiesRes.data ?? []) as CompanyRow[],
          (profilesRes.data ?? []) as ProfileRow[],
          new Map([[note.id, items.length]]),
        ),
        items,
        status_history: (historyRes.data ?? []) as DeliveryNoteStatusHistoryRow[],
      };
    },
  });
}

export function useDeliverableInvoices() {
  return useQuery({
    queryKey: ["deliverable_invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(INVOICE_SELECT)
        .is("deleted_at", null)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DeliveryNoteInvoice[];
    },
  });
}

export function useCreateDeliveryNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateDeliveryNoteInput) => {
      const { data, error } = await supabase
        .from("delivery_notes")
        .insert({
          ...input,
          invoice_id: input.invoice_id || null,
          company_id: input.company_id || null,
          contact_id: input.contact_id || null,
          recipient_name: input.recipient_name?.trim() || null,
          delivery_address: input.delivery_address?.trim() || null,
          carrier: input.carrier?.trim() || null,
          tracking_reference: input.tracking_reference?.trim() || null,
          notes: input.notes?.trim() || null,
        } as DeliveryNoteInsert)
        .select("id,delivery_note_number")
        .single();
      if (error) throw error;
      return data as Pick<DeliveryNoteRow, "id" | "delivery_note_number">;
    },
    onSuccess: (note) => invalidate(qc, note.id),
  });
}

export function useCreateDeliveryNoteFromInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const { data, error } = await supabase.rpc("create_delivery_note_from_invoice", {
        _invoice_id: invoiceId,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (id) => invalidate(qc, id),
  });
}

export function useUpdateDeliveryNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: DeliveryNoteUpdate }) => {
      const { error } = await supabase.from("delivery_notes").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => invalidate(qc, vars.id),
  });
}

export function useUpdateDeliveryNoteStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: DeliveryNoteStatus }) => {
      const { error } = await supabase.from("delivery_notes").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => invalidate(qc, vars.id),
  });
}

export function useSaveDeliveryNoteItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      deliveryNoteId,
      items,
    }: {
      deliveryNoteId: string;
      items: DeliveryNoteItemDraft[];
    }) => {
      const existing = await supabase
        .from("delivery_note_items")
        .select("id")
        .eq("delivery_note_id", deliveryNoteId);
      if (existing.error) throw existing.error;
      const kept = new Set(items.map((item) => item.id).filter(Boolean) as string[]);
      const removed = ((existing.data ?? []) as Array<{ id: string }>)
        .map((row) => row.id)
        .filter((id) => !kept.has(id));
      if (removed.length) {
        const result = await supabase.from("delivery_note_items").delete().in("id", removed);
        if (result.error) throw result.error;
      }
      for (const [position, item] of items.entries()) {
        const payload = {
          delivery_note_id: deliveryNoteId,
          position,
          catalog_item_id: item.catalog_item_id || null,
          name: item.name.trim(),
          description: item.description?.trim() || null,
          unit: item.unit || "unit",
          quantity: item.quantity,
        } satisfies DeliveryNoteItemInsert;
        const result = item.id
          ? await supabase.from("delivery_note_items").update(payload).eq("id", item.id)
          : await supabase.from("delivery_note_items").insert(payload);
        if (result.error) throw result.error;
      }
    },
    onSuccess: (_data, vars) => invalidate(qc, vars.deliveryNoteId),
  });
}

export function useDeleteDeliveryNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("delivery_notes")
        .update({ deleted_at: new Date().toISOString() } satisfies DeliveryNoteUpdate)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, id) => invalidate(qc, id),
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>, id?: string) {
  qc.invalidateQueries({ queryKey: deliveryNotesKey });
  qc.invalidateQueries({ queryKey: ["deliverable_invoices"] });
  if (id) qc.invalidateQueries({ queryKey: ["delivery_note", id] });
}

function summarizeDeliveryNote(
  note: DeliveryNoteRow,
  invoices: DeliveryNoteInvoice[],
  contacts: ContactRow[],
  companies: CompanyRow[],
  profiles: ProfileRow[],
  counts: Map<string, number>,
): DeliveryNoteSummary {
  const invoice = invoices.find((item) => item.id === note.invoice_id) ?? null;
  return {
    ...note,
    invoice,
    contact: contacts.find((item) => item.id === note.contact_id) ?? null,
    company: companies.find((item) => item.id === note.company_id) ?? null,
    assigned_rep: profiles.find((item) => item.id === note.assigned_to) ?? null,
    item_count: counts.get(note.id) ?? 0,
  };
}

export function deliveryNoteClientName(note: {
  recipient_name?: string | null;
  company?: CompanyRow | null;
}) {
  return note.recipient_name || note.company?.name || "No recipient";
}
