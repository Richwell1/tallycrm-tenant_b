// Credit notes. Deliberately mirrors invoices-data.ts and receipts-data.ts: same
// query shapes, same server-owned totals, same soft-delete.
//
// A credit note references an invoice through invoice_id but never writes back to
// it — invoice totals and payment state are untouched by this module.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { CompanyRow, ContactRow, ProfileRow } from "@/lib/quotes-data";
import type { InvoiceRow } from "@/lib/invoices-data";

export type CreditNoteRow = Database["public"]["Tables"]["credit_notes"]["Row"];
export type CreditNoteInsert = Database["public"]["Tables"]["credit_notes"]["Insert"];
export type CreditNoteUpdate = Database["public"]["Tables"]["credit_notes"]["Update"];
export type CreditNoteLineItemRow = Database["public"]["Tables"]["credit_note_line_items"]["Row"];
export type CreditNoteLineItemInsert =
  Database["public"]["Tables"]["credit_note_line_items"]["Insert"];
export type CreditNoteStatusHistoryRow =
  Database["public"]["Tables"]["credit_note_status_history"]["Row"];
export type CreditNoteStatus = Database["public"]["Enums"]["credit_note_status"];

export type CreditNoteInvoice = Pick<
  InvoiceRow,
  | "id"
  | "invoice_number"
  | "title"
  | "status"
  | "total"
  | "currency"
  | "issue_date"
  | "contact_id"
  | "company_id"
  | "assigned_to"
>;

export interface CreditNoteSummary extends CreditNoteRow {
  invoice?: CreditNoteInvoice | null;
  contact?: ContactRow | null;
  company?: CompanyRow | null;
  assigned_rep?: ProfileRow | null;
  line_count: number;
}

export interface CreditNoteDetail extends CreditNoteSummary {
  line_items: CreditNoteLineItemRow[];
  status_history: CreditNoteStatusHistoryRow[];
}

export interface CreditNoteLineItemDraft {
  id?: string;
  catalog_item_id?: string | null;
  name: string;
  description?: string | null;
  unit: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  tax_rate: number;
}

export interface CreateCreditNoteInput {
  invoice_id?: string | null;
  company_id?: string | null;
  contact_id?: string | null;
  issue_date: string;
  currency: string;
  reason?: string | null;
  notes?: string | null;
}

export const creditNotesKey = ["credit_notes"] as const;

const INVOICE_SELECT =
  "id,invoice_number,title,status,total,currency,issue_date,contact_id,company_id,assigned_to";

export function useCreditNotes() {
  return useQuery({
    queryKey: creditNotesKey,
    queryFn: async () => {
      const [notesRes, linesRes, invoicesRes, contactsRes, companiesRes, profilesRes] =
        await Promise.all([
          supabase
            .from("credit_notes")
            .select("*")
            .is("deleted_at", null)
            .order("issue_date", { ascending: false })
            .order("created_at", { ascending: false }),
          supabase.from("credit_note_line_items").select("credit_note_id"),
          supabase.from("invoices").select(INVOICE_SELECT).is("deleted_at", null),
          supabase.from("contacts").select("*").is("deleted_at", null),
          supabase.from("companies").select("*").is("deleted_at", null),
          supabase.from("profiles").select("*"),
        ]);

      if (notesRes.error) throw notesRes.error;
      if (linesRes.error) throw linesRes.error;
      if (invoicesRes.error) throw invoicesRes.error;
      if (contactsRes.error) throw contactsRes.error;
      if (companiesRes.error) throw companiesRes.error;
      if (profilesRes.error) throw profilesRes.error;

      const counts = new Map<string, number>();
      for (const line of (linesRes.data ?? []) as Array<{ credit_note_id: string }>) {
        counts.set(line.credit_note_id, (counts.get(line.credit_note_id) ?? 0) + 1);
      }

      return ((notesRes.data ?? []) as CreditNoteRow[]).map((note) =>
        summarizeCreditNote(
          note,
          (invoicesRes.data ?? []) as CreditNoteInvoice[],
          (contactsRes.data ?? []) as ContactRow[],
          (companiesRes.data ?? []) as CompanyRow[],
          (profilesRes.data ?? []) as ProfileRow[],
          counts,
        ),
      );
    },
  });
}

