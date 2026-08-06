// Invoicing data layer. Deliberately mirrors quotes-data.ts: same query
// shapes, same server-owned totals, same soft-delete. Invoices reference a
// quotation through `quote_id` but never write back to it.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { QuoteDiscountType } from "@/lib/quote-totals";
import type { CompanyRow, ContactRow, DealRow, ProfileRow, QuoteRow } from "@/lib/quotes-data";

export type InvoiceRow = Database["public"]["Tables"]["invoices"]["Row"];
export type InvoiceInsert = Database["public"]["Tables"]["invoices"]["Insert"];
export type InvoiceUpdate = Database["public"]["Tables"]["invoices"]["Update"];
export type InvoiceLineItemRow = Database["public"]["Tables"]["invoice_line_items"]["Row"];
export type InvoiceLineItemInsert = Database["public"]["Tables"]["invoice_line_items"]["Insert"];
export type InvoiceStatusHistoryRow =
  Database["public"]["Tables"]["invoice_status_history"]["Row"];
export type InvoiceStatus = Database["public"]["Enums"]["invoice_status"];

export interface InvoiceSummary extends InvoiceRow {
  contact?: ContactRow | null;
  company?: CompanyRow | null;
  deal?: DealRow | null;
  quote?: Pick<QuoteRow, "id" | "quote_number" | "title"> | null;
  assigned_rep?: ProfileRow | null;
  line_count: number;
}

export interface InvoiceDetail extends InvoiceSummary {
  line_items: InvoiceLineItemRow[];
  status_history: InvoiceStatusHistoryRow[];
}

export interface InvoiceLineItemDraft {
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

export interface CreateInvoiceInput {
  title?: string;
  contact_id?: string | null;
  company_id?: string | null;
  deal_id?: string | null;
  quote_id?: string | null;
  assigned_to?: string | null;
  currency: string;
  issue_date?: string;
  due_date?: string | null;
  discount_type?: QuoteDiscountType;
  discount_value?: number;
  notes?: string | null;
  payment_terms?: string | null;
  lines?: InvoiceLineItemDraft[];
}

export const invoicesKey = ["invoices"] as const;

/** Only the customer and one item are required — everything else has a default. */
export const INVOICE_STATUSES: InvoiceStatus[] = [
  "draft",
  "sent",
  "partially_paid",
  "paid",
  "overdue",
  "cancelled",
];

export function useInvoices() {
  return useQuery({
    queryKey: invoicesKey,
    queryFn: async () => {
      const [invoicesRes, contactsRes, companiesRes, profilesRes, dealsRes, quotesRes, linesRes] =
        await Promise.all([
          supabase
            .from("invoices")
            .select("*")
            .is("deleted_at", null)
            .order("created_at", { ascending: false }),
          supabase.from("contacts").select("*").is("deleted_at", null),
          supabase.from("companies").select("*").is("deleted_at", null),
          supabase.from("profiles").select("*"),
          supabase.from("deals").select("*").is("deleted_at", null),
          supabase.from("quotes").select("id,quote_number,title").is("deleted_at", null),
          supabase.from("invoice_line_items").select("id,invoice_id"),
        ]);

      if (invoicesRes.error) throw invoicesRes.error;
      if (contactsRes.error) throw contactsRes.error;
      if (companiesRes.error) throw companiesRes.error;
      if (profilesRes.error) throw profilesRes.error;
      if (dealsRes.error) throw dealsRes.error;
      if (quotesRes.error) throw quotesRes.error;
      if (linesRes.error) throw linesRes.error;

      const lineCounts = new Map<string, number>();
      for (const line of (linesRes.data ?? []) as Array<{ invoice_id: string }>) {
        lineCounts.set(line.invoice_id, (lineCounts.get(line.invoice_id) ?? 0) + 1);
      }

      return ((invoicesRes.data ?? []) as InvoiceRow[]).map((invoice) =>
        summarizeInvoice(
          invoice,
          (contactsRes.data ?? []) as ContactRow[],
          (companiesRes.data ?? []) as CompanyRow[],
          (profilesRes.data ?? []) as ProfileRow[],
          (dealsRes.data ?? []) as DealRow[],
          (quotesRes.data ?? []) as InvoiceSummary["quote"][],
          lineCounts,
        ),
      );
    },
  });
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ["invoice", id],
    queryFn: async (): Promise<InvoiceDetail> => {
      const invoiceRes = await supabase.from("invoices").select("*").eq("id", id!).single();
      if (invoiceRes.error) throw invoiceRes.error;
      const invoice = invoiceRes.data as InvoiceRow;

      const [linesRes, contactsRes, companiesRes, profilesRes, dealsRes, quotesRes, historyRes] =
        await Promise.all([
          supabase
            .from("invoice_line_items")
            .select("*")
            .eq("invoice_id", id!)
            .order("position", { ascending: true }),
          supabase.from("contacts").select("*").is("deleted_at", null),
          supabase.from("companies").select("*").is("deleted_at", null),
          supabase.from("profiles").select("*"),
          supabase.from("deals").select("*").is("deleted_at", null),
          supabase.from("quotes").select("id,quote_number,title").is("deleted_at", null),
          supabase
            .from("invoice_status_history")
            .select("*")
            .eq("invoice_id", id!)
            .order("changed_at", { ascending: false }),
        ]);

      if (linesRes.error) throw linesRes.error;
      if (contactsRes.error) throw contactsRes.error;
      if (companiesRes.error) throw companiesRes.error;
      if (profilesRes.error) throw profilesRes.error;
      if (dealsRes.error) throw dealsRes.error;
      if (quotesRes.error) throw quotesRes.error;
      if (historyRes.error) throw historyRes.error;

      const lines = (linesRes.data ?? []) as InvoiceLineItemRow[];

      return {
        ...summarizeInvoice(
          invoice,
          (contactsRes.data ?? []) as ContactRow[],
          (companiesRes.data ?? []) as CompanyRow[],
          (profilesRes.data ?? []) as ProfileRow[],
          (dealsRes.data ?? []) as DealRow[],
          (quotesRes.data ?? []) as InvoiceSummary["quote"][],
          new Map([[invoice.id, lines.length]]),
        ),
        line_items: lines,
        status_history: (historyRes.data ?? []) as InvoiceStatusHistoryRow[],
      };
    },
  });
}

