import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tally CRM — TallyPrime sales, organised" },
      {
        name: "description",
        content:
          "Capture inbound interest in TallyPrime and guide every prospect from first contact to closed deal.",
      },
      { property: "og:title", content: "Tally CRM" },
      {
        property: "og:description",
        content: "Lightweight CRM purpose-built for TallyPrime accounting software sales.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <h1 className="text-xl font-black tracking-tight text-foreground">
            Tally <span className="text-accent-dark">CRM</span>
          </h1>
          <nav className="flex items-center gap-3 text-sm">
            <a href="#features" className="text-text-secondary hover:text-primary">
              Features
            </a>
            <Link
              to="/app"
              className="rounded-lg bg-primary px-3.5 py-2 font-semibold text-primary-foreground hover:bg-primary-dark"
            >
              Open CRM
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-20">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">
          For TallyPrime sales teams
        </p>
        <h2 className="mt-3 max-w-3xl text-5xl font-bold leading-tight tracking-tight text-foreground">
          Capture every Tally lead. Close every deal you should.
        </h2>
        <p className="mt-5 max-w-2xl text-lg text-text-secondary">
          A lightweight CRM purpose-built for TallyPrime resellers — from inbound lead capture all
          the way to closed-won. Landing page coming in Feature 3.
        </p>
        <div className="mt-8 flex gap-3">
          <Link
            to="/app"
            className="inline-flex items-center gap-2 rounded-lg bg-cta px-5 py-3 font-semibold text-cta-foreground shadow-[var(--shadow-sm)] hover:bg-cta-hover"
          >
            <span className="material-symbols-outlined">login</span>
            Enter the CRM
          </Link>
        </div>
      </main>
    </div>
  );
}