export function useCreditNote(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ["credit_note", id],
    queryFn: async (): Promise<CreditNoteDetail> => {
      const noteRes = await supabase.from("credit_notes").select("*").eq("id", id!).single();
      if (noteRes.error) throw noteRes.error;
      const note = noteRes.data as CreditNoteRow;

      const [linesRes, invoicesRes, contactsRes, companiesRes, profilesRes, historyRes] =
        await Promise.all([
          supabase
            .from("credit_note_line_items")
            .select("*")
            .eq("credit_note_id", id!)
            .order("position", { ascending: true }),
          supabase.from("invoices").select(INVOICE_SELECT).is("deleted_at", null),
          supabase.from("contacts").select("*").is("deleted_at", null),
          supabase.from("companies").select("*").is("deleted_at", null),
          supabase.from("profiles").select("*"),
          supabase
            .from("credit_note_status_history")
            .select("*")
            .eq("credit_note_id", id!)
            .order("changed_at", { ascending: false }),
        ]);

      if (linesRes.error) throw linesRes.error;
      if (invoicesRes.error) throw invoicesRes.error;
      if (contactsRes.error) throw contactsRes.error;
      if (companiesRes.error) throw companiesRes.error;
      if (profilesRes.error) throw profilesRes.error;
      if (historyRes.error) throw historyRes.error;

      const lines = (linesRes.data ?? []) as CreditNoteLineItemRow[];

      return {
        ...summarizeCreditNote(
          note,
          (invoicesRes.data ?? []) as CreditNoteInvoice[],
          (contactsRes.data ?? []) as ContactRow[],
          (companiesRes.data ?? []) as CompanyRow[],
          (profilesRes.data ?? []) as ProfileRow[],
          new Map([[note.id, lines.length]]),
        ),
        line_items: lines,
        status_history: (historyRes.data ?? []) as CreditNoteStatusHistoryRow[],
      };
    },
  });
}

/** Credit notes raised against one invoice — used by the invoice detail page. */
export function useCreditNotesForInvoice(invoiceId: string | undefined) {
  return useQuery({
    enabled: !!invoiceId,
    queryKey: ["credit_notes", "invoice", invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_notes")
        .select("*")
        .eq("invoice_id", invoiceId!)
        .is("deleted_at", null)
        .order("issue_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CreditNoteRow[];
    },
  });
}

export function useCreditableInvoices() {
  return useQuery({
    queryKey: ["creditable_invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(INVOICE_SELECT)
        .is("deleted_at", null)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CreditNoteInvoice[];
    },
  });
}

export function useCreateCreditNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCreditNoteInput) => {
      const { data, error } = await supabase
        .from("credit_notes")
        .insert({
          invoice_id: input.invoice_id || null,
          company_id: input.company_id || null,
          contact_id: input.contact_id || null,
          issue_date: input.issue_date,
          currency: input.currency,
          reason: input.reason?.trim() || null,
          notes: input.notes?.trim() || null,
        } as CreditNoteInsert)
        .select("id,credit_note_number,invoice_id")
        .single();
      if (error) throw error;
      return data as Pick<CreditNoteRow, "id" | "credit_note_number" | "invoice_id">;
    },
    onSuccess: (note) => invalidateCreditNotes(qc, note.id, note.invoice_id ?? undefined),
  });
}

/** Server-side clone. Customer, currency and line items are copied by the database. */
export function useCreateCreditNoteFromInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const { data, error } = await supabase.rpc("create_credit_note_from_invoice", {
        _invoice_id: invoiceId,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => invalidateCreditNotes(qc),
  });
}

export function useUpdateCreditNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: CreditNoteUpdate }) => {
      const { error } = await supabase.from("credit_notes").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => invalidateCreditNotes(qc, vars.id),
  });
}

