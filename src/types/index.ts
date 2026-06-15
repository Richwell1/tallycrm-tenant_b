// Shared CRM types. Database-backed entity shapes will land in feature 1
// alongside the Supabase schema; for now these cover what shared components need.

export type Role = "admin" | "manager" | "rep";

export interface CurrentUser {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string | null;
  role: Role;
}

export interface Breadcrumb {
  label: string;
  to?: string;
}

// Canonical async hook shape used by every data hook in the app.
export interface QueryResult<T> {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  refetch?: () => void;
}

export interface MutationResult<TVars, TData = unknown> {
  mutate: (vars: TVars) => void;
  mutateAsync: (vars: TVars) => Promise<TData>;
  isPending: boolean;
  isError: boolean;
  error?: unknown;
}
