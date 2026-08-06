import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { QuoteDiscountType } from "@/lib/quote-totals";

export type QuoteRow = Database["public"]["Tables"]["quotes"]["Row"];
export type QuoteInsert = Database["public"]["Tables"]["quotes"]["Insert"];
export type QuoteUpdate = Database["public"]["Tables"]["quotes"]["Update"];
export type QuoteLineItemRow = Database["public"]["Tables"]["quote_line_items"]["Row"];
export type QuoteLineItemInsert = Database["public"]["Tables"]["quote_line_items"]["Insert"];
export type QuoteCatalogItemRow = Database["public"]["Tables"]["quote_catalog_items"]["Row"];
export type QuoteStatusHistoryRow = Database["public"]["Tables"]["quote_status_history"]["Row"];
export type QuoteStatus = Database["public"]["Enums"]["quote_status"];
export type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];
export type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type DealRow = Database["public"]["Tables"]["deals"]["Row"];
export type PipelineStageRow = Database["public"]["Tables"]["pipeline_stages"]["Row"];

export interface QuoteSummary extends QuoteRow {
  contact?: ContactRow | null;
  company?: CompanyRow | null;
  deal?: DealRow | null;
  assigned_rep?: ProfileRow | null;
  line_count: number;
}

export interface QuoteDetail extends QuoteSummary {
  line_items: QuoteLineItemRow[];
  status_history: QuoteStatusHistoryRow[];
  revisions: Array<Pick<QuoteRow, "id" | "quote_number" | "version" | "status" | "total">>;
}

export interface CreateQuoteInput {
  title: string;
  contact_id?: string | null;
  company_id?: string | null;
  deal_id?: string | null;
  assigned_to?: string | null;
  currency: string;
  issue_date: string;
  valid_until?: string | null;
  discount_type?: QuoteDiscountType;
  discount_value?: number;
  notes?: string | null;
  terms?: string | null;
}

/** Line item as edited in the UI — totals are filled in by the database. */
export interface QuoteLineItemDraft {
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

export const quotesKey = ["quotes"] as const;
export const quoteCatalogKey = ["quote_catalog"] as const;

/** Matches SETTINGS_ROW_ID in settings-data.ts — app_settings is a singleton. */
const APP_SETTINGS_ROW_ID = "00000000-0000-0000-0000-000000000001";

const QUOTE_SELECT = "*";

export function useQuotes() {
  return useQuery({
    queryKey: quotesKey,
    queryFn: async () => {
      const [quotesRes, contactsRes, companiesRes, profilesRes, dealsRes, linesRes] =
        await Promise.all([
          supabase
            .from("quotes")
            .select(QUOTE_SELECT)
            .is("deleted_at", null)
            .order("created_at", { ascending: false }),
          supabase.from("contacts").select("*").is("deleted_at", null),
          supabase.from("companies").select("*").is("deleted_at", null),
          supabase.from("profiles").select("*"),
          supabase.from("deals").select("*").is("deleted_at", null),
          supabase.from("quote_line_items").select("id,quote_id"),
        ]);

      if (quotesRes.error) throw quotesRes.error;
      if (contactsRes.error) throw contactsRes.error;
      if (companiesRes.error) throw companiesRes.error;
      if (profilesRes.error) throw profilesRes.error;
      if (dealsRes.error) throw dealsRes.error;
      if (linesRes.error) throw linesRes.error;

      const contacts = (contactsRes.data ?? []) as ContactRow[];
      const companies = (companiesRes.data ?? []) as CompanyRow[];
      const profiles = (profilesRes.data ?? []) as ProfileRow[];
      const deals = (dealsRes.data ?? []) as DealRow[];
      const lineCounts = new Map<string, number>();
      for (const line of (linesRes.data ?? []) as Array<{ quote_id: string }>) {
        lineCounts.set(line.quote_id, (lineCounts.get(line.quote_id) ?? 0) + 1);
      }

      return ((quotesRes.data ?? []) as QuoteRow[]).map((quote) =>
        summarizeQuote(quote, contacts, companies, profiles, deals, lineCounts),
      );
    },
  });
}

/** Quotes attached to one deal — used by the deal detail page. */
export function useQuotesForDeal(dealId: string | undefined) {
  return useQuery({
    enabled: !!dealId,
    queryKey: ["quotes", "deal", dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select(QUOTE_SELECT)
        .eq("deal_id", dealId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as QuoteRow[];
    },
  });
}

export function useQuote(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ["quote", id],
    queryFn: async (): Promise<QuoteDetail> => {
      const quoteRes = await supabase.from("quotes").select(QUOTE_SELECT).eq("id", id!).single();
      if (quoteRes.error) throw quoteRes.error;
      const quote = quoteRes.data as QuoteRow;
      const rootId = quote.root_quote_id ?? quote.id;

      const [linesRes, contactsRes, companiesRes, profilesRes, dealsRes, historyRes, revisionsRes] =
        await Promise.all([
          supabase
            .from("quote_line_items")
            .select("*")
            .eq("quote_id", id!)
            .order("position", { ascending: true }),
          supabase.from("contacts").select("*").is("deleted_at", null),
          supabase.from("companies").select("*").is("deleted_at", null),
          supabase.from("profiles").select("*"),
          supabase.from("deals").select("*").is("deleted_at", null),
          supabase
            .from("quote_status_history")
            .select("*")
            .eq("quote_id", id!)
            .order("changed_at", { ascending: false }),
          supabase
            .from("quotes")
            .select("id,quote_number,version,status,total")
            .or(`id.eq.${rootId},root_quote_id.eq.${rootId}`)
            .is("deleted_at", null)
            .order("version", { ascending: true }),
        ]);

      if (linesRes.error) throw linesRes.error;
      if (contactsRes.error) throw contactsRes.error;
      if (companiesRes.error) throw companiesRes.error;
      if (profilesRes.error) throw profilesRes.error;
      if (dealsRes.error) throw dealsRes.error;
      if (historyRes.error) throw historyRes.error;
      if (revisionsRes.error) throw revisionsRes.error;

      const lines = (linesRes.data ?? []) as QuoteLineItemRow[];

      return {
        ...summarizeQuote(
          quote,
          (contactsRes.data ?? []) as ContactRow[],
          (companiesRes.data ?? []) as CompanyRow[],
          (profilesRes.data ?? []) as ProfileRow[],
          (dealsRes.data ?? []) as DealRow[],
          new Map([[quote.id, lines.length]]),
        ),
        line_items: lines,
        status_history: (historyRes.data ?? []) as QuoteStatusHistoryRow[],
        revisions: (revisionsRes.data ?? []) as QuoteDetail["revisions"],
      };
    },
  });
}

