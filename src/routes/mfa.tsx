import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userRes.user) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      setEmail(userRes.user.email ?? "");

      const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal.data?.currentLevel === "aal2") {
        navigate({ to: "/app", replace: true });
        return;
      }

      const { data: factors, error: listErr } = await supabase.auth.mfa.listFactors();
      if (listErr) throw listErr;
      const verified = factors?.totp?.find((f) => f.status === "verified");
      if (verified) {
        setFactorId(verified.id);
        setMode("verify");
        return;
      }
      // Reuse first unverified factor (avoid hitting Supabase's factor cap on repeated visits)
      const unverified = factors?.totp?.filter((f) => f.status !== "verified") ?? [];
      const reuse = unverified[0];
      if (reuse) {
        // We don't have the QR for an existing unverified factor, so unenroll and re-enroll.
        for (const f of unverified) {
          await supabase.auth.mfa.unenroll({ factorId: f.id });
        }
      }
      setMode("enroll");
      await beginEnrollment();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not initialise two-factor setup";
      console.error("[mfa] init failed", err);
      setErrorMsg(msg);
      setMode("enroll"); // give the user a retry button
    }
  }

  async function beginEnrollment() {
    setEnrollBusy(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Tally CRM (${new Date().toISOString().slice(0, 10)})`,
      });
      if (error || !data) {
        throw error ?? new Error("Enrollment failed");
      }
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
      toast.success(mode === "enroll" ? "Two-factor enrolled" : "Verified");
      navigate({ to: "/app", replace: true });
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
      for (const f of factors?.totp ?? []) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-[var(--shadow-md)]">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            Tally <span className="text-accent-dark">CRM</span>
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            {mode === "verify"
              ? "Enter your 6-digit authenticator code"
              : "Set up two-factor authentication"}
          </p>
          {email ? <p className="mt-1 text-xs text-text-muted">{email}</p> : null}
        </div>

        {mode === "loading" ? (
          <p className="py-8 text-center text-sm text-text-secondary">Loading…</p>
        ) : null}

        {errorMsg ? (
          <div className="mb-4 rounded-lg border border-danger/30 bg-danger-light px-4 py-3 text-sm text-danger">
            <p className="font-semibold">Something went wrong</p>
            <p className="mt-1 text-text-secondary">{errorMsg}</p>
          </div>
        ) : null}

        {mode === "enroll" ? (
          enrollBusy && !enrollData ? (
            <p className="py-8 text-center text-sm text-text-secondary">
              Generating your QR code…
            </p>
          ) : enrollData ? (
            <div className="space-y-4">
              <ol className="list-decimal space-y-1 pl-5 text-sm text-text-secondary">
                <li>Install Google Authenticator, Authy, or 1Password.</li>
                <li>Scan the QR code below (or enter the key manually).</li>
                <li>Enter the 6-digit code the app generates to finish setup.</li>
              </ol>
              <div className="flex justify-center rounded-xl border border-border bg-white p-4">
                <div
                  className="h-44 w-44"
                  dangerouslySetInnerHTML={{ __html: enrollData.qrSvg }}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-text-secondary">
                  Manual setup key
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 select-all break-all rounded-lg border border-border bg-muted px-3 py-2 font-mono text-xs">
                    {enrollData.secret}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(enrollData.secret);
                      toast.success("Secret copied");
                    }}
                    className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"
                  >
                    Copy
                  </button>
                </div>
                <p className="mt-2 rounded-lg border border-warning/30 bg-warning-light px-3 py-2 text-xs text-warning">
                  Save this key somewhere safe. If you lose your device, an admin can reset 2FA so
                  you can enroll a new authenticator.
                </p>
              </div>
              <CodeForm
                code={code}
                setCode={setCode}
                busy={busy}
                onSubmit={handleVerify}
                label="Activate 2FA"
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
              label="Verify"
            />
            <div className="flex flex-col gap-2 text-center text-xs">
              <button
                type="button"
                onClick={handleResetFactor}
                disabled={busy}
                className="text-primary hover:underline disabled:opacity-50"
              >
                Lost your device? Re-enroll a new authenticator
              </button>
              <p className="text-text-muted">
                If you can't re-enroll, ask an admin to reset 2FA from Users & Roles.
              </p>
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-between text-xs">
          <button onClick={handleSignOut} className="text-text-secondary hover:text-foreground">
            Sign out
          </button>
          <Link to="/auth" className="text-text-secondary hover:text-foreground">
            ← Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

function CodeForm({
  code,
  setCode,
  busy,
  onSubmit,
  label,
}: {
  code: string;
  setCode: (v: string) => void;
  busy: boolean;
  onSubmit: (e: React.FormEvent) => void;
  label: string;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-semibold text-text-secondary">
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
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-center font-mono text-lg tracking-[0.4em] focus:border-primary focus:outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={busy || code.length !== 6}
        className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary-dark disabled:opacity-50"
      >
        {busy ? "Verifying…" : label}
      </button>
    </form>
  );
}
