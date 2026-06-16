import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/format";

// ── Types ──────────────────────────────────────────────────────────────────────

export type AnalyticsPeriod = "week" | "month" | "quarter" | "year";

export interface AnalyticsKpi {
  label: string;
  value: string;
  delta: string;
  trend: "up" | "down" | "flat";
  icon: string;
  caption: string;
  tone: "primary" | "accent" | "success" | "warning";
  progress: number;
}

export interface RevenuePoint {
  label: string;
  actual: number;
  target: number;
}

export interface FunnelStage {
  name: string;
  count: number;
  dropoff?: number;
}

export interface RepPerformance {
  id: string;
  name: string;
  role: string;
  region: string;
  location: string;
  initials: string;
  leads: number;
  closed: number;
  revenue: number;
  winRate: number;
  trend: "up" | "down" | "flat";
  rank: number;
  quota: number;
  pipeline: number;
  dealSize: number;
  velocityDays: number;
}

export interface LeadSourceMetric {
  source: string;
  leads: number;
  conversion: number;
}

export interface LossReasonMetric {
  reason: string;
  percent: number;
}

export interface RepActivity {
  type: "call" | "email" | "meeting" | "task";
  title: string;
  description: string;
  time: string;
}

export interface RepOutcome {
  company: string;
  contact: string;
  value: number;
  status: "won" | "lost" | "draft" | "pending";
  reason: string;
  date: string;
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

function periodRange(period: AnalyticsPeriod): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString();
  let start: Date;
  switch (period) {
    case "week":
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "quarter": {
      const q = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), q * 3, 1);
      break;
    }
    case "year":
      start = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return { start: start.toISOString(), end };
}