/** Invoices raised against one quotation — used by the quote detail page. */
export function useInvoicesForQuote(quoteId: string | undefined) {
  return useQuery({
    enabled: !!quoteId,
    queryKey: ["invoices", "quote", quoteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id,invoice_number,status,total,currency,issue_date,due_date")
        .eq("quote_id", quoteId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Array<
        Pick<
          InvoiceRow,
          "id" | "invoice_number" | "status" | "total" | "currency" | "issue_date" | "due_date"
        >
      >;
    },
  });
}

/** Quotations available as an invoice source, newest first. */
export function useInvoiceableQuotes() {
  return useQuery({
    queryKey: ["invoiceable_quotes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select(
          "id,quote_number,title,status,total,currency,contact_id,company_id,deal_id,issue_date",
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Array<
        Pick<
          QuoteRow,
          | "id"
          | "quote_number"
          | "title"
          | "status"
          | "total"
          | "currency"
          | "contact_id"
          | "company_id"
          | "deal_id"
          | "issue_date"
        >
      >;
    },
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateInvoiceInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("invoices")
        .insert({
          title: input.title?.trim() || "Invoice",
          contact_id: input.contact_id || null,
          company_id: input.company_id || null,
          deal_id: input.deal_id || null,
          quote_id: input.quote_id || null,
          assigned_to: input.assigned_to || userData.user?.id || null,
          currency: input.currency,
          issue_date: input.issue_date || new Date().toISOString().slice(0, 10),
          due_date: input.due_date || null,
          discount_type: input.discount_type ?? "none",
          discount_value: input.discount_value ?? 0,
          notes: input.notes?.trim() || null,
          payment_terms: input.payment_terms?.trim() || null,
        } as InvoiceInsert)
        .select("id,invoice_number")
        .single();
      if (error) throw error;
      const invoice = data as Pick<InvoiceRow, "id" | "invoice_number">;

      const lines = (input.lines ?? []).filter((line) => line.name.trim());
      if (lines.length) {
        const { error: lineError } = await supabase.from("invoice_line_items").insert(
          lines.map((line, index) => ({
            invoice_id: invoice.id,
            position: index,
            catalog_item_id: line.catalog_item_id || null,
            name: line.name.trim(),
            description: line.description?.trim() || null,
            unit: line.unit || "unit",
            quantity: line.quantity,
            unit_price: line.unit_price,
            discount_percent: line.discount_percent,
            tax_rate: line.tax_rate,
          })) as InvoiceLineItemInsert[],
        );
        if (lineError) throw lineError;
      }

      return invoice;
    },
    onSuccess: () => invalidateInvoices(qc),
  });
}

/** Clones a quotation into a fresh draft invoice via create_invoice_from_quote(). */
export function useCreateInvoiceFromQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (quoteId: string) => {
      const { data, error } = await supabase.rpc("create_invoice_from_quote", {
        _quote_id: quoteId,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => invalidateInvoices(qc),
  });
}

