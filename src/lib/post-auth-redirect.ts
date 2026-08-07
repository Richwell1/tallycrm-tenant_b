const KEY = "tally-crm.post-auth-redirect";

/** Remember a same-origin relative path to return to once sign-in + 2FA finish. */
export function setPostAuthRedirect(path: string) {
  if (typeof window === "undefined") return;
  if (!path.startsWith("/") || path.startsWith("//")) return;
  window.sessionStorage.setItem(KEY, path);
}

/** Read and clear the stored return path, if any. */
export function consumePostAuthRedirect(): string | null {
  if (typeof window === "undefined") return null;
  const value = window.sessionStorage.getItem(KEY);
  window.sessionStorage.removeItem(KEY);
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}