export function useUpdateCreditNoteStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: CreditNoteStatus }) => {
      const { error } = await supabase.from("credit_notes").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => invalidateCreditNotes(qc, vars.id),
  });
}

/** Same replace-in-one-pass strategy as the invoice editor. Totals land server-side. */
export function useSaveCreditNoteLineItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      creditNoteId,
      lines,
    }: {
      creditNoteId: string;
      lines: CreditNoteLineItemDraft[];
    }) => {
      const existingRes = await supabase
        .from("credit_note_line_items")
        .select("id")
        .eq("credit_note_id", creditNoteId);
      if (existingRes.error) throw existingRes.error;

      const keptIds = new Set(lines.map((line) => line.id).filter(Boolean) as string[]);
      const removed = ((existingRes.data ?? []) as Array<{ id: string }>)
        .map((row) => row.id)
        .filter((id) => !keptIds.has(id));

      if (removed.length) {
        const { error } = await supabase.from("credit_note_line_items").delete().in("id", removed);
        if (error) throw error;
      }

      for (const [index, line] of lines.entries()) {
        const payload = {
          credit_note_id: creditNoteId,
          position: index,
          catalog_item_id: line.catalog_item_id || null,
          name: line.name.trim(),
          description: line.description?.trim() || null,
          unit: line.unit || "unit",
          quantity: line.quantity,
          unit_price: line.unit_price,
          discount_percent: line.discount_percent,
          tax_rate: line.tax_rate,
        } satisfies CreditNoteLineItemInsert;

        if (line.id) {
          const { error } = await supabase
            .from("credit_note_line_items")
            .update(payload)
            .eq("id", line.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("credit_note_line_items").insert(payload);
          if (error) throw error;
        }
      }
    },
    onSuccess: (_data, vars) => invalidateCreditNotes(qc, vars.creditNoteId),
  });
}

export function useDeleteCreditNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("credit_notes")
        .update({ deleted_at: new Date().toISOString() } satisfies CreditNoteUpdate)
        .eq("id", id)
        .select("invoice_id")
        .single();
      if (error) throw error;
      return data as Pick<CreditNoteRow, "invoice_id">;
    },
    onSuccess: (note, id) => invalidateCreditNotes(qc, id, note.invoice_id ?? undefined),
  });
}

function invalidateCreditNotes(
  qc: ReturnType<typeof useQueryClient>,
  creditNoteId?: string,
  invoiceId?: string,
) {
  qc.invalidateQueries({ queryKey: creditNotesKey });
  qc.invalidateQueries({ queryKey: ["creditable_invoices"] });
  if (creditNoteId) qc.invalidateQueries({ queryKey: ["credit_note", creditNoteId] });
  if (invoiceId) qc.invalidateQueries({ queryKey: ["credit_notes", "invoice", invoiceId] });
}

function summarizeCreditNote(
  note: CreditNoteRow,
  invoices: CreditNoteInvoice[],
  contacts: ContactRow[],
  companies: CompanyRow[],
  profiles: ProfileRow[],
  lineCounts: Map<string, number>,
): CreditNoteSummary {
  const invoice = invoices.find((item) => item.id === note.invoice_id) ?? null;
  return {
    ...note,
    invoice,
    contact:
      contacts.find((contact) => contact.id === note.contact_id) ??
      contacts.find((contact) => contact.id === invoice?.contact_id) ??
      null,
    company:
      companies.find((company) => company.id === note.company_id) ??
      companies.find((company) => company.id === invoice?.company_id) ??
      null,
    assigned_rep:
      profiles.find((profile) => profile.id === note.assigned_to) ??
      profiles.find((profile) => profile.id === invoice?.assigned_to) ??
      null,
    line_count: lineCounts.get(note.id) ?? 0,
  };
}

export function creditNoteClientName(note: {
  contact?: ContactRow | null;
  company?: CompanyRow | null;
}): string {
  if (note.company?.name) return note.company.name;
  if (note.contact) return `${note.contact.first_name} ${note.contact.last_name}`.trim();
  return "No customer";
}
