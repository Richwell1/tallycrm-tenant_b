-- The public landing page submits through the trusted server handler, not
-- directly from the browser. Keep anon/authenticated blocked, but allow the
-- server-side service role to execute the SECURITY DEFINER capture function.
GRANT EXECUTE ON FUNCTION public.capture_landing_lead(text,text,text,text,text,text,text) TO service_role;
