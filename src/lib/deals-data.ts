import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type DealRow = Database["public"]["Tables"]["deals"]["Row"];
export type PipelineStage = Database["public"]["Tables"]["pipeline_stages"]["Row"];

export const dealsKey = ["deals"] as const;
export const stagesKey = ["pipeline_stages"] as const;

export function useDeals() {
  return useQuery({
    queryKey: dealsKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("*, primary_contact:contacts(id, first_name, last_name, email), company:companies(id, name)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as (DealRow & {
        primary_contact: { id: string; first_name: string; last_name: string; email: string | null } | null;
        company: { id: string; name: string } | null;
      })[];
    },
  });
}

export function useDeal(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ["deal", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select(
          "*, primary_contact:contacts(id, first_name, last_name, email, phone), company:companies(id, name, industry)"
        )
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function usePipelineStages() {
  return useQuery({
    queryKey: stagesKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_stages")
        .select("*")
        .order("position");
      if (error) throw error;
      return data as PipelineStage[];
    },
  });
}

export function useDealStageHistory(dealId: string | undefined) {
  return useQuery({
    enabled: !!dealId,
    queryKey: ["deal_stage_history", dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_stage_history")
        .select("*, from:pipeline_stages!deal_stage_history_from_stage_fkey(name,color), to:pipeline_stages!deal_stage_history_to_stage_fkey(name,color)")
        .eq("deal_id", dealId!)
        .order("changed_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useDealValueHistory(dealId: string | undefined) {
  return useQuery({
    enabled: !!dealId,
    queryKey: ["deal_value_history", dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_value_history")
        .select("*")
        .eq("deal_id", dealId!)
        .order("changed_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export interface CreateDealInput {
  name: string;
  primary_contact_id: string;
  company_id?: string | null;
  value: number;
  currency: string;
  stage_id: string;
  expected_close_date?: string | null;
  assigned_to?: string | null;
  description?: string | null;
}

export function useCreateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateDealInput) => {
      const { data, error } = await supabase.from("deals").insert(input).select("id").single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: dealsKey }),
  });
}

export function useUpdateDealStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; from_stage: string | null; to_stage: string; probability?: number }) => {
      const updates: Record<string, unknown> = { stage_id: vars.to_stage };
      if (vars.probability !== undefined) updates.probability = vars.probability;
      const { error } = await supabase.from("deals").update(updates).eq("id", vars.id);
      if (error) throw error;
      const { data: authData } = await supabase.auth.getUser();
      await supabase.from("deal_stage_history").insert({
        deal_id: vars.id,
        from_stage: vars.from_stage,
        to_stage: vars.to_stage,
        changed_by: authData.user?.id ?? null,
      });
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: dealsKey });
      qc.invalidateQueries({ queryKey: ["deal", v.id] });
      qc.invalidateQueries({ queryKey: ["deal_stage_history", v.id] });
    },
  });
}

export function useCloseWonDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      id: string;
      from_stage: string | null;
      won_stage_id: string;
      actual_value: number;
      actual_close_date: string;
    }) => {
      const { error } = await supabase
        .from("deals")
        .update({
          stage_id: vars.won_stage_id,
          probability: 100,
          actual_value: vars.actual_value,
          actual_close_date: vars.actual_close_date,
        })
        .eq("id", vars.id);
      if (error) throw error;
      const { data: authData } = await supabase.auth.getUser();
      await supabase.from("deal_stage_history").insert({
        deal_id: vars.id,
        from_stage: vars.from_stage,
        to_stage: vars.won_stage_id,
        changed_by: authData.user?.id ?? null,
      });
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: dealsKey });
      qc.invalidateQueries({ queryKey: ["deal", v.id] });
    },
  });
}

export function useCloseLostDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      id: string;
      from_stage: string | null;
      lost_stage_id: string;
      reason: string;
    }) => {
      const { error } = await supabase
        .from("deals")
        .update({
          stage_id: vars.lost_stage_id,
          probability: 0,
          lost_reason: vars.reason,
          actual_close_date: new Date().toISOString().slice(0, 10),
        })
        .eq("id", vars.id);
      if (error) throw error;
      const { data: authData } = await supabase.auth.getUser();
      await supabase.from("deal_stage_history").insert({
        deal_id: vars.id,
        from_stage: vars.from_stage,
        to_stage: vars.lost_stage_id,
        changed_by: authData.user?.id ?? null,
      });
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: dealsKey });
      qc.invalidateQueries({ queryKey: ["deal", v.id] });
    },
  });
}

export function useDeleteDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("deals").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: dealsKey }),
  });
}

export function useContactsLite() {
  return useQuery({
    queryKey: ["contacts_lite"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, email, company_id")
        .is("deleted_at", null)
        .order("first_name");
      if (error) throw error;
      return data as { id: string; first_name: string; last_name: string; email: string | null; company_id: string | null }[];
    },
  });
}

export function useLossReasons() {
  return useQuery({
    queryKey: ["loss_reasons"],
    queryFn: async () => {
      const { data, error } = await supabase.from("loss_reasons").select("id,label,position").order("position");
      if (error) throw error;
      return data;
    },
  });
}