function nameInitials(name: string | null | undefined): string {
  if (!name) return "??";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

// ── Deals fetch helper (shared by several hooks) ───────────────────────────────

async function fetchDealsWithStages() {
  const { data, error } = await supabase
    .from("deals")
    .select(
      "id, value, actual_value, actual_close_date, created_at, assigned_to, lost_reason, stage:pipeline_stages!stage_id(is_won, is_closed)",
    )
    .is("deleted_at", null);
  if (error) throw error;
  type Row = (typeof data)[number] & {
    stage: { is_won: boolean; is_closed: boolean } | null;
  };
  return (data ?? []) as Row[];
}

// ── Analytics KPIs ─────────────────────────────────────────────────────────────

export function useAnalyticsKpis(period: AnalyticsPeriod) {
  return useQuery({
    queryKey: ["analytics", "kpis", period],
    queryFn: async (): Promise<AnalyticsKpi[]> => {
      const { start, end } = periodRange(period);
      const all = await fetchDealsWithStages();

      const openDeals = all.filter((d) => !d.stage?.is_closed);
      const periodWon = all.filter(
        (d) =>
          d.stage?.is_won &&
          d.actual_close_date &&
          d.actual_close_date >= start &&
          d.actual_close_date <= end,
      );
      const periodLost = all.filter(
        (d) =>
          d.stage?.is_closed &&
          !d.stage?.is_won &&
          d.actual_close_date &&
          d.actual_close_date >= start &&
          d.actual_close_date <= end,
      );

      const totalPipeline = openDeals.reduce((s, d) => s + (d.value ?? 0), 0);
      const avgDealSize =
        all.length > 0 ? all.reduce((s, d) => s + (d.value ?? 0), 0) / all.length : 0;
      const totalClosed = periodWon.length + periodLost.length;
      const winRate = totalClosed > 0 ? (periodWon.length / totalClosed) * 100 : 0;

      const wonWithDates = periodWon.filter((d) => d.actual_close_date && d.created_at);
      const avgVelocity =
        wonWithDates.length > 0
          ? wonWithDates.reduce((s, d) => {
              const days =
                (new Date(d.actual_close_date!).getTime() - new Date(d.created_at).getTime()) /
                86_400_000;
              return s + days;
            }, 0) / wonWithDates.length
          : 0;

      return [
        {
          label: "Total Pipeline Value",
          value: formatCurrency(totalPipeline),
          delta: `${openDeals.length} open`,
          trend: openDeals.length > 0 ? "up" : "flat",
          icon: "payments",
          caption: `${openDeals.length} active deal${openDeals.length !== 1 ? "s" : ""}`,
          tone: "primary",
          progress: Math.min(100, Math.round((totalPipeline / 3_000_000) * 100)),
        },
        {
          label: "Avg Deal Size",
          value: formatCurrency(avgDealSize),
          delta: `${all.length} deals`,
          trend: avgDealSize > 40_000 ? "up" : avgDealSize > 25_000 ? "flat" : "down",
          icon: "monitoring",
          caption: `Across ${all.length} deal${all.length !== 1 ? "s" : ""}`,
          tone: "accent",
          progress: Math.min(100, Math.round((avgDealSize / 50_000) * 100)),
        },
        {
          label: "Win Rate",
          value: totalClosed > 0 ? `${winRate.toFixed(1)}%` : "—",
          delta: totalClosed > 0 ? `${periodWon.length}/${totalClosed}` : "No closes this period",
          trend: winRate >= 35 ? "up" : winRate >= 25 ? "flat" : "down",
          icon: "workspace_premium",
          caption: `${periodWon.length} won · ${periodLost.length} lost this period`,
          tone: "warning",
          progress: Math.round(winRate),
        },
        {
          label: "Avg Deal Velocity",
          value: avgVelocity > 0 ? `${Math.round(avgVelocity)} Days` : "—",
          delta: wonWithDates.length > 0 ? `${wonWithDates.length} closes` : "No closes yet",
          trend: avgVelocity > 0 && avgVelocity <= 30 ? "up" : avgVelocity > 45 ? "down" : "flat",
          icon: "speed",
          caption: `${wonWithDates.length} closed-won this period`,
          tone: "success",
          progress:
            avgVelocity > 0
              ? Math.min(100, Math.round(((60 - Math.min(avgVelocity, 60)) / 60) * 100))
              : 0,
        },
      ];
    },
  });
}

// ── Revenue Chart ──────────────────────────────────────────────────────────────

export function useRevenueChart(period: AnalyticsPeriod) {
  return useQuery({
    queryKey: ["analytics", "revenue", period],
    queryFn: async (): Promise<RevenuePoint[]> => {
      const { data: wonDeals, error } = await supabase
        .from("deals")
        .select("actual_value, actual_close_date, stage:pipeline_stages!stage_id(is_won)")
        .is("deleted_at", null)
        .not("actual_close_date", "is", null);
      if (error) throw error;

      type Row = (typeof wonDeals)[number] & {
        stage: { is_won: boolean } | null;
      };
      const won = ((wonDeals ?? []) as Row[]).filter((d) => d.stage?.is_won && d.actual_close_date);

      const now = new Date();

      // Build time buckets based on period
      const buckets: Array<{ label: string; start: Date; end: Date }> = [];

      if (period === "year") {
        for (let m = 0; m < 12; m++) {
          const s = new Date(now.getFullYear(), m, 1);
          const e = new Date(now.getFullYear(), m + 1, 0, 23, 59, 59);
          buckets.push({
            label: s.toLocaleString("default", { month: "short" }),
            start: s,
            end: e,
          });
        }
      } else if (period === "quarter") {
        for (let i = 2; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          buckets.push({
            label: d.toLocaleString("default", { month: "short" }),
            start: new Date(d.getFullYear(), d.getMonth(), 1),
            end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59),
          });
        }
      } else if (period === "month") {
        const ms = new Date(now.getFullYear(), now.getMonth(), 1);
        const me = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        for (let w = 0; w < 4; w++) {
          const ws = new Date(ms.getTime() + w * 7 * 86_400_000);
          const we = new Date(Math.min(ws.getTime() + 7 * 86_400_000 - 1, me.getTime()));
          buckets.push({ label: `W${w + 1}`, start: ws, end: we });
        }
      } else {
        // week: last 7 days
        for (let d = 6; d >= 0; d--) {
          const day = new Date(now.getTime() - d * 86_400_000);
          day.setHours(0, 0, 0, 0);
          const dayEnd = new Date(day.getTime() + 86_400_000 - 1);
          buckets.push({
            label: day.toLocaleString("default", { weekday: "short" }),
            start: day,
            end: dayEnd,
          });
        }
      }

      const points = buckets.map((bucket) => {
        const actual = won
          .filter((d) => {
            const date = new Date(d.actual_close_date!);
            return date >= bucket.start && date <= bucket.end;
          })
          .reduce((s, d) => s + (d.actual_value ?? 0), 0);
        return { label: bucket.label, actual };
      });

      // Target = average of all buckets * 1.15 (monthly growth target)
      const totalActual = points.reduce((s, p) => s + p.actual, 0);
      const avgActual = points.length > 0 ? totalActual / points.length : 0;
      const target = Math.round(avgActual * 1.15);

      return points.map((p) => ({ ...p, target }));
    },
  });
}