export function useQuoteFormOptions() {
  return useQuery({
    queryKey: ["quote_form_options"],
    queryFn: async () => {
      const [contactsRes, companiesRes, profilesRes, dealsRes, catalogRes, settingsRes] =
        await Promise.all([
          supabase.from("contacts").select("*").is("deleted_at", null).order("last_name"),
          supabase.from("companies").select("*").is("deleted_at", null).order("name"),
          supabase.from("profiles").select("*").eq("status", "active").order("full_name"),
          supabase
            .from("deals")
            .select("*")
            .is("deleted_at", null)
            .order("created_at", { ascending: false }),
          supabase
            .from("quote_catalog_items")
            .select("*")
            .is("deleted_at", null)
            .eq("is_active", true)
            .order("name"),
          supabase.from("app_settings").select("*").eq("id", APP_SETTINGS_ROW_ID).maybeSingle(),
        ]);

      if (contactsRes.error) throw contactsRes.error;
      if (companiesRes.error) throw companiesRes.error;
      if (profilesRes.error) throw profilesRes.error;
      if (dealsRes.error) throw dealsRes.error;
      if (catalogRes.error) throw catalogRes.error;

      const settings = settingsRes.error ? null : settingsRes.data;

      return {
        contacts: (contactsRes.data ?? []) as ContactRow[],
        companies: (companiesRes.data ?? []) as CompanyRow[],
        profiles: (profilesRes.data ?? []) as ProfileRow[],
        deals: (dealsRes.data ?? []) as DealRow[],
        catalog: (catalogRes.data ?? []) as QuoteCatalogItemRow[],
        defaults: {
          currency: settings?.default_currency ?? "GHS",
          taxRate: Number(settings?.quote_default_tax_rate ?? 0),
          validityDays: Number(settings?.quote_default_validity_days ?? 30),
          terms: settings?.quote_terms ?? null,
          footerNote: settings?.quote_footer_note ?? null,
          companyName: settings?.company_name ?? null,
          companyAddress: settings?.company_address ?? null,
          companyEmail: settings?.company_email ?? null,
          companyPhone: settings?.company_phone ?? null,
          logoUrl: settings?.logo_url ?? null,
        },
      };
    },
  });
}

