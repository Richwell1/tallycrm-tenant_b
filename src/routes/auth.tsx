import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  enableLocalPreview,
  isSupabaseConfigured,
  missingSupabaseConfigMessage,
  supabase,
} from "@/integrations/supabase/client";
import { clearMfaSession, hasFreshMfaSession } from "@/lib/mfa-session";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "Sign in — Tally CRM" }] }),
  component: AuthPage,
});

type View = "signin" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const [view, setView] = useState<View>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const supabaseConfigured = isSupabaseConfigured();

  useEffect(() => {
    if (!supabaseConfigured) return;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal.data?.currentLevel === "aal2" && hasFreshMfaSession(data.user.id)) {
        navigate({ to: "/app", replace: true });
      } else {
        navigate({ to: "/mfa", replace: true });
      }
    });
  }, [navigate, supabaseConfigured]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!supabaseConfigured) {
      toast.error("Supabase is not configured", { description: missingSupabaseConfigMessage() });
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      clearMfaSession();
      toast.success("Signed in — verify two-factor to continue");
      navigate({ to: "/mfa", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    if (!supabaseConfigured) {
      toast.error("Password reset needs Supabase environment variables.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Password reset link sent. Check your email.");
      setView("signin");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reset link");
    } finally {
      setBusy(false);
    }
  }

  function continueLocalPreview() {
    enableLocalPreview();
    toast.success("Local preview enabled");
    window.location.assign("/app/tasks");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-[var(--shadow-md)]">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            Tally <span className="text-accent-dark">CRM</span>
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            {view === "signin" ? "Sign in to your workspace" : "Reset your password"}
          </p>
        </div>

        {!supabaseConfigured ? (
          <div className="mb-5 rounded-lg border border-warning/30 bg-warning-light px-4 py-3 text-sm text-warning">
            <p className="font-semibold">Supabase is not configured</p>
            <p className="mt-1 text-text-secondary">
              Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to enable real sign-in.
            </p>
            <button
              type="button"
              onClick={continueLocalPreview}
              className="mt-3 w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-dark"
            >
              Continue local preview
            </button>
          </div>
        ) : null}

        {view === "signin" ? (
          <form onSubmit={handleSignIn} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-text-secondary">Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-text-secondary">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 pr-16 text-sm focus:border-primary focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-2 my-auto h-7 rounded px-2 text-xs font-semibold text-text-secondary hover:text-foreground"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-text-secondary">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                Remember me
              </label>
              <button
                type="button"
                onClick={() => setView("forgot")}
                className="font-semibold text-primary hover:underline"
              >
                Forgot password?
              </button>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary-dark disabled:opacity-50"
            >
              {busy ? "Please wait…" : "Sign in"}
            </button>
            <Link
              to="/"
              hash="contact"
              className="block w-full rounded-lg border border-border bg-transparent px-4 py-2.5 text-center text-sm font-semibold text-foreground transition hover:bg-muted"
            >
              Request access
            </Link>
          </form>
        ) : (
          <form onSubmit={handleForgot} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-text-secondary">Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary-dark disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send reset link"}
            </button>
            <button
              type="button"
              onClick={() => setView("signin")}
              className="w-full rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted"
            >
              Back to sign in
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-text-secondary">
          <Link to="/" className="hover:text-primary">
            ← Back to landing
          </Link>
        </p>
      </div>
    </div>
  );
}