// ── Conversion Funnel ──────────────────────────────────────────────────────────

export function useConversionFunnel() {
  return useQuery({
    queryKey: ["analytics", "funnel"],
    queryFn: async (): Promise<FunnelStage[]> => {
      const [leadsRes, dealsRes] = await Promise.all([
        supabase.from("leads").select("status").is("deleted_at", null),
        supabase
          .from("deals")
          .select("stage:pipeline_stages!stage_id(is_won, is_closed)")
          .is("deleted_at", null),
      ]);
      if (leadsRes.error) throw leadsRes.error;
      if (dealsRes.error) throw dealsRes.error;

      const leads = leadsRes.data ?? [];
      type DealRow = (typeof dealsRes.data)[number] & {
        stage: { is_won: boolean; is_closed: boolean } | null;
      };
      const deals = (dealsRes.data ?? []) as DealRow[];

      const totalLeads = leads.length;
      const contacted = leads.filter((l) =>
        ["contacted", "qualified", "converted"].includes(l.status),
      ).length;
      const qualified = leads.filter((l) => ["qualified", "converted"].includes(l.status)).length;
      const openDeals = deals.filter((d) => !d.stage?.is_closed).length;
      const wonDeals = deals.filter((d) => d.stage?.is_won).length;

      const rawStages: FunnelStage[] = [
        { name: "Leads", count: totalLeads },
        { name: "Contacted", count: contacted },
        { name: "Qualified", count: qualified },
        { name: "Active Deals", count: openDeals },
        { name: "Won", count: wonDeals },
      ].filter((s) => s.count > 0);

      return rawStages.map((stage, index) => {
        if (index === rawStages.length - 1) return stage;
        const next = rawStages[index + 1];
        const dropoff =
          stage.count > 0
            ? Math.round(((stage.count - next.count) / stage.count) * 100)
            : undefined;
        return { ...stage, dropoff };
      });
    },
  });
}

// ── Rep Leaderboard ────────────────────────────────────────────────────────────

export function useRepLeaderboard() {
  return useQuery({
    queryKey: ["analytics", "leaderboard"],
    queryFn: async (): Promise<RepPerformance[]> => {
      const [rolesRes, dealsRes, leadsRes] = await Promise.all([
        supabase.from("user_roles").select("user_id, role"),
        supabase
          .from("deals")
          .select(
            "assigned_to, value, actual_value, actual_close_date, created_at, stage:pipeline_stages!stage_id(is_won, is_closed)",
          )
          .is("deleted_at", null),
        supabase.from("leads").select("assigned_to, status").is("deleted_at", null),
      ]);
      if (rolesRes.error) throw rolesRes.error;
      if (dealsRes.error) throw dealsRes.error;
      if (leadsRes.error) throw leadsRes.error;

      const roles = rolesRes.data ?? [];
      if (roles.length === 0) return [];

      const userIds = roles.map((r) => r.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);
      if (profilesError) throw profilesError;

      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

      type DealRow = (typeof dealsRes.data)[number] & {
        stage: { is_won: boolean; is_closed: boolean } | null;
      };
      const allDeals = (dealsRes.data ?? []) as DealRow[];
      const allLeads = leadsRes.data ?? [];

      const repMetrics = roles
        .map(({ user_id, role }) => {
          const profile = profileMap.get(user_id);
          const name = profile?.full_name ?? "Unknown";
          if (name === "Unknown") return null;

          const repDeals = allDeals.filter((d) => d.assigned_to === user_id);
          const openDeals = repDeals.filter((d) => !d.stage?.is_closed);
          const wonDeals = repDeals.filter((d) => d.stage?.is_won);
          const lostDeals = repDeals.filter((d) => d.stage?.is_closed && !d.stage?.is_won);
          const pipeline = openDeals.reduce((s, d) => s + (d.value ?? 0), 0);
          const revenue = wonDeals.reduce((s, d) => s + (d.actual_value ?? d.value ?? 0), 0);
          const avgDealSize =
            repDeals.length > 0
              ? repDeals.reduce((s, d) => s + (d.value ?? 0), 0) / repDeals.length
              : 0;
          const closed = wonDeals.length + lostDeals.length;
          const winRate = closed > 0 ? (wonDeals.length / closed) * 100 : 0;

          const wonWithDates = wonDeals.filter((d) => d.actual_close_date && d.created_at);
          const avgVelocity =
            wonWithDates.length > 0
              ? wonWithDates.reduce((s, d) => {
                  const days =
                    (new Date(d.actual_close_date!).getTime() - new Date(d.created_at).getTime()) /
                    86_400_000;
                  return s + days;
                }, 0) / wonWithDates.length
              : 0;

          const repLeads = allLeads.filter((l) => l.assigned_to === user_id);

          return {
            id: user_id,
            name,
            role: role === "admin" ? "Admin" : role === "manager" ? "Sales Manager" : "Sales Rep",
            region: "",
            location: "",
            initials: nameInitials(name),
            leads: repLeads.length,
            closed: wonDeals.length,
            revenue,
            winRate,
            trend: "flat" as const,
            rank: 0,
            quota: Math.min(100, Math.round((revenue / 500_000) * 100)),
            pipeline,
            dealSize: avgDealSize,
            velocityDays: Math.round(avgVelocity),
          };
        })
        .filter(Boolean) as RepPerformance[];

      return repMetrics
        .sort((a, b) => b.revenue - a.revenue)
        .map((rep, index) => ({ ...rep, rank: index + 1 }));
    },
  });
}

