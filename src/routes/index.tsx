import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tally CRM — TallyPrime sales, organised" },
      {
        name: "description",
        content:
          "A lightweight CRM purpose-built for TallyPrime resellers. Capture every inbound lead and close every deal you should.",
      },
      { property: "og:title", content: "Tally CRM — TallyPrime sales, organised" },
      {
        property: "og:description",
        content:
          "Capture every Tally lead. Qualify, convert, and close — all in one place.",
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

const BENEFITS = [
  {
    icon: "bolt",
    title: "Zero leakage",
    body: "Every inbound enquiry lands in your pipeline within seconds — never an inbox you forgot to check.",
  },
  {
    icon: "insights",
    title: "Clear pipeline",
    body: "See exactly where each Tally deal sits, who owns it, and what to do next.",
  },
  {
    icon: "groups",
    title: "Built for resellers",
    body: "Designed around the way TallyPrime partners actually sell — light, fast, and on-brand.",
  },
];

const FEATURES = [
  { icon: "filter_alt", title: "Lead capture & dedupe", body: "One form, server-side validation, no duplicate contacts." },
  { icon: "view_kanban", title: "Kanban pipeline", body: "Drag deals between stages; history is logged automatically." },
  { icon: "task_alt", title: "Tasks & reminders", body: "Never forget a follow-up. Overdue items surface in red." },
  { icon: "lock", title: "Role-based security", body: "Reps see their own; managers see everything. RLS on every table." },
  { icon: "bar_chart", title: "Dashboards", body: "Pipeline value, conversion %, source mix — at a glance." },
  { icon: "mail", title: "Email confirmations", body: "Leads receive an instant acknowledgement after submission." },
];

const PRICING = [
  { name: "Starter", price: "Free", tag: "Up to 3 reps", features: ["Lead capture", "Pipeline kanban", "Tasks"] },
  { name: "Team", price: "GHS 250", tag: "per rep / month", features: ["Everything in Starter", "Dashboards", "Email automations"], featured: true },
  { name: "Partner", price: "Custom", tag: "Unlimited reps", features: ["Everything in Team", "Custom pipeline", "Audit log + SSO"] },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <Hero />
      <Benefits />
      <Features />
      <Pricing />
      <SocialProof />
      <ContactSection />
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="#top" className="text-xl font-black tracking-tight">
          Tally <span className="text-accent-dark">CRM</span>
        </a>
        <nav className="hidden items-center gap-6 text-sm md:flex">
          <a href="#features" className="text-text-secondary hover:text-primary">Features</a>
          <a href="#pricing" className="text-text-secondary hover:text-primary">Pricing</a>
          <a href="#contact" className="text-text-secondary hover:text-primary">Contact</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/auth" className="hidden rounded-lg px-3.5 py-2 text-sm font-semibold text-text-secondary hover:text-primary md:inline">
            Sign in
          </Link>
          <a href="#contact" className="inline-flex items-center gap-2 rounded-lg bg-cta px-4 py-2 text-sm font-semibold text-cta-foreground shadow-[var(--shadow-sm)] hover:bg-cta-hover">
            Get started
          </a>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section id="top" className="relative overflow-hidden border-b border-border bg-gradient-to-br from-surface to-background">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 md:grid-cols-[1.1fr_0.9fr] md:py-28">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary">For TallyPrime sales teams</p>
          <h1 className="mt-4 text-5xl font-black leading-[1.05] tracking-tight md:text-6xl">
            Capture every Tally lead.<br />
            <span className="text-primary">Close every deal</span> you should.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-text-secondary">
            A lightweight CRM purpose-built for TallyPrime resellers — from inbound lead capture all the way to closed-won.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#contact" className="inline-flex items-center gap-2 rounded-lg bg-cta px-5 py-3 font-semibold text-cta-foreground shadow-[var(--shadow-sm)] hover:bg-cta-hover">
              <span className="material-symbols-outlined">rocket_launch</span>
              Request a demo
            </a>
            <Link to="/auth" className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-5 py-3 font-semibold hover:bg-surface-hover">
              <span className="material-symbols-outlined">login</span>
              Sign in
            </Link>
          </div>
          <p className="mt-4 text-sm text-text-muted">No credit card. 10-second setup.</p>
        </div>
        <div className="hidden md:block">
          <PipelinePreview />
        </div>
      </div>
    </section>
  );
}

