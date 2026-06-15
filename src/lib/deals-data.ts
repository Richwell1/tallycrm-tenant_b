import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type DealRow = Database["public"]["Tables"]["deals"]["Row"];
export type DealInsert = Database["public"]["Tables"]["deals"]["Insert"];
export type DealUpdate = Database["public"]["Tables"]["deals"]["Update"];
export type PipelineStageRow = Database["public"]["Tables"]["pipeline_stages"]["Row"];
export type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];
export type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type ActivityRow = Database["public"]["Tables"]["activities"]["Row"];
export type DealStageHistoryRow = Database["public"]["Tables"]["deal_stage_history"]["Row"];
export type DealValueHistoryRow = Database["public"]["Tables"]["deal_value_history"]["Row"];
export type LossReasonRow = Database["public"]["Tables"]["loss_reasons"]["Row"];

export interface DealSummary extends DealRow {
  stage?: PipelineStageRow | null;
  primary_contact?: ContactRow | null;
  company?: CompanyRow | null;
  assigned_rep?: ProfileRow | null;
  last_activity_at?: string | null;
}

export interface DealDetail extends DealSummary {
  contacts: ContactRow[];
  activities: ActivityRow[];
  stage_history: Array<
    DealStageHistoryRow & {
      from?: PipelineStageRow | null;
      to?: PipelineStageRow | null;
    }
  >;
  value_history: DealValueHistoryRow[];
}

export interface CreateDealInput {
  name: string;
  primary_contact_id: string;
  company_id?: string | null;
  value: number;
  currency: string;
  stage_id: string;
  probability?: number | null;
  expected_close_date: string;
  assigned_to?: string | null;
  description?: string | null;
  tags?: string[];
}

export interface CloseDealInput {
  dealId: string;
  mode: "won" | "lost";
  stageId: string;
  actualValue?: number | null;
  actualCloseDate?: string | null;
  note?: string | null;
  lostReason?: string | null;
}

export const dealsKey = ["deals"] as const;

export function useDealsBoard() {
  return useQuery({
    queryKey: dealsKey,
    queryFn: async () => {
      const [dealsRes, stagesRes, contactsRes, companiesRes, profilesRes, activitiesRes] =
        await Promise.all([
          supabase
            .from("deals")
            .select("*")
            .is("deleted_at", null)
            .order("created_at", { ascending: false }),
          supabase.from("pipeline_stages").select("*").order("position"),
          supabase.from("contacts").select("*").is("deleted_at", null),
          supabase.from("companies").select("*").is("deleted_at", null),
          supabase.from("profiles").select("*"),
          supabase.from("activities").select("*").order("created_at", { ascending: false }),
        ]);

      if (dealsRes.error) throw dealsRes.error;
      if (stagesRes.error) throw stagesRes.error;
      if (contactsRes.error) throw contactsRes.error;
      if (companiesRes.error) throw companiesRes.error;
      if (profilesRes.error) throw profilesRes.error;
      if (activitiesRes.error) throw activitiesRes.error;

      const stages = (stagesRes.data ?? []) as PipelineStageRow[];
      const contacts = (contactsRes.data ?? []) as ContactRow[];
      const companies = (companiesRes.data ?? []) as CompanyRow[];
      const profiles = (profilesRes.data ?? []) as ProfileRow[];
      const activities = (activitiesRes.data ?? []) as ActivityRow[];
      const deals = ((dealsRes.data ?? []) as DealRow[]).map((deal) =>
        summarizeDeal(deal, stages, contacts, companies, profiles, activities),
      );

      return { deals, stages };
    },
  });
}

