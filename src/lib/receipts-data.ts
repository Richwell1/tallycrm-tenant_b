import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { CompanyRow, ContactRow, DealRow, ProfileRow } from "@/lib/quotes-data";
import type { InvoiceRow } from "@/lib/invoices-data";

export type ReceiptRow = Database["public"]["Tables"]["receipts"]["Row"];
export type ReceiptInsert = Database["public"]["Tables"]["receipts"]["Insert"];
export type ReceiptUpdate = Database["public"]["Tables"]["receipts"]["Update"];
export type ReceiptStatus = Database["public"]["Enums"]["receipt_status"];

export type ReceiptInvoice = Pick<
  InvoiceRow,
  | "id"
  | "invoice_number"
  | "title"
  | "status"
  | "total"
  | "amount_paid"
  | "currency"
  | "due_date"
  | "contact_id"
  | "company_id"
  | "deal_id"
  | "quote_id"
  | "assigned_to"
>;

export interface ReceiptSummary extends ReceiptRow {
  invoice?: ReceiptInvoice | null;
  contact?: ContactRow | null;
  company?: CompanyRow | null;
  deal?: DealRow | null;
  assigned_rep?: ProfileRow | null;
  issued_rep?: ProfileRow | null;
}

export type ReceiptDetail = ReceiptSummary;

export interface CreateReceiptInput {
  invoice_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference?: string | null;
  notes?: string | null;
}

export const receiptsKey = ["receipts"] as const;

const INVOICE_SELECT =
  "id,invoice_number,title,status,total,amount_paid,currency,due_date,contact_id,company_id,deal_id,quote_id,assigned_to";

export function useReceipts() {
  return useQuery({
    queryKey: receiptsKey,
    queryFn: async () => {
      const [receiptsRes, invoicesRes, contactsRes, companiesRes, dealsRes, profilesRes] =
        await Promise.all([
          supabase
            .from("receipts")
            .select("*")
            .is("deleted_at", null)
            .order("payment_date", { ascending: false })
            .order("created_at", { ascending: false }),
          supabase.from("invoices").select(INVOICE_SELECT).is("deleted_at", null),
          supabase.from("contacts").select("*").is("deleted_at", null),
          supabase.from("companies").select("*").is("deleted_at", null),
          supabase.from("deals").select("*").is("deleted_at", null),
          supabase.from("profiles").select("*"),
        ]);

      if (receiptsRes.error) throw receiptsRes.error;
      if (invoicesRes.error) throw invoicesRes.error;
      if (contactsRes.error) throw contactsRes.error;
      if (companiesRes.error) throw companiesRes.error;
      if (dealsRes.error) throw dealsRes.error;
      if (profilesRes.error) throw profilesRes.error;

      return ((receiptsRes.data ?? []) as ReceiptRow[]).map((receipt) =>
        summarizeReceipt(
          receipt,
          (invoicesRes.data ?? []) as ReceiptInvoice[],
          (contactsRes.data ?? []) as ContactRow[],
          (companiesRes.data ?? []) as CompanyRow[],
          (dealsRes.data ?? []) as DealRow[],
          (profilesRes.data ?? []) as ProfileRow[],
        ),
      );
    },
  });
}

export function useReceipt(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ["receipt", id],
    queryFn: async (): Promise<ReceiptDetail> => {
      const receiptRes = await supabase.from("receipts").select("*").eq("id", id!).single();
      if (receiptRes.error) throw receiptRes.error;

      const receipt = receiptRes.data as ReceiptRow;
      const [invoicesRes, contactsRes, companiesRes, dealsRes, profilesRes] = await Promise.all([
        supabase.from("invoices").select(INVOICE_SELECT).is("deleted_at", null),
        supabase.from("contacts").select("*").is("deleted_at", null),
        supabase.from("companies").select("*").is("deleted_at", null),
        supabase.from("deals").select("*").is("deleted_at", null),
        supabase.from("profiles").select("*"),
      ]);

      if (invoicesRes.error) throw invoicesRes.error;
      if (contactsRes.error) throw contactsRes.error;
      if (companiesRes.error) throw companiesRes.error;
      if (dealsRes.error) throw dealsRes.error;
      if (profilesRes.error) throw profilesRes.error;

      return summarizeReceipt(
        receipt,
        (invoicesRes.data ?? []) as ReceiptInvoice[],
        (contactsRes.data ?? []) as ContactRow[],
        (companiesRes.data ?? []) as CompanyRow[],
        (dealsRes.data ?? []) as DealRow[],
        (profilesRes.data ?? []) as ProfileRow[],
      );
    },
  });
}

