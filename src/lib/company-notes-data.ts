import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type CompanyNote = {
  id: string;
  company_id: string;
  body: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  origin_node_id: string | null;
  last_modified_by: string | null;
};

type CompanyNotesTable = {
  Row: CompanyNote;
  Insert: {
    id?: string;
    company_id: string;
    body: string;
    created_by?: string | null;
    created_at?: string;
    updated_at?: string;
    origin_node_id?: string | null;
    last_modified_by?: string | null;
  };
  Update: Partial<CompanyNote>;
  Relationships: [];
};

type CompanyNotesDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Database["public"]["Tables"] & {
      company_notes: CompanyNotesTable;
    };
  };
};

const companyNotesClient = supabase as unknown as SupabaseClient<CompanyNotesDatabase>;
export const companyNotesKey = (companyId: string) => ["company_notes", companyId] as const;

export function useCompanyNotes(companyId: string) {
  return useQuery({
    queryKey: companyNotesKey(companyId),
    queryFn: async () => {
      const { data, error } = await companyNotesClient
        .from("company_notes")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateCompanyNote(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      const { data, error } = await companyNotesClient
        .from("company_notes")
        .insert({ company_id: companyId, body: body.trim() })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: companyNotesKey(companyId) }),
  });
}
