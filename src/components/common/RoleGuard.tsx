import type { ReactNode } from "react";
import { useCurrentRole } from "@/lib/auth-context";
import type { Role } from "@/types";

interface RoleGuardProps {
  allow: Role[];
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Hides UI from roles that don't have access. This is a UX affordance only —
 * Supabase RLS is the actual security boundary (enforced server-side, feature 2).
 */
export function RoleGuard({ allow, children, fallback = null }: RoleGuardProps) {
  const role = useCurrentRole();
  if (!role || !allow.includes(role)) return <>{fallback}</>;
  return <>{children}</>;
}
