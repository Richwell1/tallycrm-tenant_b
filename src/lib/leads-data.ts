import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type LeadStatus = Database["public"]["Enums"]["lead_status"];
export type LeadRow = Database["public"]["Tables"]["leads"]["Row"];

export const LEAD_STATUSES: { id: LeadStatus; label: string; color: string }[] = [
  { id: "new", label: "New Lead", color: "bg-info-light text-info" },
  { id: "contacted", label: "Contacted", color: "bg-warning-light text-warning" },
  { id: "qualified", label: "Qualified", color: "bg-success-light text-success" },
  { id: "converted", label: "Converted", color: "bg-primary-light text-primary" },
  { id: "disqualified", label: "Disqualified", color: "bg-muted text-text-muted" },
];

export const leadsKey = ["leads"] as const;

export function useLeads() {
  return useQuery({
    queryKey: leadsKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as LeadRow[];
    },
  });
}

export function useLead(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ["lead", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*").eq("id", id!).single();
      if (error) throw error;
      return data as LeadRow;
    },
  });
}

export function useUpdateLeadStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; status: LeadStatus; extra?: Partial<LeadRow> }) => {
      const { error } = await supabase
        .from("leads")
        .update({ status: vars.status, ...(vars.extra ?? {}) })
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: leadsKey });
      qc.invalidateQueries({ queryKey: ["lead", v.id] });
    },
  });
}

export interface CreateLeadInput {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  company_name?: string;
  message?: string;
  status?: LeadStatus;
  assigned_to?: string | null;
}

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateLeadInput) => {
      const { data, error } = await supabase
        .from("leads")
        .insert({
          ...input,
          source: "Manual Entry",
          status: input.status ?? "new",
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: leadsKey }),
  });
}

export function useDisqualifyLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; reason: string }) => {
      const { error } = await supabase
        .from("leads")
        .update({ status: "disqualified", disqualify_reason: vars.reason, qualified: false })
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: leadsKey });
      qc.invalidateQueries({ queryKey: ["lead", v.id] });
    },
  });
}

export interface ConvertLeadInput {
  lead: LeadRow;
  contact: { first_name: string; last_name: string; email: string; phone?: string; job_title?: string };
  company?: { id?: string; name?: string; industry?: string; website?: string };
  deal: { name: string; value: number; currency: string; stage_id: string; expected_close_date?: string };
}

export function useConvertLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ConvertLeadInput) => {
      // 1. Company: link existing or create
      let companyId: string | null = null;
      if (input.company?.id) {
        companyId = input.company.id;
      } else if (input.company?.name?.trim()) {
        const { data: existing } = await supabase
          .from("companies")
          .select("id")
          .ilike("name", input.company.name.trim())
          .is("deleted_at", null)
          .maybeSingle();
        if (existing) {
          companyId = existing.id;
        } else {
          const { data: created, error } = await supabase
            .from("companies")
            .insert({
              name: input.company.name.trim(),
              industry: input.company.industry || null,
              website: input.company.website || null,
            })
            .select("id")
            .single();
          if (error) throw error;
          companyId = created.id;
        }
      }

      // 2. Contact: dedupe by email
      let contactId: string;
      const { data: existingContact } = await supabase
        .from("contacts")
        .select("id")
        .eq("email", input.contact.email)
        .is("deleted_at", null)
        .maybeSingle();
      if (existingContact) {
        contactId = existingContact.id;
        await supabase
          .from("contacts")
          .update({
            first_name: input.contact.first_name,
            last_name: input.contact.last_name,
            phone: input.contact.phone || null,
            job_title: input.contact.job_title || null,
            company_id: companyId,
          })
          .eq("id", contactId);
      } else {
        const { data: created, error } = await supabase
          .from("contacts")
          .insert({
            first_name: input.contact.first_name,
            last_name: input.contact.last_name,
            email: input.contact.email,
            phone: input.contact.phone || null,
            job_title: input.contact.job_title || null,
            company_id: companyId,
            source: input.lead.source,
            assigned_to: input.lead.assigned_to,
          })
          .select("id")
          .single();
        if (error) throw error;
        contactId = created.id;
      }

      // 3. Deal
      const { data: deal, error: dealErr } = await supabase
        .from("deals")
        .insert({
          name: input.deal.name,
          primary_contact_id: contactId,
          company_id: companyId,
          value: input.deal.value,
          currency: input.deal.currency,
          stage_id: input.deal.stage_id,
          expected_close_date: input.deal.expected_close_date || null,
          assigned_to: input.lead.assigned_to,
        })
        .select("id")
        .single();
      if (dealErr) throw dealErr;

      // 4. Mark lead converted
      await supabase
        .from("leads")
        .update({ status: "converted", qualified: true, converted_deal_id: deal.id })
        .eq("id", input.lead.id);

      return { contact_id: contactId, company_id: companyId, deal_id: deal.id };
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: leadsKey });
      qc.invalidateQueries({ queryKey: ["lead", v.lead.id] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["deals"] });
    },
  });
}

export function usePipelineStages() {
  return useQuery({
    queryKey: ["pipeline_stages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_stages")
        .select("id,name,position,is_won,is_closed,default_probability")
        .order("position");
      if (error) throw error;
      return data;
    },
  });
}

export function useLossReasons() {
  return useQuery({
    queryKey: ["loss_reasons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loss_reasons")
        .select("id,label,position")
        .order("position");
      if (error) throw error;
      return data;
    },
  });
}

export function useCompaniesLite() {
  return useQuery({
    queryKey: ["companies_lite"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id,name")
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useLeadActivities(leadEmail: string | undefined) {
  // Activities currently link via contact_id; we look up by contact email for context.
  return useQuery({
    enabled: !!leadEmail,
    queryKey: ["lead_activities", leadEmail],
    queryFn: async () => {
      const { data: contact } = await supabase
        .from("contacts")
        .select("id")
        .eq("email", leadEmail!)
        .maybeSingle();
      if (!contact) return [];
      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
}
