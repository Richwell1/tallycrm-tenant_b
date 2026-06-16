import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Role } from "@/types";

/**
 * All dashboard reads use the browser supabase client. RLS scopes rows
 * automatically (rep = own; manager/admin = all). The queries below are
 * intentionally simple counts/aggregations; the data-empty case renders zeros.
 */

const startOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

export interface DashboardKpis {
  newLeadsToday: number;
  newLeadsDelta: number; // %
  openDeals: number;
  openDealsValue: number;
  closedWonMonth: number;
  closedWonValue: number;
  conversionRate: number;
}

type DashboardDealStage = {
  is_closed?: boolean | null;
  is_won?: boolean | null;
};

type DashboardDealRow = {
  value: number | null;
  actual_value?: number | null;
  stage?: DashboardDealStage | DashboardDealStage[] | null;
};

function firstStage(stage: DashboardDealRow["stage"]) {
  return Array.isArray(stage) ? stage[0] : stage;
}

export function useDashboardKpis() {
  return useQuery<DashboardKpis>({
    queryKey: ["dashboard", "kpis"],
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const today = startOfDay();
      const yesterday = addDays(today, -1);
      const tomorrow = addDays(today, 1);
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

      const [todayLeads, yLeads, allDealsRes, wonRes, totalLeadsRes, convertedLeadsRes] =
        await Promise.all([
          supabase
            .from("leads")
            .select("id", { count: "exact", head: true })
            .gte("created_at", today.toISOString())
            .lt("created_at", tomorrow.toISOString())
            .is("deleted_at", null),
          supabase
            .from("leads")
            .select("id", { count: "exact", head: true })
            .gte("created_at", yesterday.toISOString())
            .lt("created_at", today.toISOString())
            .is("deleted_at", null),
          supabase
            .from("deals")
            .select("value,stage:pipeline_stages!inner(is_closed)")
            .is("deleted_at", null),
          supabase
            .from("deals")
            .select("value,actual_value,stage:pipeline_stages!inner(is_won)")
            .gte("updated_at", monthStart.toISOString())
            .is("deleted_at", null),
          supabase
            .from("leads")
            .select("id", { count: "exact", head: true })
            .is("deleted_at", null),
          supabase
            .from("leads")
            .select("id", { count: "exact", head: true })
            .eq("status", "converted")
            .is("deleted_at", null),
        ]);

      const allDeals = (allDealsRes.data ?? []) as DashboardDealRow[];
      const wonDeals = (wonRes.data ?? []) as DashboardDealRow[];

      const openDeals = allDeals.filter((d) => !firstStage(d.stage)?.is_closed);
      const openDealsValue = openDeals.reduce((sum: number, d) => sum + Number(d.value ?? 0), 0);

      const won = wonDeals.filter((d) => firstStage(d.stage)?.is_won);
      const closedWonValue = won.reduce(
        (sum: number, d) => sum + Number(d.actual_value ?? d.value ?? 0),
        0,
      );

      const totalLeads = totalLeadsRes.count ?? 0;
      const converted = convertedLeadsRes.count ?? 0;
      const conversionRate = totalLeads > 0 ? (converted / totalLeads) * 100 : 0;

      const yCount = yLeads.count ?? 0;
      const tCount = todayLeads.count ?? 0;
      const delta = yCount === 0 ? (tCount > 0 ? 100 : 0) : ((tCount - yCount) / yCount) * 100;

      return {
        newLeadsToday: tCount,
        newLeadsDelta: delta,
        openDeals: openDeals.length,
        openDealsValue,
        closedWonMonth: won.length,
        closedWonValue,
        conversionRate,
      };
    },
  });
}

export interface FunnelStage {
  id: string;
  name: string;
  color: string;
  count: number;
  value: number;
  is_closed: boolean;
}

export function usePipelineFunnel() {
  return useQuery<FunnelStage[]>({
    queryKey: ["dashboard", "funnel"],
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const [stagesRes, dealsRes] = await Promise.all([
        supabase.from("pipeline_stages").select("*").order("position"),
        supabase.from("deals").select("stage_id,value").is("deleted_at", null),
      ]);
      const stages = stagesRes.data ?? [];
      const deals = dealsRes.data ?? [];
      return stages.map((s) => {
        const matching = deals.filter((d) => d.stage_id === s.id);
        return {
          id: s.id,
          name: s.name,
          color: s.color,
          count: matching.length,
          value: matching.reduce((sum, d) => sum + Number(d.value ?? 0), 0),
          is_closed: s.is_closed,
        };
      });
    },
  });
}

export interface SourceSlice {
  source: string;
  count: number;
}

export function useLeadSourceBreakdown() {
  return useQuery<SourceSlice[]>({
    queryKey: ["dashboard", "sources"],
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data } = await supabase.from("leads").select("source").is("deleted_at", null);
      const counts = new Map<string, number>();
      for (const l of data ?? []) {
        const k = (l.source as string) || "Unknown";
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
      return Array.from(counts, ([source, count]) => ({ source, count })).sort(
        (a, b) => b.count - a.count,
      );
    },
  });
}

export interface ActivityFeedItem {
  id: string;
  type: string;
  title: string;
  notes: string | null;
  created_at: string;
}

export function useRecentActivity(limit = 10) {
  return useQuery<ActivityFeedItem[]>({
    queryKey: ["dashboard", "activity", limit],
    staleTime: 20_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data } = await supabase
        .from("activities")
        .select("id,type,title,notes,created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      return (data ?? []) as ActivityFeedItem[];
    },
  });
}

export interface MyTask {
  id: string;
  title: string;
  due_at: string | null;
  priority: "low" | "medium" | "high";
  status: string;
}

export function useMyTasks(userId: string | undefined) {
  return useQuery<MyTask[]>({
    queryKey: ["dashboard", "mytasks", userId],
    enabled: !!userId,
    staleTime: 20_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("id,title,due_at,priority,status")
        .eq("assigned_to", userId!)
        .neq("status", "done")
        .neq("status", "cancelled")
        .order("due_at", { ascending: true, nullsFirst: false })
        .limit(8);
      return (data ?? []) as MyTask[];
    },
  });
}

export interface MiniPipelineDeal {
  id: string;
  name: string;
  value: number;
  stage_id: string;
  updated_at: string;
}
export interface MiniPipelineStage {
  id: string;
  name: string;
  color: string;
  deals: MiniPipelineDeal[];
  totalValue: number;
}

export function useMiniPipeline(role: Role | null, userId: string | undefined) {
  return useQuery<MiniPipelineStage[]>({
    queryKey: ["dashboard", "mini-pipeline", role, userId],
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const [stagesRes, dealsRes] = await Promise.all([
        supabase
          .from("pipeline_stages")
          .select("id,name,color,position,is_closed")
          .eq("is_closed", false)
          .order("position"),
        supabase
          .from("deals")
          .select("id,name,value,stage_id,updated_at,assigned_to")
          .is("deleted_at", null)
          .order("updated_at", { ascending: false }),
      ]);
      const stages = stagesRes.data ?? [];
      const deals = (dealsRes.data ?? []).filter((d) =>
        role === "rep" && userId ? d.assigned_to === userId : true,
      );
      return stages.map((s) => {
        const matching = deals.filter((d) => d.stage_id === s.id).slice(0, 3);
        return {
          id: s.id,
          name: s.name,
          color: s.color,
          deals: matching as MiniPipelineDeal[],
          totalValue: deals
            .filter((d) => d.stage_id === s.id)
            .reduce((sum, d) => sum + Number(d.value ?? 0), 0),
        };
      });
    },
  });
}
