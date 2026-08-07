import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { hasFreshMfaSession, markMfaVerified } from "@/lib/mfa-session";
import { consumePostAuthRedirect } from "@/lib/post-auth-redirect";
import { toast } from "sonner";
import {
  ShieldCheck,
  Copy as CopyIcon,
  Info,
  LogOut,
  ArrowLeft,
  Loader2,
  AlertCircle,
  KeyRound,
} from "lucide-react";

export const Route = createFileRoute("/mfa")({
  ssr: false,
  head: () => ({ meta: [{ title: "Two-factor authentication — Tally CRM" }] }),
  component: MfaPage,
});

type Mode = "loading" | "verify" | "enroll";

interface EnrollData {
  factorId: string;
  qrSvg: string;
  secret: string;
  uri: string;
}

function MfaPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("loading");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [enrollData, setEnrollData] = useState<EnrollData | null>(null);
  const [email, setEmail] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [enrollBusy, setEnrollBusy] = useState(false);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    if (!isSupabaseConfigured()) {
      navigate({ to: "/auth", replace: true });
      return;
    }
    void initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function initialize() {
    setErrorMsg(null);
    try {
      const { data: sessionRes } = await supabase.auth.getSession();
      if (!sessionRes.session) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      // Run user, AAL, and factor list in parallel — much faster than sequential.
      const [userRes, aalRes, factorsRes] = await Promise.all([
        supabase.auth.getUser(),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.auth.mfa.listFactors(),
      ]);

      if (userRes.error || !userRes.data.user) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      setEmail(userRes.data.user.email ?? "");

      if (aalRes.data?.currentLevel === "aal2" && hasFreshMfaSession(userRes.data.user.id)) {
        const back = consumePostAuthRedirect();
        if (back) window.location.replace(back);
        else navigate({ to: "/app", replace: true });
        return;
      }


      if (factorsRes.error) throw factorsRes.error;
      const verified = factorsRes.data?.totp?.find((f) => f.status === "verified");
      if (verified) {
        setFactorId(verified.id);
        setMode("verify");
        return;
      }
      // Wipe leftover unverified factors so enroll never hits a name/cap conflict.
      const unverified = factorsRes.data?.totp?.filter((f) => f.status !== "verified") ?? [];
      await Promise.all(unverified.map((f) => supabase.auth.mfa.unenroll({ factorId: f.id })));
      setMode("enroll");
      await beginEnrollment();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not initialise two-factor setup";
      console.error("[mfa] init failed", err);
      setErrorMsg(msg);
      setMode("enroll");
    }
  }

  async function beginEnrollment() {
    setEnrollBusy(true);
    setErrorMsg(null);
    try {
      const friendlyName = `Tally CRM ${Date.now()}`;
      let { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName,
      });
      if (error && (error as { code?: string }).code === "mfa_factor_name_conflict") {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        await Promise.all(
          (factors?.totp ?? [])
            .filter((f) => f.status !== "verified")
            .map((f) => supabase.auth.mfa.unenroll({ factorId: f.id })),
        );
        const retry = await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: `Tally CRM ${Date.now()}`,
        });
        data = retry.data;
        error = retry.error;
      }
      if (error || !data) throw error ?? new Error("Enrollment failed");
      setEnrollData({
        factorId: data.id,
        qrSvg: data.totp.qr_code,
        secret: data.totp.secret,
        uri: data.totp.uri,
      });
      setFactorId(data.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not start 2FA enrollment";
      console.error("[mfa] enroll failed", err);
      setErrorMsg(msg);
    } finally {
      setEnrollBusy(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) throw challenge.error;
      const verify = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code: code.trim(),
      });
      if (verify.error) throw verify.error;
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user?.id) {
        markMfaVerified(userData.user.id);
        await supabase
          .from("profiles")
          .update({ status: "active", last_login_at: new Date().toISOString() })
          .eq("id", userData.user.id);
      }
      toast.success(mode === "enroll" ? "Two-factor enrolled" : "Verified");
      const back = consumePostAuthRedirect();
      if (back) window.location.replace(back);
      else navigate({ to: "/app", replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid or expired code";
      toast.error(msg);
      setErrorMsg(msg);
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  async function handleResetFactor() {
    if (!confirm("Remove your current authenticator and enroll a new one?")) return;
    setBusy(true);
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      await Promise.all(
        (factors?.totp ?? []).map((f) => supabase.auth.mfa.unenroll({ factorId: f.id })),
      );
      setFactorId(null);
      setEnrollData(null);
      setMode("enroll");
      await beginEnrollment();
      toast.success("Previous factor removed. Scan the new QR code.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  function copySecret() {
    if (!enrollData) return;
    navigator.clipboard.writeText(enrollData.secret);
    toast.success("Key copied to clipboard");
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-background via-background to-muted/40">
      {/* Header */}
      <header className="border-b border-border/60 bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <span className="text-lg font-bold tracking-tight text-foreground">
              Tally<span className="text-primary">CRM</span>
            </span>
          </div>
          {email ? (
            <span className="hidden text-xs text-text-secondary sm:block">{email}</span>
          ) : null}
        </div>
      </header>

      {/* Main */}
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-md)]">
            {/* Title strip */}
            <div className="border-b border-border bg-gradient-to-r from-primary/10 via-surface to-surface px-7 py-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  {mode === "verify" ? (
                    <KeyRound className="h-5 w-5" />
                  ) : (
                    <ShieldCheck className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground">
                    {mode === "verify" ? "Two-Factor Authentication" : "Secure Your Account"}
                  </h1>
                  <p className="mt-1 text-sm text-text-secondary">
                    {mode === "verify"
                      ? "Enter the 6-digit code from your authenticator app to sign in."
                      : "Scan the QR code with Google Authenticator, Authy, or 1Password to enable 2FA."}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-7 py-6">
              {mode === "loading" ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-text-secondary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading…
                </div>
              ) : null}

              {errorMsg ? (
                <div className="mb-5 flex gap-2 rounded-lg border border-danger/30 bg-danger-light px-4 py-3 text-sm text-danger">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-semibold">Something went wrong</p>
                    <p className="mt-0.5 text-text-secondary">{errorMsg}</p>
                  </div>
                </div>
              ) : null}

              {mode === "enroll" ? (
                enrollBusy && !enrollData ? (
                  <div className="flex flex-col items-center gap-3 py-12 text-sm text-text-secondary">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    Generating your QR code…
                  </div>
                ) : enrollData ? (
                  <div className="space-y-5">
                    <div className="flex justify-center">
                      <div className="rounded-xl border border-border bg-white p-3 shadow-sm">
                        <img src={enrollData.qrSvg} alt="" className="h-44 w-44 block" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-semibold uppercase tracking-wide text-text-secondary">
                        Manual setup key
                      </label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 select-all break-all rounded-lg border border-border bg-muted px-3 py-2.5 font-mono text-xs">
                          {enrollData.secret}
                        </code>
                        <button
                          type="button"
                          onClick={copySecret}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2.5 text-xs font-semibold transition hover:bg-muted"
                        >
                          <CopyIcon className="h-3.5 w-3.5" />
                          Copy
                        </button>
                      </div>
                      <div className="mt-2.5 flex gap-2 rounded-lg border border-warning/30 bg-warning-light px-3 py-2 text-xs text-text-secondary">
                        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                        <span>
                          Save this key somewhere safe. If you lose your device, an admin can reset
                          2FA so you can enroll a new authenticator.
                        </span>
                      </div>
                    </div>

                    <CodeForm
                      code={code}
                      setCode={setCode}
                      busy={busy}
                      onSubmit={handleVerify}
                      label="Activate 2FA"
                      icon={<ShieldCheck className="h-4 w-4" />}
                    />
                  </div>
                ) : (
                  <div className="space-y-3 text-center">
                    <p className="text-sm text-text-secondary">
                      We couldn't generate your authenticator QR code.
                    </p>
                    <button
                      type="button"
                      onClick={() => beginEnrollment()}
                      className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-dark"
                    >
                      Try again
                    </button>
                  </div>
                )
              ) : null}

              {mode === "verify" ? (
                <div className="space-y-4">
                  <CodeForm
                    code={code}
                    setCode={setCode}
                    busy={busy}
                    onSubmit={handleVerify}
                    label="Verify & Sign In"
                    icon={<ShieldCheck className="h-4 w-4" />}
                  />
                  <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-center text-xs text-text-secondary">
                    <p className="font-semibold text-foreground">Lost access to your device?</p>
                    <p className="mt-1">
                      Ask an admin to reset 2FA from Users &amp; Roles, or{" "}
                      <button
                        type="button"
                        onClick={handleResetFactor}
                        disabled={busy}
                        className="font-semibold text-primary hover:underline disabled:opacity-50"
                      >
                        re-enroll a new authenticator
                      </button>
                      .
                    </p>
                  </div>
                </div>
              ) : null}

              {mode !== "loading" ? (
                <div className="mt-6 flex items-center justify-between border-t border-border pt-4 text-xs">
                  <button
                    onClick={handleSignOut}
                    className="inline-flex items-center gap-1.5 text-text-secondary transition hover:text-foreground"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sign out
                  </button>
                  <Link
                    to="/auth"
                    className="inline-flex items-center gap-1.5 text-text-secondary transition hover:text-foreground"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to sign in
                  </Link>
                </div>
              ) : null}
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-text-muted">
            Enterprise Security Standard • © {new Date().getFullYear()} Tally CRM
          </p>
        </div>
      </main>
    </div>
  );
}

function CodeForm({
  code,
  setCode,
  busy,
  onSubmit,
  label,
  icon,
}: {
  code: string;
  setCode: (v: string) => void;
  busy: boolean;
  onSubmit: (e: React.FormEvent) => void;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
          6-digit code
        </label>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          autoFocus
          autoComplete="one-time-code"
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="w-full rounded-lg border border-border bg-background px-3 py-3 text-center font-mono text-xl tracking-[0.5em] placeholder:text-text-muted/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>
      <button
        type="submit"
        disabled={busy || code.length !== 6}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Verifying…
          </>
        ) : (
          <>
            {icon}
            {label}
          </>
        )}
      </button>
    </form>
  );
}
