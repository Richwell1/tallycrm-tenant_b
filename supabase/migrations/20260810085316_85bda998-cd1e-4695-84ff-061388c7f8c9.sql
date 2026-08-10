-- Least privilege: revise_quote is a signed-in action only. It is SECURITY INVOKER
-- so RLS already blocked anon, but the EXECUTE grant should not exist.
REVOKE ALL ON FUNCTION public.revise_quote(UUID) FROM anon;