export function useCreateQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateQuoteInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("quotes")
        .insert({
          title: input.title,
          contact_id: input.contact_id || null,
          company_id: input.company_id || null,
          deal_id: input.deal_id || null,
          assigned_to: input.assigned_to || userData.user?.id || null,
          currency: input.currency,
          issue_date: input.issue_date,
          valid_until: input.valid_until || null,
          discount_type: input.discount_type ?? "none",
          discount_value: input.discount_value ?? 0,
          notes: input.notes || null,
          terms: input.terms || null,
        } satisfies QuoteInsert)
        .select("id,quote_number")
        .single();
      if (error) throw error;
      return data as Pick<QuoteRow, "id" | "quote_number">;
    },
    onSuccess: () => invalidateQuotes(qc),
  });
}

export function useUpdateQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: QuoteUpdate }) => {
      const { error } = await supabase.from("quotes").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => invalidateQuotes(qc, vars.id),
  });
}

/**
 * Replaces the whole line-item set in one pass: deletes what the editor
 * dropped, updates what it kept, inserts what it added. Every write fires the
 * recalculation trigger, so totals land server-side.
 */
export function useSaveQuoteLineItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ quoteId, lines }: { quoteId: string; lines: QuoteLineItemDraft[] }) => {
      const existingRes = await supabase
        .from("quote_line_items")
        .select("id")
        .eq("quote_id", quoteId);
      if (existingRes.error) throw existingRes.error;

      const keptIds = new Set(lines.map((line) => line.id).filter(Boolean) as string[]);
      const removed = ((existingRes.data ?? []) as Array<{ id: string }>)
        .map((row) => row.id)
        .filter((id) => !keptIds.has(id));

      if (removed.length) {
        const { error } = await supabase.from("quote_line_items").delete().in("id", removed);
        if (error) throw error;
      }

      for (const [index, line] of lines.entries()) {
        const payload = {
          quote_id: quoteId,
          position: index,
          catalog_item_id: line.catalog_item_id || null,
          name: line.name.trim(),
          description: line.description?.trim() || null,
          unit: line.unit || "unit",
          quantity: line.quantity,
          unit_price: line.unit_price,
          discount_percent: line.discount_percent,
          tax_rate: line.tax_rate,
        } satisfies QuoteLineItemInsert;

        if (line.id) {
          const { error } = await supabase
            .from("quote_line_items")
            .update(payload)
            .eq("id", line.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("quote_line_items").insert(payload);
          if (error) throw error;
        }
      }
    },
    onSuccess: (_data, vars) => invalidateQuotes(qc, vars.quoteId),
  });
}

export function useUpdateQuoteStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
      note,
    }: {
      id: string;
      status: QuoteStatus;
      note?: string | null;
    }) => {
      const { error } = await supabase
        .from("quotes")
        .update({ status, decision_note: note || null } satisfies QuoteUpdate)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => invalidateQuotes(qc, vars.id),
  });
}

/** Clones a locked quote into a new draft version via the SQL revise_quote(). */
export function useReviseQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (quoteId: string) => {
      const { data, error } = await supabase.rpc("revise_quote", { _quote_id: quoteId });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => invalidateQuotes(qc),
  });
}

export function useDeleteQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (quoteId: string) => {
      const { error } = await supabase
        .from("quotes")
        .update({ deleted_at: new Date().toISOString() } satisfies QuoteUpdate)
        .eq("id", quoteId);
      if (error) throw error;
    },
    onSuccess: (_data, quoteId) => invalidateQuotes(qc, quoteId),
  });
}

export interface ConvertQuoteInput {
  quoteId: string;
  stageId: string;
  dealName: string;
  expectedCloseDate: string;
}

/**
 * Turns an accepted quote into a pipeline deal and links the two. If the quote
 * already belongs to a deal, that deal's value is refreshed instead of
 * creating a duplicate opportunity.
 */
