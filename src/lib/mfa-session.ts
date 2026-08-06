const MFA_SESSION_KEY = "tally-crm-mfa-session";
const MFA_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

interface StoredMfaSession {
  userId: string;
  verifiedAt: number;
  lastSeenAt: number;
}

function readMfaSession(): StoredMfaSession | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(MFA_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredMfaSession>;
    if (
      typeof parsed.userId !== "string" ||
      typeof parsed.verifiedAt !== "number" ||
      typeof parsed.lastSeenAt !== "number"
    ) {
      return null;
    }
    return parsed as StoredMfaSession;
  } catch {
    return null;
  }
}

export function clearMfaSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(MFA_SESSION_KEY);
}

export function markMfaVerified(userId: string) {
  if (typeof window === "undefined") return;
  const now = Date.now();
  const session: StoredMfaSession = {
    userId,
    verifiedAt: now,
    lastSeenAt: now,
  };
  window.localStorage.setItem(MFA_SESSION_KEY, JSON.stringify(session));
}

export function hasFreshMfaSession(userId: string) {
  const session = readMfaSession();
  if (!session || session.userId !== userId) return false;
  return Date.now() - session.lastSeenAt <= MFA_SESSION_TTL_MS;
}

export function touchMfaSession(userId: string) {
  const session = readMfaSession();
  if (!session || session.userId !== userId) return;
  if (!hasFreshMfaSession(userId)) {
    clearMfaSession();
    return;
  }
  window.localStorage.setItem(
    MFA_SESSION_KEY,
    JSON.stringify({
      ...session,
      lastSeenAt: Date.now(),
    }),
  );
}