export function useDeal(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ["deal", id],
    queryFn: async () => {
      const [
        dealRes,
        stagesRes,
        contactsRes,
        companiesRes,
        profilesRes,
        activitiesRes,
        stageHistoryRes,
        valueHistoryRes,
      ] = await Promise.all([
        supabase.from("deals").select("*").eq("id", id!).single(),
        supabase.from("pipeline_stages").select("*").order("position"),
        supabase.from("contacts").select("*").is("deleted_at", null),
        supabase.from("companies").select("*").is("deleted_at", null),
        supabase.from("profiles").select("*"),
        supabase
          .from("activities")
          .select("*")
          .eq("deal_id", id!)
          .order("created_at", { ascending: false }),
        supabase
          .from("deal_stage_history")
          .select("*")
          .eq("deal_id", id!)
          .order("changed_at", { ascending: false }),
        supabase
          .from("deal_value_history")
          .select("*")
          .eq("deal_id", id!)
          .order("changed_at", { ascending: false }),
      ]);

      if (dealRes.error) throw dealRes.error;
      if (stagesRes.error) throw stagesRes.error;
      if (contactsRes.error) throw contactsRes.error;
      if (companiesRes.error) throw companiesRes.error;
      if (profilesRes.error) throw profilesRes.error;
      if (activitiesRes.error) throw activitiesRes.error;
      if (stageHistoryRes.error) throw stageHistoryRes.error;
      if (valueHistoryRes.error) throw valueHistoryRes.error;

      const deal = dealRes.data as DealRow;
      const stages = (stagesRes.data ?? []) as PipelineStageRow[];
      const contacts = (contactsRes.data ?? []) as ContactRow[];
      const companies = (companiesRes.data ?? []) as CompanyRow[];
      const profiles = (profilesRes.data ?? []) as ProfileRow[];
      const activities = (activitiesRes.data ?? []) as ActivityRow[];
      const stageMap = new Map(stages.map((stage) => [stage.id, stage]));
      const companyContacts = contacts.filter(
        (contact) => contact.company_id && contact.company_id === deal.company_id,
      );
      const primary = contacts.find((contact) => contact.id === deal.primary_contact_id);

      return {
        ...summarizeDeal(deal, stages, contacts, companies, profiles, activities),
        contacts: uniqueById([primary, ...companyContacts].filter(Boolean) as ContactRow[]),
        activities,
        stage_history: ((stageHistoryRes.data ?? []) as DealStageHistoryRow[]).map((history) => ({
          ...history,
          from: history.from_stage ? (stageMap.get(history.from_stage) ?? null) : null,
          to: history.to_stage ? (stageMap.get(history.to_stage) ?? null) : null,
        })),
        value_history: (valueHistoryRes.data ?? []) as DealValueHistoryRow[],
      } satisfies DealDetail;
    },
  });
}

export function useDealFormOptions() {
  return useQuery({
    queryKey: ["deal_form_options"],
    queryFn: async () => {
      const [stagesRes, contactsRes, companiesRes, profilesRes, lossReasonsRes] = await Promise.all(
        [
          supabase.from("pipeline_stages").select("*").order("position"),
          supabase.from("contacts").select("*").is("deleted_at", null).order("last_name"),
          supabase.from("companies").select("*").is("deleted_at", null).order("name"),
          supabase.from("profiles").select("*").eq("status", "active").order("full_name"),
          supabase.from("loss_reasons").select("*").order("position"),
        ],
      );
      if (stagesRes.error) throw stagesRes.error;
      if (contactsRes.error) throw contactsRes.error;
      if (companiesRes.error) throw companiesRes.error;
      if (profilesRes.error) throw profilesRes.error;
      if (lossReasonsRes.error) throw lossReasonsRes.error;
      return {
        stages: (stagesRes.data ?? []) as PipelineStageRow[],
        contacts: (contactsRes.data ?? []) as ContactRow[],
        companies: (companiesRes.data ?? []) as CompanyRow[],
        profiles: (profilesRes.data ?? []) as ProfileRow[],
        lossReasons: (lossReasonsRes.data ?? []) as LossReasonRow[],
      };
    },
  });
}

export function useCreateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateDealInput) => {
      const { data, error } = await supabase
        .from("deals")
        .insert({
          name: input.name,
          primary_contact_id: input.primary_contact_id,
          company_id: input.company_id || null,
          value: input.value,
          currency: input.currency,
          stage_id: input.stage_id,
          probability: input.probability ?? undefined,
          expected_close_date: input.expected_close_date,
          assigned_to: input.assigned_to || null,
          description: input.description || null,
          tags: input.tags?.filter(Boolean) ?? null,
        } satisfies DealInsert)
        .select("id")
        .single();
      if (error) throw error;

      const { data: userData } = await supabase.auth.getUser();
      await supabase.from("deal_value_history").insert({
        deal_id: data.id,
        old_value: 0,
        new_value: input.value,
        reason: "Initial deal value",
        changed_by: userData.user?.id ?? null,
      });

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: dealsKey });
      qc.invalidateQueries({ queryKey: ["contact"] });
      qc.invalidateQueries({ queryKey: ["company"] });
    },
  });
}

