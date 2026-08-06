import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import {
  Phone,
  Mail,
  MapPin,
  Star,
  Check,
  CheckCircle2,
  ShieldCheck,
  Calculator,
  FileText,
  Receipt,
  Boxes,
  Landmark,
  Users,
  BarChart3,
  Lock,
  Sparkles,
  Cloud,
  MessageCircle,
  CreditCard,
  FileSpreadsheet,
  Award,
  Wrench,
  GraduationCap,
  Headphones,
  Send,
  ArrowRight,
  ArrowDown,
  Menu,
  X,
  ChevronDown,
  Building2,
  ShoppingBag,
  Factory,
  Briefcase,
  Stethoscope,
  HardHat,
  HandHeart,
  Loader2,
  AlertCircle,
  Facebook,
  Linkedin,
  Instagram,
  Twitter,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TallyPrime in Ghana — Authorized Partner | Free Demo & Setup" },
      {
        name: "description",
        content:
          "Run your entire business on TallyPrime — accounting, invoicing, inventory, VAT compliance and payroll. Authorized partner in Ghana with free demo, local setup, training and support.",
      },
      { property: "og:title", content: "TallyPrime in Ghana — Authorized Partner" },
      {
        property: "og:description",
        content:
          "Accounting, invoicing, inventory, VAT and payroll in one platform. Free demo, on-site setup, local support in Ghana.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Landing,
});

const formSchema = z.object({
  first_name: z.string().trim().min(1, "Required").max(80),
  last_name: z.string().trim().min(1, "Required").max(80),
  email: z.string().trim().email("Enter a valid email").max(255),
  phone: z
    .string()
    .trim()
    .max(40)
    .optional()
    .refine((v) => !v || /^[+\d\s()-]{6,}$/.test(v), "Enter a valid phone"),
  company_name: z.string().trim().max(160).optional(),
  message: z.string().trim().max(2000).optional(),
});
type FormShape = z.infer<typeof formSchema>;
type FieldErrors = Partial<Record<keyof FormShape, string>>;

const PARTNER_PHONE_DISPLAY = "0543358413";
const PARTNER_PHONE_TEL = "+233543358413";

/* ──────────────────────────────────────────────────────────────────── */

function Landing() {
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme = "light";
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <AnnouncementBar />
      <Navbar />
      <Hero />
      <TrustBar />
      <WhatIs />
      <Features />
      <Benefits />
      <Industries />
      <Editions />
      <WhatsNew />
      <WhyUs />
      <HowItWorks />
      <Testimonials />
      <ImpactStats />
      <FAQ />
      <LeadCapture />
      <FinalCTA />
      <Footer />
      <MobileStickyCta />
    </div>
  );
}

/* ── Announcement + Navbar ─────────────────────────────────────────── */