// ── Lead Source Breakdown ──────────────────────────────────────────────────────

export function useLeadSources() {
  return useQuery({
    queryKey: ["analytics", "lead_sources"],
    queryFn: async (): Promise<LeadSourceMetric[]> => {
      const { data: leads, error } = await supabase
        .from("leads")
        .select("source, status")
        .is("deleted_at", null);
      if (error) throw error;

      const sourceMap = new Map<string, { total: number; converted: number }>();
      for (const lead of leads ?? []) {
        const src = lead.source || "Unknown";
        const curr = sourceMap.get(src) ?? { total: 0, converted: 0 };
        curr.total++;
        if (lead.status === "converted") curr.converted++;
        sourceMap.set(src, curr);
      }

      return Array.from(sourceMap.entries())
        .map(([source, { total, converted }]) => ({
          source,
          leads: total,
          conversion: total > 0 ? (converted / total) * 100 : 0,
        }))
        .sort((a, b) => b.leads - a.leads)
        .slice(0, 6);
    },
  });
}

// ── Loss Reason Analytics ──────────────────────────────────────────────────────

export function useLossReasonAnalytics() {
  return useQuery({
    queryKey: ["analytics", "loss_reasons"],
    queryFn: async (): Promise<LossReasonMetric[]> => {
      const [reasonsRes, dealsRes] = await Promise.all([
        supabase.from("loss_reasons").select("id, label, position").order("position"),
        supabase
          .from("deals")
          .select("lost_reason, stage:pipeline_stages!stage_id(is_closed, is_won)")
          .is("deleted_at", null)
          .not("lost_reason", "is", null),
      ]);
      if (reasonsRes.error) throw reasonsRes.error;
      if (dealsRes.error) throw dealsRes.error;

      const reasons = reasonsRes.data ?? [];
      type DealRow = (typeof dealsRes.data)[number] & {
        stage: { is_closed: boolean; is_won: boolean } | null;
      };
      const lostDeals = ((dealsRes.data ?? []) as DealRow[]).filter(
        (d) => d.stage?.is_closed && !d.stage?.is_won,
      );
      const total = lostDeals.length || 1;

      const items = reasons
        .map((r) => ({
          reason: r.label,
          percent: Math.round(
            (lostDeals.filter((d) => d.lost_reason === r.label).length / total) * 100,
          ),
        }))
        .filter((r) => r.percent > 0)
        .sort((a, b) => b.percent - a.percent);

      // Fallback: if no loss data yet, return empty array (component handles empty)
      return items;
    },
  });
}

// ── Rep Detail (for $repId page) ───────────────────────────────────────────────

