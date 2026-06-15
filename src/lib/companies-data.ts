import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];

export const companiesKey = ["companies"] as const;

export function useCompanies() {
  return useQuery({
    queryKey: companiesKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as CompanyRow[];
    },
  });
}

export function useCompany(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ["company", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("*").eq("id", id!).single();
      if (error) throw error;
      return data as CompanyRow;
    },
  });
}

export function useCompanyContacts(companyId: string | undefined) {
  return useQuery({
    enabled: !!companyId,
    queryKey: ["company_contacts", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, email, job_title")
        .eq("company_id", companyId!)
        .is("deleted_at", null);
      if (error) throw error;
      return data;
    },
  });
}

export function useCompanyDeals(companyId: string | undefined) {
  return useQuery({
    enabled: !!companyId,
    queryKey: ["company_deals", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("id, name, value, currency, stage:pipeline_stages(name, color)")
        .eq("company_id", companyId!)
        .is("deleted_at", null);
      if (error) throw error;
      return data;
    },
  });
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
  rating?: number | null;
  notes?: string | null;
  logo_url?: string | null;
}

export function useCreateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCompanyInput) => {
      const { data, error } = await supabase.from("companies").insert(input).select("id").single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: companiesKey }),
  });
}

export function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; updates: Partial<CreateCompanyInput> }) => {
      const { error } = await supabase.from("companies").update(vars.updates).eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: companiesKey });
      qc.invalidateQueries({ queryKey: ["company", v.id] });
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
    onSuccess: () => qc.invalidateQueries({ queryKey: companiesKey }),
  });
}