function AnnouncementBar() {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div className="bg-navy text-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2 text-xs sm:text-sm">
        <p className="flex items-center gap-2">
          <Star className="h-3.5 w-3.5 text-accent" fill="currentColor" />
          <span>Authorized TallyPrime Partner in Ghana — Free demo &amp; on-site setup</span>
        </p>
        <div className="flex items-center gap-3">
          <a
            href={`tel:${PARTNER_PHONE_TEL}`}
            className="hidden items-center gap-1.5 hover:text-accent sm:flex"
          >
            <Phone className="h-3.5 w-3.5" /> {PARTNER_PHONE_DISPLAY}
          </a>
          <button
            onClick={() => setOpen(false)}
            aria-label="Dismiss"
            className="opacity-70 hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    ["Home", "#top"],
    ["Features", "#features"],
    ["Editions", "#editions"],
    ["Industries", "#industries"],
    ["Why TallyPrime", "#why-tally"],
    ["Resources", "#faq"],
    ["Contact", "#contact"],
  ];

  return (
    <header
      className={`sticky top-0 z-40 bg-surface transition-shadow ${
        scrolled ? "shadow-[var(--shadow-sm)]" : ""
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:py-4">
        <a href="#top" className="flex items-center gap-2">
          <span className="text-xl font-black tracking-tight text-primary">
            TallyPrime
            <span className="ml-0.5 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle" />
          </span>
          <span className="hidden text-sm font-semibold text-text-secondary sm:inline">
            Partner
          </span>
        </a>

        <nav className="hidden items-center gap-6 lg:flex">
          {links.map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="text-sm font-medium text-text-secondary transition hover:text-primary"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={`tel:${PARTNER_PHONE_TEL}`}
            className="hidden items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-semibold text-primary hover:bg-primary-light md:inline-flex"
          >
            <Phone className="h-4 w-4" />
            Call Sales
          </a>
          <a
            href="#contact"
            className="hidden items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-sm)] transition hover:bg-primary-dark md:inline-flex"
          >
            Get a Free Demo
            <ArrowRight className="h-4 w-4" />
          </a>
          <button
            onClick={() => setOpen((s) => !s)}
            className="rounded-md p-2 text-text-secondary lg:hidden"
            aria-label="Menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border bg-surface lg:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
            {links.map(([label, href]) => (
              <a
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-text-secondary hover:bg-primary-light hover:text-primary"
              >
                {label}
              </a>
            ))}
            <a
              href="#contact"
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Get a Free Demo <ArrowRight className="h-4 w-4" />
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}

/* ── Hero ──────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section
      id="top"
      className="relative overflow-hidden bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_62%,#eef5ff_100%)]"
    >
      <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-white" />
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(90deg,rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(180deg,rgba(15,23,42,0.04)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:linear-gradient(180deg,black,transparent_72%)]"
      />

      <div className="relative mx-auto grid min-h-[calc(100svh-88px)] max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 md:grid-cols-[1.02fr_0.98fr] md:py-20 lg:py-24">
        <div className="max-w-2xl md:pb-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary shadow-[var(--shadow-xs)] backdrop-blur">
            <Award className="h-3.5 w-3.5" />
            Authorized TallyPrime Partner in Ghana
          </span>
          <h1 className="mt-5 text-4xl font-black leading-[1.02] tracking-normal text-slate-950 sm:text-5xl lg:text-6xl">
            TallyPrime setup, licensing, and support for growing businesses.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
            TallyPrime brings accounting, invoicing, inventory, banking, payroll, and tax compliance
            together in one simple, reliable system trusted by millions of businesses. We help you
            buy, set up, and master it with local support every step of the way.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href="#contact"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:bg-primary"
            >
              Get a Free Demo
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="#contact"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-900 shadow-[var(--shadow-xs)] transition hover:-translate-y-0.5 hover:border-primary/30 hover:text-primary"
            >
              Talk to a Tally Expert
              <Phone className="h-4 w-4" />
            </a>
          </div>
        </div>

        <HeroVisual />
      </div>
    </section>
  );
}

function HeroVisual() {
  return (
    <div className="relative min-h-[520px]">
      <div
        aria-hidden
        className="absolute inset-6 rounded-[2rem] bg-[linear-gradient(135deg,rgba(0,87,184,0.1),rgba(248,177,51,0.12)_48%,rgba(255,255,255,0.9))]"
      />

      <div className="absolute inset-x-2 top-6 overflow-hidden rounded-[2rem] border border-white/80 bg-white p-2 shadow-[0_35px_90px_rgba(15,23,42,0.16)] sm:inset-x-0">
        <div className="relative aspect-square overflow-hidden rounded-[1.6rem] bg-primary-light">
          <img
            src="/images/tallyprime-hero.jpg"
            alt="TallyPrime business software on a laptop for accounting and inventory management"
            className="h-full w-full object-cover"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.9)_0%,rgba(255,255,255,0.48)_28%,rgba(0,87,184,0.08)_52%,rgba(0,63,138,0.44)_100%)]"
          />
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-2/5 bg-[linear-gradient(0deg,rgba(10,22,40,0.66),rgba(10,22,40,0))]"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0)_44%,rgba(248,177,51,0.16)_100%)]"
          />
        </div>
      </div>
    </div>
  );
}

/* ── Trust bar ─────────────────────────────────────────────────────── */

function TrustBar() {
  const stats = [
    { value: "2.5M+", label: "Businesses powered by Tally" },
    { value: "36+", label: "Years of proven reliability" },
    { value: "100%", label: "Built for compliance & accuracy" },
    { value: "7+", label: "Industries served locally" },
  ];
  return (
    <section className="border-y border-primary/10 bg-primary-light">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-10 sm:px-6 md:grid-cols-4 md:divide-x md:divide-primary/15">
        {stats.map((s) => (
          <div key={s.label} className="text-center md:px-4">
            <p className="text-3xl font-black text-primary md:text-4xl">{s.value}</p>
            <p className="mt-1 text-xs font-medium text-text-secondary sm:text-sm">{s.label}</p>
          </div>
        ))}
      </div>
      <p className="px-4 pb-6 text-center text-xs text-text-muted">
        Trusted by businesses across Ghana
      </p>
    </section>
  );
}

/* ── What is TallyPrime ────────────────────────────────────────────── */

function WhatIs() {
  const pillars = ["Accounting", "Inventory", "Compliance", "Reports"];
  return (
    <section id="why-tally" className="bg-background py-20">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">Why TallyPrime</p>
        <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
          Everything Your Business Needs to Run — In One Place
        </h2>
        <p className="mt-5 text-base text-text-secondary sm:text-lg">
          TallyPrime is a complete business-management software built for small and medium
          businesses. Instead of juggling spreadsheets and disconnected tools, you manage your
          accounts, sales, purchases, stock, cash flow, and statutory compliance from a single,
          intuitive screen — with real-time reports that show exactly how your business is doing,
          anytime.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-2">
          {pillars.map((p) => (
            <span
              key={p}
              className="rounded-full border border-primary/20 bg-primary-light px-4 py-1.5 text-sm font-semibold text-primary"
            >
              {p}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Features grid ─────────────────────────────────────────────────── */

const FEATURES = [
  {
    icon: Calculator,
    title: "Smart Accounting",
    body: "Record entries, manage ledgers, and close your books faster with automation that cuts errors and manual work.",
  },
  {
    icon: ShieldCheck,
    title: "VAT & Tax Compliance",
    body: "Stay compliant with Ghana's VAT and statutory requirements through accurate, automated invoicing and returns.",
  },
  {
    icon: Receipt,
    title: "Invoicing & Billing",
    body: "Create professional, branded invoices in seconds and get paid faster with clear receivables tracking.",
  },
  {
    icon: Boxes,
    title: "Inventory Management",
    body: "Track stock across multiple warehouses, manage orders, and avoid shortages with real-time visibility.",
  },
  {
    icon: Landmark,
    title: "Banking & Payments",
    body: "Reconcile statements, view live balances, and manage payments with connected, automated banking.",
  },
  {
    icon: Users,
    title: "Payroll Made Easy",
    body: "Process salaries, manage employee records, and stay on top of payroll obligations without the headache.",
  },
  {
    icon: BarChart3,
    title: "Insightful Dashboards & Reports",
    body: "Customizable, real-time reports on cash flow, profit, inventory, and more — for confident decisions.",
  },
  {
    icon: Lock,
    title: "Secure Remote Access",
    body: "Access your business data securely from anywhere, with encryption and role-based permissions.",
  },
  {
    icon: Sparkles,
    title: "Built to Scale",
    body: "Start simple and switch on advanced capabilities as you grow — TallyPrime grows with your business.",
  },
];

function Features() {
  return (
    <section id="features" className="border-y border-border bg-surface py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">Features</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
            Powerful Features, Beautifully Simple
          </h2>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="group rounded-xl border border-border bg-card p-6 transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-[var(--shadow-md)]"
              >
                <span className="grid h-11 w-11 place-items-center rounded-full bg-primary-light text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-lg font-bold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">{f.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ── Benefits / outcomes ──────────────────────────────────────────── */

const BENEFIT_ROWS = [
  {
    eyebrow: "Productivity",
    title: "Save Hours Every Week",
    body: "Automate repetitive accounting, invoicing, and reconciliation so your team spends time growing the business, not chasing paperwork.",
    points: ["Faster month-end close", "Fewer manual errors", "Automated bank reconciliation"],
    visual: "productivity" as const,
  },
  {
    eyebrow: "Visibility",
    title: "See Your Business in Real Time",
    body: "Know your cash position, profitability, and stock levels the moment you need them — not weeks later.",
    points: ["Live dashboards", "Customizable reports", "Multi-company consolidation"],
    visual: "visibility" as const,
  },
  {
    eyebrow: "Compliance",
    title: "Stay Compliant, Stress-Free",
    body: "Meet your VAT and tax obligations accurately and on time, with audit-ready records you can trust.",
    points: ["Automated tax invoicing", "Accurate returns", "Secure, audit-ready data"],
    visual: "compliance" as const,
  },
];

function Benefits() {
  return (
    <section className="bg-background py-20">
      <div className="mx-auto max-w-7xl space-y-20 px-4 sm:px-6">
        {BENEFIT_ROWS.map((row, i) => {
          const flip = i % 2 === 1;
          return (
            <div
              key={row.title}
              className={`grid items-center gap-10 md:grid-cols-2 ${
                flip ? "md:[&>*:first-child]:order-2" : ""
              }`}
            >
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-accent-dark">
                  {row.eyebrow}
                </p>
                <h3 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">{row.title}</h3>
                <p className="mt-4 text-base text-text-secondary">{row.body}</p>
                <ul className="mt-6 space-y-2.5">
                  {row.points.map((p) => (
                    <li key={p} className="flex items-start gap-2.5">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-success" />
                      <span className="text-sm font-medium">{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <BenefitVisual kind={row.visual} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function BenefitVisual({ kind }: { kind: "productivity" | "visibility" | "compliance" }) {
  return (
    <div className="relative rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-md)]">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-1 -z-10 rounded-2xl bg-gradient-to-br from-primary/10 via-transparent to-accent/10 blur-2xl"
      />
      {kind === "productivity" && (
        <div className="space-y-3">
          {[
            { label: "Invoice #INV-2041", status: "Sent" },
            { label: "Bank reconciliation", status: "Auto" },
            { label: "Payroll — June", status: "Done" },
          ].map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between rounded-lg bg-primary-light/60 px-4 py-3"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 text-success" /> {row.label}
              </span>
              <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-bold text-primary">
                {row.status}
              </span>
            </div>
          ))}
          <p className="pt-2 text-center text-xs font-semibold text-text-muted">
            12 hours saved this week
          </p>
        </div>
      )}
      {kind === "visibility" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-primary-light/60 p-4">
              <p className="text-xs text-text-secondary">Cash position</p>
              <p className="mt-1 text-2xl font-black text-primary">GHS 184k</p>
            </div>
            <div className="rounded-lg bg-accent-light p-4">
              <p className="text-xs text-text-secondary">Profit margin</p>
              <p className="mt-1 text-2xl font-black text-accent-dark">22.8%</p>
            </div>
          </div>
          <div className="h-28 rounded-lg bg-gradient-to-b from-primary-light/40 to-transparent p-3">
            <div className="flex h-full items-end gap-1.5">
              {[35, 55, 45, 70, 60, 85, 75, 95, 70, 88].map((h, i) => (
                <div
                  key={i}
                  style={{ height: `${h}%` }}
                  className="flex-1 rounded-t bg-primary/70"
                />
              ))}
            </div>
          </div>
        </div>
      )}
      {kind === "compliance" && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-lg bg-success-light px-4 py-3">
            <ShieldCheck className="h-5 w-5 text-success" />
            <div>
              <p className="text-sm font-bold">VAT return — May</p>
              <p className="text-xs text-text-secondary">Filed on time</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-primary-light/60 px-4 py-3">
            <FileText className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-bold">Audit trail</p>
              <p className="text-xs text-text-secondary">Every change logged</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-accent-light px-4 py-3">
            <Lock className="h-5 w-5 text-accent-dark" />
            <div>
              <p className="text-sm font-bold">Role-based access</p>
              <p className="text-xs text-text-secondary">Your data, your rules</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Industries ────────────────────────────────────────────────────── */

const INDUSTRIES = [
  { icon: ShoppingBag, label: "Retail & POS" },
  { icon: Building2, label: "Wholesale & Distribution" },
  { icon: Factory, label: "Manufacturing" },
  { icon: Briefcase, label: "Services & Consulting" },
  { icon: Stethoscope, label: "Healthcare & Pharma" },
  { icon: GraduationCap, label: "Education" },
  { icon: HardHat, label: "Construction" },
  { icon: HandHeart, label: "NGOs & Non-profits" },
];

function Industries() {
  return (
    <section id="industries" className="border-y border-border bg-surface py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">Industries</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
            Built for the Way You Do Business
          </h2>
        </div>
        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {INDUSTRIES.map((ind) => {
            const Icon = ind.icon;
            return (
              <div
                key={ind.label}
                className="group flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 text-center transition hover:border-primary hover:bg-primary-light/60"
              >
                <span className="grid h-12 w-12 place-items-center rounded-full bg-primary-light text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="h-6 w-6" />
                </span>
                <p className="text-sm font-semibold">{ind.label}</p>
              </div>
            );
          })}
        </div>
        <p className="mt-8 text-center text-sm text-text-secondary">
          Don&apos;t see your industry?{" "}
          <a href="#contact" className="font-bold text-primary hover:underline">
            Talk to us
          </a>
          .
        </p>
      </div>
    </section>
  );
}

/* ── Editions ──────────────────────────────────────────────────────── */

const EDITIONS = [
  {
    name: "TallyPrime Silver",
    tagline: "Single user, single PC. For solo owners and small teams getting started.",
    features: ["Full accounting & inventory", "Invoicing & reports", "Remote access identity"],
    cta: "Request a Quote",
    featured: false,
  },
  {
    name: "TallyPrime Gold",
    tagline:
      "Unlimited users on your network (LAN). For growing teams who work on the same data together.",
    features: ["Everything in Silver", "Multi-user / multi-PC", "Enhanced performance"],
    cta: "Request a Quote",
    featured: true,
  },
  {
    name: "TallyPrime Server / Cloud",
    tagline:
      "For larger or multi-location businesses. High-volume, high-performance, anytime-anywhere access.",
    features: ["Everything in Gold", "Server-grade performance", "Cloud access options"],
    cta: "Talk to Sales",
    featured: false,
  },
];

function Editions() {
  return (
    <section id="editions" className="bg-background py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">Editions</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
            Find the Right Fit for Your Business
          </h2>
          <p className="mt-4 text-text-secondary">
            Pricing is tailored to your edition and setup. Request a quote and we&apos;ll share
            current local pricing in GHS.
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {EDITIONS.map((ed) => (
            <div
              key={ed.name}
              className={`relative flex flex-col rounded-2xl border p-7 transition ${
                ed.featured
                  ? "border-primary bg-card shadow-[var(--shadow-lg)] md:-translate-y-2"
                  : "border-border bg-card hover:shadow-[var(--shadow-sm)]"
              }`}
            >
              {ed.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-xs font-black uppercase tracking-wider text-accent-foreground shadow-[var(--shadow-sm)]">
                  Most Popular
                </span>
              )}
              <h3 className="text-xl font-black text-foreground">{ed.name}</h3>
              <p className="mt-2 text-sm text-text-secondary">{ed.tagline}</p>
              <ul className="mt-6 flex-1 space-y-3">
                {ed.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="#contact"
                className={`mt-7 inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition ${
                  ed.featured
                    ? "bg-primary text-primary-foreground hover:bg-primary-dark"
                    : "border-2 border-primary text-primary hover:bg-primary-light"
                }`}
              >
                {ed.cta}
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-3xl text-center text-xs text-text-muted">
          Available as a one-time (perpetual) license or flexible subscription. Add{" "}
          <strong className="text-text-secondary">TSS</strong> (Tally Software Services) for ongoing
          updates, compliance, and connected features. Contact us for current local pricing in GHS.
        </p>
      </div>
    </section>
  );
}

/* ── What's New ────────────────────────────────────────────────────── */

const WHATS_NEW = [
  {
    icon: Cloud,
    title: "Secure Cloud Backup",
    body: "Keep your data safe and accessible with automatic, encrypted cloud backup.",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp for Business",
    body: "Send invoices, reminders, and reports to customers straight from Tally.",
  },
  {
    icon: CreditCard,
    title: "Connected Banking & Payments",
    body: "Live balances, reconciliation, and payments without leaving Tally.",
  },
  {
    icon: FileSpreadsheet,
    title: "Excel Import & Smart Find",
    body: "Bring in data from Excel and find anything instantly across your books.",
  },
];

function WhatsNew() {
  return (
    <section className="bg-navy py-20 text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-accent">The Latest</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
            Modern Tools for Modern Businesses
          </h2>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {WHATS_NEW.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition hover:border-accent/40 hover:bg-white/10"
              >
                <span className="grid h-11 w-11 place-items-center rounded-full bg-accent/15 text-accent">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-base font-bold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/70">{item.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ── Why Us ────────────────────────────────────────────────────────── */

const VALUE_CARDS = [
  {
    icon: Award,
    title: "Authorized & Trusted",
    body: "Genuine licenses, official partner.",
  },
  {
    icon: Wrench,
    title: "On-site & Remote Setup",
    body: "We install and configure for you.",
  },
  {
    icon: GraduationCap,
    title: "Hands-on Training",
    body: "Your team learns fast.",
  },
  {
    icon: Headphones,
    title: "Local Support",
    body: "Real people, quick response, your timezone.",
  },
];

function WhyUs() {
  return (
    <section className="bg-background py-20">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 md:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary">Why Choose Us</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
            More Than Software — A Partner Who Sets You Up to Win
          </h2>
          <p className="mt-5 text-base text-text-secondary">
            As an authorized TallyPrime partner, we don&apos;t just sell you a license. We help you
            choose the right edition, install and configure it for your business, train your team,
            and stand by you with responsive local support — so you get value from day one.
          </p>
          <a
            href="#contact"
            className="mt-7 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-sm)] hover:bg-primary-dark"
          >
            Book Your Free Consultation
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {VALUE_CARDS.map((v) => {
            const Icon = v.icon;
            return (
              <div
                key={v.title}
                className="rounded-xl border border-border bg-card p-5 transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-[var(--shadow-md)]"
              >
                <span className="grid h-10 w-10 place-items-center rounded-full bg-accent-light text-accent-dark">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-3 text-base font-bold">{v.title}</h3>
                <p className="mt-1.5 text-sm text-text-secondary">{v.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ── How It Works ──────────────────────────────────────────────────── */

const STEPS = [
  {
    n: 1,
    title: "Tell Us Your Needs",
    body: "Share your business size and goals through the form below.",
  },
  {
    n: 2,
    title: "See a Free Demo",
    body: "We show you TallyPrime working for a business like yours.",
  },
  {
    n: 3,
    title: "Set Up & Train",
    body: "We install, configure, and train your team.",
  },
  {
    n: 4,
    title: "Grow with Support",
    body: "Ongoing local support keeps you compliant and confident.",
  },
];

function HowItWorks() {
  return (
    <section className="border-y border-border bg-surface py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">Get Started</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
            Up and Running in 4 Simple Steps
          </h2>
        </div>
        <div className="relative mt-14">
          <div
            aria-hidden
            className="absolute left-8 top-0 hidden h-full w-px bg-border md:left-0 md:top-12 md:h-px md:w-full"
          />
          <div className="grid gap-8 md:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n} className="relative flex md:block">
                <div className="flex md:flex-col md:items-center md:text-center">
                  <span className="z-10 grid h-12 w-12 flex-shrink-0 place-items-center rounded-full bg-primary text-base font-black text-primary-foreground shadow-[var(--shadow-md)] ring-4 ring-surface">
                    {s.n}
                  </span>
                  <div className="ml-5 md:ml-0 md:mt-5">
                    <h3 className="text-base font-bold">{s.title}</h3>
                    <p className="mt-1.5 text-sm text-text-secondary">{s.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Testimonials ──────────────────────────────────────────────────── */

const TESTIMONIALS = [
  {
    quote:
      "Switching to TallyPrime cut our month-end close from days to hours. The team set everything up and trained us — we were productive immediately.",
    name: "Kwame A.",
    role: "Owner, Retail Business",
    location: "Accra",
  },
  {
    quote:
      "Real-time stock and cash reports changed how we make decisions. We finally see the whole business at a glance.",
    name: "Ama B.",
    role: "Finance Manager, Distribution Company",
    location: "Kumasi",
  },
  {
    quote:
      "Compliance used to stress us out. Now invoicing and returns are accurate and on time, and support is always a call away.",
    name: "Kojo D.",
    role: "Director, Services Firm",
    location: "Tema",
  },
];

function Testimonials() {
  return (
    <section className="bg-background py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">Testimonials</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
            Businesses Like Yours Trust TallyPrime
          </h2>
          <p className="mt-2 text-xs text-text-muted">
            Placeholder quotes — replace with real client testimonials before launch.
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <figure
              key={t.name}
              className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]"
            >
              <div className="flex gap-0.5 text-accent">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4" fill="currentColor" />
                ))}
              </div>
              <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-foreground">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-3 border-t border-border pt-4">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-primary-light text-sm font-bold text-primary">
                  {t.name
                    .split(" ")
                    .map((p) => p[0])
                    .join("")}
                </span>
                <div>
                  <p className="text-sm font-bold">{t.name}</p>
                  <p className="text-xs text-text-muted">
                    {t.role} · {t.location}
                  </p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Impact stats ──────────────────────────────────────────────────── */

function ImpactStats() {
  const items = [
    { value: "12+", label: "Hours saved on accounting each week" },
    { value: "3×", label: "Faster, error-free invoicing" },
    { value: "100%", label: "Real-time visibility into every figure" },
    { value: "Year-round", label: "Audit-ready compliance" },
  ];
  return (
    <section className="bg-primary-light py-14">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 sm:px-6 md:grid-cols-4">
        {items.map((s) => (
          <div key={s.label} className="text-center">
            <p className="text-3xl font-black text-primary sm:text-4xl">{s.value}</p>
            <p className="mt-1 text-xs font-medium text-text-secondary sm:text-sm">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── FAQ ───────────────────────────────────────────────────────────── */

const FAQS = [
  {
    q: "Is TallyPrime suitable for a small business?",
    a: "Yes. It scales from a single user to large multi-location teams; you only switch on what you need.",
  },
  {
    q: "Do I need accounting expertise to use it?",
    a: "No. Guided workflows and dashboards make it simple; we also train your team.",
  },
  {
    q: "Will it handle Ghana's VAT requirements?",
    a: "Yes — it's built for accurate, compliant invoicing and returns. We configure it for your region.",
  },
  {
    q: "Can my team work together on the same data?",
    a: "Yes, with the Gold (multi-user) edition over your network, or via cloud access.",
  },
  {
    q: "Is my data secure?",
    a: "Your data is encrypted, backed up, and protected with role-based access — it stays yours alone.",
  },
  {
    q: "How much does it cost?",
    a: "Pricing depends on edition and setup. Request a quote and we'll share current local pricing in GHS.",
  },
  {
    q: "What support do you provide?",
    a: "Installation, configuration, training, and ongoing local support as an authorized partner.",
  },
  {
    q: "Can I migrate from my current accounting system?",
    a: "Yes. We help you move your master data and opening balances safely — just ask us.",
  },
];

function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="border-y border-border bg-surface py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">FAQ</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
            Questions? We&apos;ve Got Answers
          </h2>
        </div>
        <div className="mt-10 divide-y divide-border rounded-2xl border border-border bg-card">
          {FAQS.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q}>
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left sm:px-6"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm font-bold sm:text-base">{item.q}</span>
                  <ChevronDown
                    className={`h-5 w-5 flex-shrink-0 text-primary transition ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-sm text-text-secondary sm:px-6">{item.a}</div>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-center text-sm text-text-secondary">
          Still have questions?{" "}
          <a href="#contact" className="font-bold text-primary hover:underline">
            Send us a message
          </a>
          .
        </p>
      </div>
    </section>
  );
}