export function useRepDetails(repId: string | undefined) {
  return useQuery({
    queryKey: ["analytics", "rep", repId],
    enabled: Boolean(repId),
    queryFn: async (): Promise<RepPerformance | null> => {
      const [profileRes, dealsRes, rolesRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .eq("id", repId!)
          .maybeSingle(),
        supabase
          .from("deals")
          .select(
            "value, actual_value, actual_close_date, created_at, stage:pipeline_stages!stage_id(is_won, is_closed)",
          )
          .is("deleted_at", null)
          .eq("assigned_to", repId!),
        supabase.from("user_roles").select("role").eq("user_id", repId!).maybeSingle(),
      ]);
      if (profileRes.error) throw profileRes.error;
      const profile = profileRes.data;
      if (!profile) return null;

      const role = rolesRes.data?.role ?? "rep";
      type DealRow = {
        value: number;
        actual_value: number | null;
        actual_close_date: string | null;
        created_at: string;
        stage: { is_won: boolean; is_closed: boolean } | null;
      };
      const repDeals = (dealsRes.data ?? []) as DealRow[];
      const openDeals = repDeals.filter((d) => !d.stage?.is_closed);
      const wonDeals = repDeals.filter((d) => d.stage?.is_won);
      const lostDeals = repDeals.filter((d) => d.stage?.is_closed && !d.stage?.is_won);
      const pipeline = openDeals.reduce((s, d) => s + (d.value ?? 0), 0);
      const revenue = wonDeals.reduce((s, d) => s + (d.actual_value ?? d.value ?? 0), 0);
      const avgDealSize =
        repDeals.length > 0
          ? repDeals.reduce((s, d) => s + (d.value ?? 0), 0) / repDeals.length
          : 0;
      const closed = wonDeals.length + lostDeals.length;
      const winRate = closed > 0 ? (wonDeals.length / closed) * 100 : 0;
      const wonWithDates = wonDeals.filter((d) => d.actual_close_date && d.created_at);
      const avgVelocity =
        wonWithDates.length > 0
          ? wonWithDates.reduce((s, d) => {
              const days =
                (new Date(d.actual_close_date!).getTime() - new Date(d.created_at).getTime()) /
                86_400_000;
              return s + days;
            }, 0) / wonWithDates.length
          : 0;

      const name = profile.full_name ?? "Unknown Rep";
      return {
        id: repId!,
        name,
        role: role === "manager" ? "Sales Manager" : "Sales Rep",
        region: "",
        location: "",
        initials: nameInitials(name),
        leads: 0,
        closed: wonDeals.length,
        revenue,
        winRate,
        trend: "flat",
        rank: 1,
        quota: Math.min(100, Math.round((revenue / 500_000) * 100)),
        pipeline,
        dealSize: avgDealSize,
        velocityDays: Math.round(avgVelocity),
      };
    },
  });
}

export function useRepActivities(repId: string | undefined) {
  return useQuery({
    queryKey: ["analytics", "rep_activities", repId],
    enabled: Boolean(repId),
    queryFn: async (): Promise<RepActivity[]> => {
      const { data, error } = await supabase
        .from("activities")
        .select("type, title, notes, created_at")
        .eq("owner_id", repId!)
        .order("created_at", { ascending: false })
        .limit(4);
      if (error) throw error;

      const typeMap: Record<string, RepActivity["type"]> = {
        call: "call",
        email: "email",
        meeting: "meeting",
        demo: "meeting",
        proposal: "task",
        note: "task",
      };
      return (data ?? []).map((a) => ({
        type: typeMap[a.type] ?? "task",
        title: a.title,
        description: a.notes ?? a.type,
        time: new Date(a.created_at).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }),
      }));
    },
  });
}

export function useRepDeals(repId: string | undefined) {
  return useQuery({
    queryKey: ["analytics", "rep_deals", repId],
    enabled: Boolean(repId),
    queryFn: async (): Promise<RepOutcome[]> => {
      const { data, error } = await supabase
        .from("deals")
        .select(
          "name, value, actual_value, lost_reason, actual_close_date, stage:pipeline_stages!stage_id(is_won, is_closed, name), contact:contacts!primary_contact_id(first_name, last_name), company:companies!company_id(name)",
        )
        .is("deleted_at", null)
        .eq("assigned_to", repId!)
        .order("updated_at", { ascending: false })
        .limit(5);
      if (error) throw error;

      return (data ?? []).map((d) => {
        const stg = d.stage as { is_won: boolean; is_closed: boolean; name: string } | null;
        const status: RepOutcome["status"] = stg?.is_won
          ? "won"
          : stg?.is_closed
            ? "lost"
            : "pending";
        const contact = d.contact as { first_name: string; last_name: string } | null;
        const company = d.company as { name: string } | null;
        return {
          company: company?.name ?? d.name,
          contact: contact ? `${contact.first_name} ${contact.last_name}` : "—",
          value: d.actual_value ?? d.value ?? 0,
          status,
          reason: d.lost_reason ?? (stg?.is_won ? "Closed Won" : (stg?.name ?? "—")),
          date: d.actual_close_date ? new Date(d.actual_close_date).toLocaleDateString() : "—",
        };
      });
    },
  });
}
