import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];

export const contactsKey = ["contacts"] as const;

export function useContacts() {
  return useQuery({
    queryKey: contactsKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*, company:companies(id, name)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as (ContactRow & { company: { id: string; name: string } | null })[];
    },
  });
}

export function useContact(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ["contact", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*, company:companies(id, name, industry, website)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function useContactDeals(contactId: string | undefined) {
  return useQuery({
    enabled: !!contactId,
    queryKey: ["contact_deals", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("id, name, value, currency, stage:pipeline_stages(name, color)")
        .eq("primary_contact_id", contactId!)
        .is("deleted_at", null);
      if (error) throw error;
      return data;
    },
  });
}

export function useContactActivities(contactId: string | undefined) {
  return useQuery({
    enabled: !!contactId,
    queryKey: ["contact_activities", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .eq("contact_id", contactId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
}

export interface CreateContactInput {
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  job_title?: string | null;
  company_id?: string | null;
  source?: string | null;
  assigned_to?: string | null;
  notes?: string | null;
}

export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateContactInput) => {
      const { data, error } = await supabase.from("contacts").insert(input).select("id").single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: contactsKey }),
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; updates: Partial<CreateContactInput> }) => {
      const { error } = await supabase.from("contacts").update(vars.updates).eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: contactsKey });
      qc.invalidateQueries({ queryKey: ["contact", v.id] });
    },
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("contacts")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: contactsKey }),
  });
}
