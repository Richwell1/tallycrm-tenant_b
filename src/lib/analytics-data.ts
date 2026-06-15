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

export const ANALYTICS_KPIS: AnalyticsKpi[] = [
  {
    label: "Total Pipeline Value",
    value: "GHS 2.5M",
    delta: "+12.4%",
    trend: "up",
    icon: "payments",
    caption: "Target coverage at 75%",
    tone: "primary",
    progress: 75,
  },
  {
    label: "Avg Deal Size",
    value: "GHS 42.5K",
    delta: "+4.2%",
    trend: "up",
    icon: "monitoring",
    caption: "Target: GHS 40.0K",
    tone: "accent",
    progress: 82,
  },
  {
    label: "Win Rate",
    value: "34.8%",
    delta: "-2.1%",
    trend: "down",
    icon: "workspace_premium",
    caption: "Review proposal stage losses",
    tone: "warning",
    progress: 35,
  },
  {
    label: "Avg Deal Velocity",
    value: "42 Days",
    delta: "Improving",
    trend: "flat",
    icon: "speed",
    caption: "Previous: 45 days",
    tone: "success",
    progress: 68,
  },
];

export const REVENUE_POINTS: RevenuePoint[] = [
  { label: "Jan", actual: 142000, target: 165000 },
  { label: "Feb", actual: 188000, target: 178000 },
  { label: "Mar", actual: 242000, target: 205000 },
  { label: "Apr", actual: 218000, target: 232000 },
  { label: "May", actual: 296000, target: 270000 },
  { label: "Jun", actual: 342000, target: 305000 },
  { label: "Jul", actual: 326000, target: 330000 },
  { label: "Aug", actual: 389000, target: 355000 },
  { label: "Sep", actual: 421000, target: 390000 },
  { label: "Oct", actual: 466000, target: 420000 },
  { label: "Nov", actual: 492000, target: 455000 },
  { label: "Dec", actual: 540000, target: 490000 },
];

export const FUNNEL_STAGES: FunnelStage[] = [
  { name: "Leads", count: 1240, dropoff: 72 },
  { name: "Contacted", count: 892, dropoff: 45 },
  { name: "Qualified", count: 401, dropoff: 32 },
  { name: "Demo", count: 128, dropoff: 54 },
  { name: "Proposal", count: 69, dropoff: 84 },
  { name: "Won", count: 58 },
];

export const REP_PERFORMANCE: RepPerformance[] = [
  {
    id: "sarah-jenkins",
    name: "Sarah Jenkins",
    role: "Senior AE",
    region: "Enterprise",
    location: "Accra, GH",
    initials: "SJ",
    leads: 142,
    closed: 28,
    revenue: 842000,
    winRate: 38.4,
    trend: "up",
    rank: 1,
    quota: 94,
    pipeline: 1240000,
    dealSize: 42500,
    velocityDays: 24,
  },
  {
    id: "michael-chen",
    name: "Michael Chen",
    role: "Enterprise AE",
    region: "Mid Market",
    location: "Kumasi, GH",
    initials: "MC",
    leads: 98,
    closed: 19,
    revenue: 615200,
    winRate: 32.1,
    trend: "up",
    rank: 2,
    quota: 88,
    pipeline: 940000,
    dealSize: 39800,
    velocityDays: 29,
  },
  {
    id: "emily-stone",
    name: "Emily Stone",
    role: "Commercial AE",
    region: "Commercial",
    location: "Takoradi, GH",
    initials: "ES",
    leads: 115,
    closed: 14,
    revenue: 412000,
    winRate: 24.5,
    trend: "flat",
    rank: 3,
    quota: 71,
    pipeline: 680000,
    dealSize: 31200,
    velocityDays: 37,
  },
  {
    id: "marcus-rogers",
    name: "Marcus Rogers",
    role: "Account Executive",
    region: "SMB",
    location: "Tema, GH",
    initials: "MR",
    leads: 88,
    closed: 11,
    revenue: 385000,
    winRate: 18.2,
    trend: "down",
    rank: 4,
    quota: 64,
    pipeline: 520000,
    dealSize: 28600,
    velocityDays: 43,
  },
];

export const LEAD_SOURCES: LeadSourceMetric[] = [
  { source: "Tally Landing Page", leads: 642, conversion: 18.4 },
  { source: "Referral", leads: 284, conversion: 34.2 },
  { source: "Manual Outreach", leads: 314, conversion: 12.8 },
  { source: "Partner Event", leads: 176, conversion: 22.6 },
];

export const LOSS_REASONS: LossReasonMetric[] = [
  { reason: "Pricing Strategy", percent: 42 },
  { reason: "Competitor Features", percent: 28 },
  { reason: "Budget Constrained", percent: 15 },
  { reason: "Timeline Mismatch", percent: 10 },
  { reason: "Product Fit", percent: 5 },
];

export const REP_ACTIVITIES: RepActivity[] = [
  {
    type: "call",
    title: "Outbound Call - Acme Retail",
    description: "Negotiation follow-up. Callback scheduled with finance lead.",
    time: "Today, 10:45 AM",
  },
  {
    type: "email",
    title: "Proposal Sent - Northstar Foods",
    description: "Enterprise TallyPrime quote sent to procurement.",
    time: "Yesterday, 4:12 PM",
  },
  {
    type: "meeting",
    title: "Demo Held - Global Trade",
    description: "Discovery session with 3 stakeholders. Needs analysis completed.",
    time: "Jun 12, 11:00 AM",
  },
  {
    type: "task",
    title: "Task Completed",
    description: "Updated lead scoring for high-intent landing page prospects.",
    time: "Jun 11, 2:30 PM",
  },
];

export const REP_OUTCOMES: RepOutcome[] = [
  {
    company: "CyberDyne Systems",
    contact: "Miles Bennett",
    value: 125000,
    status: "won",
    reason: "Strong Product Fit",
    date: "Jun 10, 2026",
  },
  {
    company: "Initech Solutions",
    contact: "Peter Gibbons",
    value: 45000,
    status: "lost",
    reason: "Budget Constraint",
    date: "Jun 8, 2026",
  },
  {
    company: "Hooli",
    contact: "Gavin Belson",
    value: 210000,
    status: "won",
    reason: "Service Reputation",
    date: "Jun 5, 2026",
  },
  {
    company: "Wayne Enterprises",
    contact: "Lucius Fox",
    value: 38000,
    status: "draft",
    reason: "Pending approval",
    date: "Jun 3, 2026",
  },
  {
    company: "Dunder Mifflin",
    contact: "Jim Halpert",
    value: 12000,
    status: "pending",
    reason: "Final Negotiation",
    date: "Jun 1, 2026",
  },
];

export function findRep(repId: string | undefined) {
  return REP_PERFORMANCE.find((rep) => rep.id === repId) ?? REP_PERFORMANCE[0];
}
