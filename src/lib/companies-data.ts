import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];
export type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];
export type DealRow = Database["public"]["Tables"]["deals"]["Row"];
export type ActivityRow = Database["public"]["Tables"]["activities"]["Row"];
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type PipelineStageRow = Database["public"]["Tables"]["pipeline_stages"]["Row"];

export interface CompanySummary extends CompanyRow {
  contact_count: number;
  deal_count: number;
  open_deal_count: number;
  open_deal_value: number;
  account_manager?: ProfileRow | null;
  tags: string[];
}

export interface CompanyDetail extends CompanySummary {
  contacts: ContactRow[];
  deals: Array<DealRow & { stage?: PipelineStageRow | null }>;
  activities: ActivityRow[];
}

export interface CreateCompanyInput {
  name: string;
  industry?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  linkedin?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  account_manager_id?: string | null;
  notes?: string | null;
  rating?: number | null;
}

export const companiesKey = ["companies"] as const;

export function useCompanies() {
  return useQuery({
    queryKey: companiesKey,
    queryFn: async () => {
      const [companiesRes, contactsRes, dealsRes, profilesRes] = await Promise.all([
        supabase.from("companies").select("*").is("deleted_at", null).order("name"),
        supabase.from("contacts").select("*").is("deleted_at", null),
        supabase.from("deals").select("*").is("deleted_at", null),
        supabase.from("profiles").select("*"),
      ]);

      if (companiesRes.error) throw companiesRes.error;
      if (contactsRes.error) throw contactsRes.error;
      if (dealsRes.error) throw dealsRes.error;
      if (profilesRes.error) throw profilesRes.error;

      const contacts = (contactsRes.data ?? []) as ContactRow[];
      const deals = (dealsRes.data ?? []) as DealRow[];
      const profiles = (profilesRes.data ?? []) as ProfileRow[];

      return ((companiesRes.data ?? []) as CompanyRow[]).map((company) =>
        summarizeCompany(company, contacts, deals, profiles),
      );
    },
  });
}

export function useCompany(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ["company", id],
    queryFn: async () => {
      const [companyRes, contactsRes, dealsRes, profilesRes, stagesRes] = await Promise.all([
        supabase.from("companies").select("*").eq("id", id!).single(),
        supabase
          .from("contacts")
          .select("*")
          .eq("company_id", id!)
          .is("deleted_at", null)
          .order("last_name"),
        supabase
          .from("deals")
          .select("*")
          .eq("company_id", id!)
          .is("deleted_at", null)
          .order("created_at", {
            ascending: false,
          }),
        supabase.from("profiles").select("*"),
        supabase.from("pipeline_stages").select("*").order("position"),
      ]);

      if (companyRes.error) throw companyRes.error;
      if (contactsRes.error) throw contactsRes.error;
      if (dealsRes.error) throw dealsRes.error;
      if (profilesRes.error) throw profilesRes.error;
      if (stagesRes.error) throw stagesRes.error;

      const contacts = (contactsRes.data ?? []) as ContactRow[];
      const deals = (dealsRes.data ?? []) as DealRow[];
      const profiles = (profilesRes.data ?? []) as ProfileRow[];
      const stages = (stagesRes.data ?? []) as PipelineStageRow[];
      const stageMap = new Map(stages.map((stage) => [stage.id, stage]));
      const summary = summarizeCompany(companyRes.data as CompanyRow, contacts, deals, profiles);

      let activities: ActivityRow[] = [];
      const contactIds = contacts.map((contact) => contact.id);
      if (contactIds.length > 0) {
        const activitiesRes = await supabase
          .from("activities")
          .select("*")
          .in("contact_id", contactIds)
          .order("created_at", { ascending: false })
          .limit(50);
        if (activitiesRes.error) throw activitiesRes.error;
        activities = (activitiesRes.data ?? []) as ActivityRow[];
      }

      return {
        ...summary,
        contacts,
        deals: deals.map((deal) => ({ ...deal, stage: stageMap.get(deal.stage_id) ?? null })),
        activities,
      } satisfies CompanyDetail;
    },
  });
}

export function useCreateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCompanyInput) => {
      const { data, error } = await supabase
        .from("companies")
        .insert({
          ...input,
          rating: input.rating ?? 4,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: companiesKey });
      qc.invalidateQueries({ queryKey: ["companies_lite"] });
    },
  });
}

export interface UpdateCompanyInput extends Partial<CreateCompanyInput> {
  id: string;
  logo_url?: string | null;
}

export function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateCompanyInput) => {
      const { error } = await supabase
        .from("companies")
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: companiesKey });
      qc.invalidateQueries({ queryKey: ["company", id] });
    },
  });
}

export function useDeleteCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("companies")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: companiesKey });
    },
  });
}

export function useCompanyManagers() {
  return useQuery({
    queryKey: ["company_managers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return data as ProfileRow[];
    },
  });
}

function summarizeCompany(
  company: CompanyRow,
  contacts: ContactRow[],
  deals: DealRow[],
  profiles: ProfileRow[],
): CompanySummary {
  const companyContacts = contacts.filter((contact) => contact.company_id === company.id);
  const companyDeals = deals.filter((deal) => deal.company_id === company.id);
  const openDeals = companyDeals.filter((deal) => !deal.actual_close_date && !deal.lost_reason);
  const contactTags = new Set(companyContacts.flatMap((contact) => contact.tags ?? []));

  return {
    ...company,
    contact_count: companyContacts.length,
    deal_count: companyDeals.length,
    open_deal_count: openDeals.length,
    open_deal_value: openDeals.reduce((sum, deal) => sum + Number(deal.value ?? 0), 0),
    account_manager: profiles.find((profile) => profile.id === company.account_manager_id) ?? null,
    tags: [...contactTags].slice(0, 3),
  };
}