function PipelinePreview() {
  const cols = [
    { name: "New", count: 12, color: "bg-info-light text-info" },
    { name: "Contacted", count: 7, color: "bg-warning-light text-warning" },
    { name: "Qualified", count: 4, color: "bg-success-light text-success" },
  ];
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-lg)]">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-bold">Pipeline preview</p>
        <span className="rounded-full bg-success-light px-2 py-0.5 text-xs font-bold text-success">LIVE</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {cols.map((c) => (
          <div key={c.name} className="rounded-lg border border-border bg-surface p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-text-secondary">{c.name}</p>
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${c.color}`}>{c.count}</span>
            </div>
            <div className="mt-3 space-y-2">
              <div className="h-2 rounded bg-muted" />
              <div className="h-2 w-4/5 rounded bg-muted" />
              <div className="h-2 w-3/5 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="text-xs text-text-secondary">Conversion</p>
          <p className="text-2xl font-black text-primary">24%</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="text-xs text-text-secondary">Open value</p>
          <p className="text-2xl font-black">GHS 84k</p>
        </div>
      </div>
    </div>
  );
}

function Benefits() {
  return (
    <section className="border-b border-border bg-background py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-6 md:grid-cols-3">
          {BENEFITS.map((b) => (
            <div key={b.title} className="rounded-xl border border-border bg-card p-6">
              <span className="material-symbols-outlined text-3xl text-primary">{b.icon}</span>
              <h3 className="mt-3 text-lg font-bold">{b.title}</h3>
              <p className="mt-2 text-sm text-text-secondary">{b.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="border-b border-border bg-surface py-20">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">Features</p>
        <h2 className="mt-3 max-w-2xl text-4xl font-bold tracking-tight">Everything a Tally reseller actually needs.</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-border bg-card p-5 transition hover:border-primary">
              <span className="material-symbols-outlined text-2xl text-accent-dark">{f.icon}</span>
              <h3 className="mt-3 font-bold">{f.title}</h3>
              <p className="mt-1 text-sm text-text-secondary">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="border-b border-border bg-background py-20">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">Pricing</p>
        <h2 className="mt-3 text-4xl font-bold tracking-tight">Simple, per-seat pricing.</h2>
        <p className="mt-2 text-text-secondary">Start free. Upgrade when your team grows.</p>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {PRICING.map((p) => (
            <div
              key={p.name}
              className={`rounded-2xl border p-6 ${
                p.featured ? "border-primary bg-card shadow-[var(--shadow-lg)] ring-2 ring-primary/20" : "border-border bg-card"
              }`}
            >
              <p className="text-sm font-bold uppercase tracking-wider text-text-secondary">{p.name}</p>
              <p className="mt-3 text-4xl font-black">{p.price}</p>
              <p className="text-sm text-text-muted">{p.tag}</p>
              <ul className="mt-5 space-y-2 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-success">check_circle</span>
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="#contact"
                className={`mt-6 inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold ${
                  p.featured
                    ? "bg-cta text-cta-foreground hover:bg-cta-hover"
                    : "border border-border bg-surface hover:bg-surface-hover"
                }`}
              >
                Get started
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SocialProof() {
  const quotes = [
    { name: "Akosua M.", role: "Sales Lead, Accra", quote: "We stopped losing leads to email folders. Everything just shows up in the pipeline." },
    { name: "Daniel O.", role: "Reseller Partner", quote: "Setup took an afternoon. The team adopted it in a day." },
    { name: "Priya R.", role: "Ops Manager", quote: "Finally a CRM that doesn't try to be Salesforce. Fast, focused, fits how we sell Tally." },
  ];
  return (
    <section className="border-b border-border bg-surface py-20">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">Loved by Tally partners</p>
        <h2 className="mt-3 text-4xl font-bold tracking-tight">Built with resellers, for resellers.</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {quotes.map((q) => (
            <figure key={q.name} className="rounded-xl border border-border bg-card p-6">
              <span className="material-symbols-outlined text-3xl text-accent-dark">format_quote</span>
              <blockquote className="mt-2 text-sm text-foreground">"{q.quote}"</blockquote>
              <figcaption className="mt-4">
                <p className="text-sm font-bold">{q.name}</p>
                <p className="text-xs text-text-muted">{q.role}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function ContactSection() {
  return (
    <section id="contact" className="bg-background py-20">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 md:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary">Get in touch</p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight">Tell us about your team.</h2>
          <p className="mt-4 text-text-secondary">
            Drop your details and we'll get back within one business day with a tailored walkthrough.
          </p>
          <ul className="mt-6 space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="material-symbols-outlined text-primary">mail</span>
              <span>hello@tally-crm.app</span>
            </li>
            <li className="flex gap-3">
              <span className="material-symbols-outlined text-primary">schedule</span>
              <span>Mon–Fri, 9am–6pm GMT</span>
            </li>
            <li className="flex gap-3">
              <span className="material-symbols-outlined text-primary">verified_user</span>
              <span>Your data stays private. We never share or resell.</span>
            </li>
          </ul>
        </div>
        <ContactForm />
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
      const res = await fetch("/api/public/leads-capture-submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...parsed.data, website: values.website }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setState("success");
    } catch (err) {
      setState("error");
      setServerError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  if (state === "success") {
    return (
      <div className="rounded-2xl border border-success bg-success-light p-8 text-center">
        <span className="material-symbols-outlined text-5xl text-success">check_circle</span>
        <h3 className="mt-3 text-2xl font-bold">Thanks — we've got it.</h3>
        <p className="mt-2 text-text-secondary">
          One of our team will be in touch within one business day. Check your inbox for a confirmation.
        </p>
        <button
          type="button"
          onClick={() => {
            setValues({ first_name: "", last_name: "", email: "", phone: "", company_name: "", message: "", website: "" });
            setState("idle");
          }}
          className="mt-6 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold hover:bg-surface-hover"
        >
          Submit another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-md)] md:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name *" error={errors.first_name}>
          <input
            type="text"
            value={values.first_name}
            onChange={(e) => update("first_name", e.target.value)}
            className="input"
            autoComplete="given-name"
            required
          />
        </Field>
        <Field label="Last name *" error={errors.last_name}>
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
          />
        </Field>
        <Field label="Company" error={errors.company_name}>
          <input
            type="text"
            value={values.company_name}
            onChange={(e) => update("company_name", e.target.value)}
            className="input"
            autoComplete="organization"
          />
        </Field>
        <Field label="Message" error={errors.message} className="sm:col-span-2">
          <textarea
            rows={4}
            value={values.message}
            onChange={(e) => update("message", e.target.value)}
            className="input resize-y"
            placeholder="Team size, current tools, what you're looking for…"
          />
        </Field>
      </div>

      {/* Honeypot — hidden from humans */}
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
        <div className="mt-4 rounded-lg border border-danger bg-danger-light px-4 py-3 text-sm text-danger">
          We couldn't submit your request{serverError ? ` (${serverError})` : ""}. Please try again or email
          hello@tally-crm.app.
        </div>
      )}

      <button
        type="submit"
        disabled={state === "submitting"}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cta px-5 py-3 font-semibold text-cta-foreground shadow-[var(--shadow-sm)] hover:bg-cta-hover disabled:opacity-60"
      >
        {state === "submitting" ? (
          <>
            <span className="material-symbols-outlined animate-spin">progress_activity</span>
            Sending…
          </>
        ) : (
          <>
            <span className="material-symbols-outlined">send</span>
            Request a demo
          </>
        )}
      </button>
      <p className="mt-3 text-center text-xs text-text-muted">
        By submitting you agree to our terms. We'll only use your details to reply.
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

function Footer() {
  return (
    <footer className="border-t border-border bg-sidebar py-10 text-sidebar-foreground">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 md:flex-row">
        <p className="text-sm font-bold">
          Tally <span className="text-accent">CRM</span>
        </p>
        <p className="text-xs opacity-70">© {new Date().getFullYear()} Tally CRM. All rights reserved.</p>
      </div>
    </footer>
  );
}