/* ── Lead capture ──────────────────────────────────────────────────── */

function LeadCapture() {
  return (
    <section id="contact" className="bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)] py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-10 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_30px_90px_rgba(15,23,42,0.10)] sm:p-10 md:grid-cols-[0.9fr_1.1fr] lg:p-14">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary">
              Get a Free Demo
            </p>
            <h2
              id="demo"
              className="mt-3 text-3xl font-black tracking-normal text-slate-950 sm:text-4xl"
            >
              Ready to Transform Your Business with TallyPrime?
            </h2>
            <p className="mt-5 text-base leading-7 text-slate-600">
              Tell us a little about your business and our Tally experts will reach out with a free
              demo and a tailored recommendation. Every request is written directly into the CRM,
              queued for manager review, and confirmed by email.
            </p>
            <ul className="mt-7 space-y-3 text-sm text-slate-700">
              {[
                "Free, no-obligation demo",
                "Genuine authorized licenses",
                "Local setup, training & support",
                "CRM-tracked follow-up after submission",
              ].map((p) => (
                <li key={p} className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-success" />
                  {p}
                </li>
              ))}
            </ul>
            <div className="mt-8 grid gap-3 border-t border-slate-200 pt-7 text-sm text-slate-700">
              <a
                href={`tel:${PARTNER_PHONE_TEL}`}
                className="flex items-center gap-3 hover:text-primary"
              >
                <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-primary">
                  <Phone className="h-4 w-4" />
                </span>
                {PARTNER_PHONE_DISPLAY}
              </a>
              <a
                href="mailto:hello@partner.com"
                className="flex items-center gap-3 hover:text-primary"
              >
                <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-primary">
                  <Mail className="h-4 w-4" />
                </span>
                hello@partner.com
              </a>
              <p className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-primary">
                  <MapPin className="h-4 w-4" />
                </span>
                Accra, Ghana
              </p>
            </div>
          </div>
          <ContactForm />
        </div>
      </div>
    </section>
  );
}