export function useUpdateDealStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, stageId }: { dealId: string; stageId: string }) => {
      const [dealRes, stageRes, userRes] = await Promise.all([
        supabase.from("deals").select("stage_id").eq("id", dealId).single(),
        supabase.from("pipeline_stages").select("*").eq("id", stageId).single(),
        supabase.auth.getUser(),
      ]);
      if (dealRes.error) throw dealRes.error;
      if (stageRes.error) throw stageRes.error;

      const stage = stageRes.data as PipelineStageRow;
      const { error } = await supabase
        .from("deals")
        .update({
          stage_id: stageId,
          probability: stage.default_probability,
        } satisfies DealUpdate)
        .eq("id", dealId);
      if (error) throw error;

      await supabase.from("deal_stage_history").insert({
        deal_id: dealId,
        from_stage: (dealRes.data as Pick<DealRow, "stage_id">).stage_id,
        to_stage: stageId,
        changed_by: userRes.data.user?.id ?? null,
      });
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: dealsKey });
      qc.invalidateQueries({ queryKey: ["deal", vars.dealId] });
    },
  });
}

export function useCloseDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CloseDealInput) => {
      const [dealRes, userRes] = await Promise.all([
        supabase.from("deals").select("*").eq("id", input.dealId).single(),
        supabase.auth.getUser(),
      ]);
      if (dealRes.error) throw dealRes.error;

      const deal = dealRes.data as DealRow;
      const isWon = input.mode === "won";
      const actualValue = input.actualValue ?? Number(deal.value ?? 0);
      const update: DealUpdate = {
        stage_id: input.stageId,
        probability: isWon ? 100 : 0,
        actual_close_date: input.actualCloseDate ?? new Date().toISOString().slice(0, 10),
        actual_value: isWon ? actualValue : null,
        lost_reason: isWon ? null : input.lostReason,
      };

      const { error } = await supabase.from("deals").update(update).eq("id", input.dealId);
      if (error) throw error;

      await Promise.all([
        supabase.from("deal_stage_history").insert({
          deal_id: input.dealId,
          from_stage: deal.stage_id,
          to_stage: input.stageId,
          changed_by: userRes.data.user?.id ?? null,
        }),
        isWon && Number(deal.value ?? 0) !== actualValue
          ? supabase.from("deal_value_history").insert({
              deal_id: input.dealId,
              old_value: deal.value,
              new_value: actualValue,
              reason: "Closed won actual value",
              changed_by: userRes.data.user?.id ?? null,
            })
          : Promise.resolve(),
        supabase.from("activities").insert({
          deal_id: input.dealId,
          contact_id: deal.primary_contact_id,
          owner_id: userRes.data.user?.id ?? deal.assigned_to,
          type: "note",
          title: isWon ? "Deal closed won" : "Deal closed lost",
          notes: input.note || input.lostReason || null,
          outcome: isWon ? "won" : "lost",
        }),
      ]);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: dealsKey });
      qc.invalidateQueries({ queryKey: ["deal", vars.dealId] });
    },
  });
}

function summarizeDeal(
  deal: DealRow,
  stages: PipelineStageRow[],
  contacts: ContactRow[],
  companies: CompanyRow[],
  profiles: ProfileRow[],
  activities: ActivityRow[],
): DealSummary {
  const dealActivities = activities.filter((activity) => activity.deal_id === deal.id);
  return {
    ...deal,
    stage: stages.find((stage) => stage.id === deal.stage_id) ?? null,
    primary_contact: contacts.find((contact) => contact.id === deal.primary_contact_id) ?? null,
    company: companies.find((company) => company.id === deal.company_id) ?? null,
    assigned_rep: profiles.find((profile) => profile.id === deal.assigned_to) ?? null,
    last_activity_at: dealActivities[0]?.created_at ?? null,
  };
}

function uniqueById<T extends { id: string }>(items: T[]) {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}
