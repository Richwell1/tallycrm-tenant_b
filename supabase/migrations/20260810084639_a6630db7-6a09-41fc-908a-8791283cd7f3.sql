-- Repair: restore public.is_rep_owned_insert(), lost to a partially applied
-- security-hardening migration (20260616120000_feature_2_security_rls_hardening.sql).
-- public.quotes_before_insert() calls it, so every quote insert aborts without it.
-- Definition copied verbatim from the approved original migration.

CREATE OR REPLACE FUNCTION public.is_rep_owned_insert()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND NOT public.has_role(auth.uid(), 'admin')
    AND NOT public.has_role(auth.uid(), 'manager')
$$;

-- Least privilege: the only caller is a SECURITY DEFINER trigger function that
-- executes as its owner, so no client role needs EXECUTE.
REVOKE ALL ON FUNCTION public.is_rep_owned_insert() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_rep_owned_insert() FROM anon;
REVOKE ALL ON FUNCTION public.is_rep_owned_insert() FROM authenticated;