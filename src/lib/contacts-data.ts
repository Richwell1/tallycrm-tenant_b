import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];
export type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];
export type DealRow = Database["public"]["Tables"]["deals"]["Row"];
export type ActivityRow = Database["public"]["Tables"]["activities"]["Row"];
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type PipelineStageRow = Database["public"]["Tables"]["pipeline_stages"]["Row"];

export interface ContactSummary extends ContactRow {
  company?: CompanyRow | null;
  assigned_rep?: ProfileRow | null;
  deal_count: number;
  open_deal_count: number;
  won_value: number;
  last_activity_at: string | null;
}

export interface ContactDetail extends ContactSummary {
  deals: Array<DealRow & { stage?: PipelineStageRow | null }>;
  activities: ActivityRow[];
}

export interface CreateContactInput {
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  job_title?: string | null;
  company_id?: string | null;
  assigned_to?: string | null;
  tags?: string[] | null;
  notes?: string | null;
}

export const contactsKey = ["contacts"] as const;

export function useContacts() {
  return useQuery({
    queryKey: contactsKey,
    queryFn: async () => {
      const [contactsRes, companiesRes, dealsRes, activitiesRes, profilesRes] = await Promise.all([
        supabase
          .from("contacts")
          .select("*")
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
        supabase.from("companies").select("*").is("deleted_at", null),
        supabase.from("deals").select("*").is("deleted_at", null),
        supabase.from("activities").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("*"),
      ]);

      if (contactsRes.error) throw contactsRes.error;
      if (companiesRes.error) throw companiesRes.error;
      if (dealsRes.error) throw dealsRes.error;
      if (activitiesRes.error) throw activitiesRes.error;
      if (profilesRes.error) throw profilesRes.error;

      return ((contactsRes.data ?? []) as ContactRow[]).map((contact) =>
        summarizeContact(
          contact,
          (companiesRes.data ?? []) as CompanyRow[],
          (dealsRes.data ?? []) as DealRow[],
          (activitiesRes.data ?? []) as ActivityRow[],
          (profilesRes.data ?? []) as ProfileRow[],
        ),
      );
    },
  });
}

export function useContact(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ["contact", id],
    queryFn: async () => {
      const [contactRes, companiesRes, dealsRes, activitiesRes, profilesRes, stagesRes] =
        await Promise.all([
          supabase.from("contacts").select("*").eq("id", id!).single(),
          supabase.from("companies").select("*").is("deleted_at", null),
          supabase.from("deals").select("*").is("deleted_at", null),
          supabase
            .from("activities")
            .select("*")
            .eq("contact_id", id!)
            .order("created_at", { ascending: false }),
          supabase.from("profiles").select("*"),
          supabase.from("pipeline_stages").select("*").order("position"),
        ]);

      if (contactRes.error) throw contactRes.error;
      if (companiesRes.error) throw companiesRes.error;
      if (dealsRes.error) throw dealsRes.error;
      if (activitiesRes.error) throw activitiesRes.error;
      if (profilesRes.error) throw profilesRes.error;
      if (stagesRes.error) throw stagesRes.error;

      const contact = contactRes.data as ContactRow;
      const companies = (companiesRes.data ?? []) as CompanyRow[];
      const deals = (dealsRes.data ?? []) as DealRow[];
      const activities = (activitiesRes.data ?? []) as ActivityRow[];
      const profiles = (profilesRes.data ?? []) as ProfileRow[];
      const stages = (stagesRes.data ?? []) as PipelineStageRow[];
      const stageMap = new Map(stages.map((stage) => [stage.id, stage]));
      const summary = summarizeContact(contact, companies, deals, activities, profiles);
      const contactDeals = deals.filter(
        (deal) => deal.primary_contact_id === contact.id || deal.company_id === contact.company_id,
      );

      return {
        ...summary,
        deals: contactDeals.map((deal) => ({
          ...deal,
          stage: stageMap.get(deal.stage_id) ?? null,
        })),
        activities,
      } satisfies ContactDetail;
    },
  });
}

export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateContactInput) => {
      const { data, error } = await supabase
        .from("contacts")
        .insert({
          ...input,
          tags: input.tags?.filter(Boolean) ?? null,
          source: "Manual Entry",
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contactsKey });
      qc.invalidateQueries({ queryKey: ["companies"] });
    },
  });
}

export function useContactFormOptions() {
  return useQuery({
    queryKey: ["contact_form_options"],
    queryFn: async () => {
      const [companiesRes, profilesRes] = await Promise.all([
        supabase.from("companies").select("*").is("deleted_at", null).order("name"),
        supabase.from("profiles").select("*").eq("status", "active").order("full_name"),
      ]);
      if (companiesRes.error) throw companiesRes.error;
      if (profilesRes.error) throw profilesRes.error;
      return {
        companies: (companiesRes.data ?? []) as CompanyRow[],
        profiles: (profilesRes.data ?? []) as ProfileRow[],
      };
    },
  });
}

function summarizeContact(
  contact: ContactRow,
  companies: CompanyRow[],
  deals: DealRow[],
  activities: ActivityRow[],
  profiles: ProfileRow[],
): ContactSummary {
  const company = companies.find((item) => item.id === contact.company_id) ?? null;
  const contactDeals = deals.filter(
    (deal) => deal.primary_contact_id === contact.id || deal.company_id === contact.company_id,
  );
  const openDeals = contactDeals.filter((deal) => !deal.actual_close_date && !deal.lost_reason);
  const wonValue = contactDeals
    .filter((deal) => deal.actual_close_date && !deal.lost_reason)
    .reduce((sum, deal) => sum + Number(deal.actual_value ?? deal.value ?? 0), 0);
  const contactActivities = activities.filter((activity) => activity.contact_id === contact.id);

  return {
    ...contact,
    company,
    assigned_rep: profiles.find((profile) => profile.id === contact.assigned_to) ?? null,
    deal_count: contactDeals.length,
    open_deal_count: openDeals.length,
    won_value: wonValue,
    last_activity_at: contactActivities[0]?.created_at ?? null,
  };
}