function ContactForm() {
  const [values, setValues] = useState<FormShape & { website: string }>({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    company_name: "",
    message: "",
    website: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmationId, setConfirmationId] = useState<string | null>(null);

  function update<K extends keyof typeof values>(key: K, v: string) {
    setValues((s) => ({ ...s, [key]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    const parsed = formSchema.safeParse(values);
    if (!parsed.success) {
      const fe: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof FormShape;
        if (!fe[k]) fe[k] = issue.message;
      }
      setErrors(fe);
      return;
    }
    setErrors({});
    setState("submitting");
    try {
      const res = await fetch("/api/public/leads-capture", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          ...parsed.data,
          website: values.website,
          source: "Tally Landing Page",
        }),
      });
      const payload = (await res.json().catch(() => null)) as {
        ok?: boolean;
        lead_id?: string;
        error?: string;
        code?: string;
      } | null;
      if (!res.ok || payload?.ok === false) {
        throw new Error(payload?.error || `Submission failed with HTTP ${res.status}`);
      }
      setConfirmationId(payload?.lead_id ?? null);
      setState("success");
    } catch (err) {
      setState("error");
      setServerError(
        err instanceof Error ? err.message : "The CRM capture service could not be reached.",
      );
    }
  }

  if (state === "success") {
    return (
      <div className="rounded-[1.5rem] border border-slate-200 bg-white p-8 text-center text-foreground shadow-[0_24px_70px_rgba(15,23,42,0.10)]">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-success-light text-success">
          <CheckCircle2 className="h-8 w-8" />
        </span>
        <h3 className="mt-4 text-2xl font-black">Thanks — we&apos;ve got it.</h3>
        <p className="mt-2 text-sm text-text-secondary">
          Your request has been saved to the CRM as a new Tally Landing Page lead. A Tally expert
          will be in touch shortly.
        </p>
        {confirmationId ? (
          <p className="mx-auto mt-4 max-w-sm rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
            Confirmation reference: {confirmationId.slice(0, 8).toUpperCase()}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setValues({
              first_name: "",
              last_name: "",
              email: "",
              phone: "",
              company_name: "",
              message: "",
              website: "",
            });
            setConfirmationId(null);
            setState("idle");
          }}
          className="mt-6 rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold hover:bg-surface-hover"
        >
          Submit another
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="relative rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-6 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] sm:p-8"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First Name *" error={errors.first_name}>
          <input
            type="text"
            value={values.first_name}
            onChange={(e) => update("first_name", e.target.value)}
            className="input"
            autoComplete="given-name"
            required
          />
        </Field>
        <Field label="Last Name *" error={errors.last_name}>
          <input
            type="text"
            value={values.last_name}
            onChange={(e) => update("last_name", e.target.value)}
            className="input"
            autoComplete="family-name"
            required
          />
        </Field>
        <Field label="Email *" error={errors.email} className="sm:col-span-2">
          <input
            type="email"
            value={values.email}
            onChange={(e) => update("email", e.target.value)}
            className="input"
            autoComplete="email"
            required
          />
        </Field>
        <Field label="Phone" error={errors.phone}>
          <input
            type="tel"
            value={values.phone}
            onChange={(e) => update("phone", e.target.value)}
            className="input"
            autoComplete="tel"
            placeholder="+233 ___ ___ ___"
          />
        </Field>
        <Field label="Company Name" error={errors.company_name}>
          <input
            type="text"
            value={values.company_name}
            onChange={(e) => update("company_name", e.target.value)}
            className="input"
            autoComplete="organization"
          />
        </Field>
        <Field label="What do you need help with?" error={errors.message} className="sm:col-span-2">
          <textarea
            rows={4}
            value={values.message}
            onChange={(e) => update("message", e.target.value)}
            className="input resize-y"
            placeholder="Business size, current tools, what you're looking for…"
          />
        </Field>
      </div>

      {/* Honeypot */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={values.website}
            onChange={(e) => update("website", e.target.value)}
          />
        </label>
      </div>

      {state === "error" && (
        <div className="mt-4 flex gap-3 rounded-2xl border border-danger/20 bg-danger-light px-4 py-3 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p>
            We couldn&apos;t submit your request
            {serverError ? ` (${serverError})` : ""}. Please try again or call us directly.
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={state === "submitting"}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3.5 text-base font-bold text-white shadow-[0_18px_45px_rgba(15,23,42,0.18)] transition hover:bg-primary disabled:opacity-60"
      >
        {state === "submitting" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Sending…
          </>
        ) : (
          <>
            <Send className="h-4 w-4" />
            Request My Free Demo
          </>
        )}
      </button>
      <p className="mt-3 text-center text-xs text-text-muted">
        By submitting you agree to be contacted about TallyPrime. We never share your details.
      </p>
    </form>
  );
}

function Field({
  label,
  error,
  children,
  className,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-1.5 block text-sm font-semibold text-foreground">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs font-medium text-danger">{error}</span>}
    </label>
  );
}

/* ── Final CTA ─────────────────────────────────────────────────────── */

function FinalCTA() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary-dark to-navy py-20 text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-accent/20 blur-3xl"
      />
      <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h2 className="text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
          Join Millions of Businesses Running Smarter with TallyPrime
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-base text-white/80">
          Book a free demo today and see how TallyPrime fits your business.
        </p>
        <a
          href="#contact"
          className="mt-8 inline-flex items-center gap-2 rounded-lg bg-accent px-7 py-3.5 text-base font-bold text-accent-foreground shadow-[var(--shadow-lg)] transition hover:bg-accent-dark"
        >
          Get Your Free Demo Today
          <ArrowRight className="h-5 w-5" />
        </a>
      </div>
    </section>
  );
}