export function useConvertQuoteToDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ConvertQuoteInput) => {
      const [quoteRes, userRes] = await Promise.all([
        supabase.from("quotes").select("*").eq("id", input.quoteId).single(),
        supabase.auth.getUser(),
      ]);
      if (quoteRes.error) throw quoteRes.error;
      const quote = quoteRes.data as QuoteRow;

      if (quote.converted_deal_id) return { dealId: quote.converted_deal_id, created: false };

      if (quote.deal_id) {
        const { error } = await supabase
          .from("deals")
          .update({ value: Number(quote.total ?? 0), currency: quote.currency })
          .eq("id", quote.deal_id);
        if (error) throw error;

        const link = await supabase
          .from("quotes")
          .update({ converted_deal_id: quote.deal_id } satisfies QuoteUpdate)
          .eq("id", quote.id);
        if (link.error) throw link.error;
        return { dealId: quote.deal_id, created: false };
      }

      if (!quote.contact_id) {
        throw new Error("Add a client contact to the quote before converting it to a deal");
      }

      const dealRes = await supabase
        .from("deals")
        .insert({
          name: input.dealName,
          primary_contact_id: quote.contact_id,
          company_id: quote.company_id,
          value: Number(quote.total ?? 0),
          currency: quote.currency,
          stage_id: input.stageId,
          expected_close_date: input.expectedCloseDate,
          assigned_to: quote.assigned_to ?? userRes.data.user?.id ?? null,
          description: `Created from quote ${quote.quote_number}`,
        })
        .select("id")
        .single();
      if (dealRes.error) throw dealRes.error;
      const dealId = (dealRes.data as { id: string }).id;

      const link = await supabase
        .from("quotes")
        .update({ deal_id: dealId, converted_deal_id: dealId } satisfies QuoteUpdate)
        .eq("id", quote.id);
      if (link.error) throw link.error;

      await supabase.from("deal_value_history").insert({
        deal_id: dealId,
        old_value: 0,
        new_value: Number(quote.total ?? 0),
        reason: `Accepted quote ${quote.quote_number}`,
        changed_by: userRes.data.user?.id ?? null,
      });

      return { dealId, created: true };
    },
    onSuccess: (_data, vars) => {
      invalidateQuotes(qc, vars.quoteId);
      qc.invalidateQueries({ queryKey: ["deals"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

// ── Catalog ───────────────────────────────────────────────────────────────────

export function useQuoteCatalog() {
  return useQuery({
    queryKey: quoteCatalogKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quote_catalog_items")
        .select("*")
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return (data ?? []) as QuoteCatalogItemRow[];
    },
  });
}

export interface CatalogItemInput {
  id?: string;
  name: string;
  description?: string | null;
  unit: string;
  unit_price: number;
  currency: string;
  tax_rate: number;
  category?: string | null;
  is_active: boolean;
}

export function useSaveCatalogItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CatalogItemInput) => {
      const payload = {
        name: input.name.trim(),
        description: input.description?.trim() || null,
        unit: input.unit || "unit",
        unit_price: input.unit_price,
        currency: input.currency,
        tax_rate: input.tax_rate,
        category: input.category?.trim() || null,
        is_active: input.is_active,
      };
      if (input.id) {
        const { error } = await supabase
          .from("quote_catalog_items")
          .update(payload)
          .eq("id", input.id);
        if (error) throw error;
        return input.id;
      }
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("quote_catalog_items")
        .insert({ ...payload, created_by: userData.user?.id ?? null })
        .select("id")
        .single();
      if (error) throw error;
      return (data as { id: string }).id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: quoteCatalogKey });
      qc.invalidateQueries({ queryKey: ["quote_form_options"] });
    },
  });
}

export function useDeleteCatalogItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("quote_catalog_items")
        .update({ deleted_at: new Date().toISOString(), is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: quoteCatalogKey });
      qc.invalidateQueries({ queryKey: ["quote_form_options"] });
    },
  });
}

// ── helpers ───────────────────────────────────────────────────────────────────

function invalidateQuotes(qc: ReturnType<typeof useQueryClient>, quoteId?: string) {
  qc.invalidateQueries({ queryKey: quotesKey });
  if (quoteId) qc.invalidateQueries({ queryKey: ["quote", quoteId] });
}

function summarizeQuote(
  quote: QuoteRow,
  contacts: ContactRow[],
  companies: CompanyRow[],
  profiles: ProfileRow[],
  deals: DealRow[],
  lineCounts: Map<string, number>,
): QuoteSummary {
  return {
    ...quote,
    contact: contacts.find((contact) => contact.id === quote.contact_id) ?? null,
    company: companies.find((company) => company.id === quote.company_id) ?? null,
    deal: deals.find((deal) => deal.id === quote.deal_id) ?? null,
    assigned_rep: profiles.find((profile) => profile.id === quote.assigned_to) ?? null,
    line_count: lineCounts.get(quote.id) ?? 0,
  };
}

export function quoteClientName(quote: {
  contact?: ContactRow | null;
  company?: CompanyRow | null;
}): string {
  if (quote.company?.name) return quote.company.name;
  if (quote.contact) return `${quote.contact.first_name} ${quote.contact.last_name}`.trim();
  return "No client";
}