export function useReceiptsForInvoice(invoiceId: string | undefined) {
  return useQuery({
    enabled: !!invoiceId,
    queryKey: ["receipts", "invoice", invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receipts")
        .select("*")
        .eq("invoice_id", invoiceId!)
        .is("deleted_at", null)
        .order("payment_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ReceiptRow[];
    },
  });
}

export function useReceiptableInvoices() {
  return useQuery({
    queryKey: ["receiptable_invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(INVOICE_SELECT)
        .is("deleted_at", null)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ReceiptInvoice[];
    },
  });
}

export function useCreateReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateReceiptInput) => {
      const { data, error } = await supabase
        .from("receipts")
        .insert({
          invoice_id: input.invoice_id,
          amount: input.amount,
          payment_date: input.payment_date,
          payment_method: input.payment_method.trim() || "Cash",
          reference: input.reference?.trim() || null,
          notes: input.notes?.trim() || null,
        } as ReceiptInsert)
        .select("id,receipt_number,invoice_id")
        .single();
      if (error) throw error;
      return data as Pick<ReceiptRow, "id" | "receipt_number" | "invoice_id">;
    },
    onSuccess: (receipt) => invalidateReceipts(qc, receipt.id, receipt.invoice_id),
  });
}

export function useUpdateReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: ReceiptUpdate }) => {
      const { data, error } = await supabase
        .from("receipts")
        .update(patch)
        .eq("id", id)
        .select("invoice_id")
        .single();
      if (error) throw error;
      return data as Pick<ReceiptRow, "invoice_id">;
    },
    onSuccess: (receipt, vars) => invalidateReceipts(qc, vars.id, receipt.invoice_id),
  });
}

export function useVoidReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("receipts")
        .update({ status: "void" } satisfies ReceiptUpdate)
        .eq("id", id)
        .select("invoice_id")
        .single();
      if (error) throw error;
      return data as Pick<ReceiptRow, "invoice_id">;
    },
    onSuccess: (receipt, id) => invalidateReceipts(qc, id, receipt.invoice_id),
  });
}

export function useDeleteReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("receipts")
        .update({ deleted_at: new Date().toISOString() } satisfies ReceiptUpdate)
        .eq("id", id)
        .select("invoice_id")
        .single();
      if (error) throw error;
      return data as Pick<ReceiptRow, "invoice_id">;
    },
    onSuccess: (receipt, id) => invalidateReceipts(qc, id, receipt.invoice_id),
  });
}

function invalidateReceipts(
  qc: ReturnType<typeof useQueryClient>,
  receiptId?: string,
  invoiceId?: string,
) {
  qc.invalidateQueries({ queryKey: receiptsKey });
  qc.invalidateQueries({ queryKey: ["receiptable_invoices"] });
  if (receiptId) qc.invalidateQueries({ queryKey: ["receipt", receiptId] });
  if (invoiceId) {
    qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
    qc.invalidateQueries({ queryKey: ["receipts", "invoice", invoiceId] });
  }
  qc.invalidateQueries({ queryKey: ["invoices"] });
}

function summarizeReceipt(
  receipt: ReceiptRow,
  invoices: ReceiptInvoice[],
  contacts: ContactRow[],
  companies: CompanyRow[],
  deals: DealRow[],
  profiles: ProfileRow[],
): ReceiptSummary {
  const invoice = invoices.find((item) => item.id === receipt.invoice_id) ?? null;
  return {
    ...receipt,
    invoice,
    contact:
      contacts.find((contact) => contact.id === receipt.contact_id) ??
      contacts.find((contact) => contact.id === invoice?.contact_id) ??
      null,
    company:
      companies.find((company) => company.id === receipt.company_id) ??
      companies.find((company) => company.id === invoice?.company_id) ??
      null,
    deal:
      deals.find((deal) => deal.id === receipt.deal_id) ??
      deals.find((deal) => deal.id === invoice?.deal_id) ??
      null,
    assigned_rep:
      profiles.find((profile) => profile.id === receipt.assigned_to) ??
      profiles.find((profile) => profile.id === invoice?.assigned_to) ??
      null,
    issued_rep: profiles.find((profile) => profile.id === receipt.issued_by) ?? null,
  };
}

export function receiptClientName(receipt: {
  contact?: ContactRow | null;
  company?: CompanyRow | null;
}): string {
  if (receipt.company?.name) return receipt.company.name;
  if (receipt.contact) return `${receipt.contact.first_name} ${receipt.contact.last_name}`.trim();
  return "No customer";
}