/* ── Footer ────────────────────────────────────────────────────────── */

function Footer() {
  return (
    <footer className="relative overflow-hidden bg-navy text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 left-1/2 hidden -translate-x-1/2 select-none text-[14rem] font-black tracking-tighter text-white/[0.03] md:block"
      >
        TallyPrime
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6">
        {/* Top: brand + newsletter */}
        <div className="grid gap-10 border-b border-white/10 pb-12 md:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="text-2xl font-black tracking-tight">
              TallyPrime
              <span className="ml-0.5 inline-block h-2 w-2 rounded-full bg-accent align-middle" />
              <span className="ml-2 text-sm font-semibold text-white/60">Partner</span>
            </p>
            <p className="mt-4 max-w-md text-sm text-white/70">
              Your authorized TallyPrime partner — helping businesses across Ghana run simpler,
              smarter, and fully compliant.
            </p>
          </div>
          <NewsletterForm />
        </div>

        {/* Middle: link columns */}
        <div className="grid gap-10 py-12 sm:grid-cols-2 md:grid-cols-4">
          <FooterCol
            title="Product"
            links={[
              ["Features", "#features"],
              ["Editions", "#editions"],
              ["What's New", "#why-tally"],
              ["Industries", "#industries"],
            ]}
          />
          <FooterCol
            title="Company"
            links={[
              ["About Us", "#why-tally"],
              ["Why Choose Us", "#why-tally"],
              ["Resources", "#faq"],
              ["Contact", "#contact"],
            ]}
          />
          <FooterCol
            title="Support"
            links={[
              ["Book a Demo", "#contact"],
              ["Help & FAQ", "#faq"],
              ["Training", "#contact"],
              ["Get Support", "#contact"],
            ]}
          />
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-white/90">Contact</p>
            <ul className="mt-4 space-y-3 text-sm text-white/70">
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 text-accent" /> {PARTNER_PHONE_DISPLAY}
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 text-accent" /> hello@partner.com
              </li>
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 text-accent" /> Accra, Ghana
              </li>
            </ul>
            <div className="mt-5 flex gap-2">
              {[Facebook, Linkedin, Instagram, Twitter].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="grid h-9 w-9 place-items-center rounded-lg bg-white/5 text-white/80 transition hover:bg-accent hover:text-accent-foreground"
                  aria-label="Social"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col gap-4 border-t border-white/10 pt-8 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Authorized TallyPrime Partner. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <a href="#" className="hover:text-white">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-white">
              Terms
            </a>
            <span className="text-white/40">
              TallyPrime™ is a product of Tally Solutions Pvt. Ltd.
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="text-sm font-bold uppercase tracking-wider text-white/90">{title}</p>
      <ul className="mt-4 space-y-3 text-sm text-white/70">
        {links.map(([label, href]) => (
          <li key={label}>
            <a href={href} className="transition hover:text-accent">
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    setStatus(ok ? "success" : "error");
    if (ok) setEmail("");
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <p className="text-base font-bold">Get business tips &amp; TallyPrime updates</p>
      <p className="mt-1 text-sm text-white/60">Monthly. No spam. Unsubscribe anytime.</p>
      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@business.com"
          className="flex-1 rounded-lg bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:bg-white/15 focus:outline-none focus:ring-2 focus:ring-accent"
          required
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-accent-foreground transition hover:bg-accent-dark"
        >
          Subscribe
        </button>
      </form>
      {status === "success" && (
        <p className="mt-3 text-xs font-semibold text-success">Thanks — you&apos;re on the list.</p>
      )}
      {status === "error" && (
        <p className="mt-3 text-xs font-semibold text-danger">Enter a valid email address.</p>
      )}
    </div>
  );
}

/* ── Mobile sticky CTA ─────────────────────────────────────────────── */

function MobileStickyCta() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface p-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] md:hidden">
      <a
        href="#contact"
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
      >
        Get a Free Demo
        <ArrowDown className="h-4 w-4" />
      </a>
    </div>
  );
}