export function useUpdateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: InvoiceUpdate }) => {
      const { error } = await supabase.from("invoices").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => invalidateInvoices(qc, vars.id),
  });
}

export function useUpdateInvoiceStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: InvoiceStatus }) => {
      const { error } = await supabase.from("invoices").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => invalidateInvoices(qc, vars.id),
  });
}

/** Same replace-in-one-pass strategy as the quote editor. Totals land server-side. */
export function useSaveInvoiceLineItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      invoiceId,
      lines,
    }: {
      invoiceId: string;
      lines: InvoiceLineItemDraft[];
    }) => {
      const existingRes = await supabase
        .from("invoice_line_items")
        .select("id")
        .eq("invoice_id", invoiceId);
      if (existingRes.error) throw existingRes.error;

      const keptIds = new Set(lines.map((line) => line.id).filter(Boolean) as string[]);
      const removed = ((existingRes.data ?? []) as Array<{ id: string }>)
        .map((row) => row.id)
        .filter((id) => !keptIds.has(id));

      if (removed.length) {
        const { error } = await supabase.from("invoice_line_items").delete().in("id", removed);
        if (error) throw error;
      }

      for (const [index, line] of lines.entries()) {
        const payload = {
          invoice_id: invoiceId,
          position: index,
          catalog_item_id: line.catalog_item_id || null,
          name: line.name.trim(),
          description: line.description?.trim() || null,
          unit: line.unit || "unit",
          quantity: line.quantity,
          unit_price: line.unit_price,
          discount_percent: line.discount_percent,
          tax_rate: line.tax_rate,
        } satisfies InvoiceLineItemInsert;

        if (line.id) {
          const { error } = await supabase
            .from("invoice_line_items")
            .update(payload)
            .eq("id", line.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("invoice_line_items").insert(payload);
          if (error) throw error;
        }
      }
    },
    onSuccess: (_data, vars) => invalidateInvoices(qc, vars.invoiceId),
  });
}

export function useDeleteInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const { error } = await supabase
        .from("invoices")
        .update({ deleted_at: new Date().toISOString() } satisfies InvoiceUpdate)
        .eq("id", invoiceId);
      if (error) throw error;
    },
    onSuccess: (_data, invoiceId) => invalidateInvoices(qc, invoiceId),
  });
}

// ── helpers ───────────────────────────────────────────────────────────────────

function invalidateInvoices(qc: ReturnType<typeof useQueryClient>, invoiceId?: string) {
  qc.invalidateQueries({ queryKey: invoicesKey });
  if (invoiceId) qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
}

function summarizeInvoice(
  invoice: InvoiceRow,
  contacts: ContactRow[],
  companies: CompanyRow[],
  profiles: ProfileRow[],
  deals: DealRow[],
  quotes: InvoiceSummary["quote"][],
  lineCounts: Map<string, number>,
): InvoiceSummary {
  return {
    ...invoice,
    contact: contacts.find((contact) => contact.id === invoice.contact_id) ?? null,
    company: companies.find((company) => company.id === invoice.company_id) ?? null,
    deal: deals.find((deal) => deal.id === invoice.deal_id) ?? null,
    quote: quotes.find((quote) => quote?.id === invoice.quote_id) ?? null,
    assigned_rep: profiles.find((profile) => profile.id === invoice.assigned_to) ?? null,
    line_count: lineCounts.get(invoice.id) ?? 0,
  };
}

export function invoiceClientName(invoice: {
  contact?: ContactRow | null;
  company?: CompanyRow | null;
}): string {
  if (invoice.company?.name) return invoice.company.name;
  if (invoice.contact) return `${invoice.contact.first_name} ${invoice.contact.last_name}`.trim();
  return "No customer";
}

/** A sent/partially-paid invoice past its due date reads as overdue. */
export function isInvoiceOverdue(
  status: string,
  dueDate: string | null,
  amountPaid: number | string | null = 0,
  total: number | string | null = 0,
): boolean {
  if (status === "overdue") return true;
  if (status !== "sent" && status !== "partially_paid") return false;
  if (!dueDate) return false;
  if (Number(amountPaid ?? 0) >= Number(total ?? 0) && Number(total ?? 0) > 0) return false;
  return dueDate < new Date().toISOString().slice(0, 10);
}

export function effectiveInvoiceStatus(
  status: string,
  dueDate: string | null,
  amountPaid: number | string | null = 0,
  total: number | string | null = 0,
): string {
  return isInvoiceOverdue(status, dueDate, amountPaid, total) ? "overdue" : status;
}

export function invoiceBalance(invoice: Pick<InvoiceRow, "total" | "amount_paid">): number {
  return Number(invoice.total ?? 0) - Number(invoice.amount_paid ?? 0);
}
