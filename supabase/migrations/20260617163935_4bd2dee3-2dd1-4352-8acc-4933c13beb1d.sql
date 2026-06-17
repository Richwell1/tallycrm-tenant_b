
-- Tighten RLS on automation_runs: only admins/managers can see runs; writes via SECURITY DEFINER log_automation_run only
DROP POLICY IF EXISTS "automation_runs_read_all" ON public.automation_runs;
DROP POLICY IF EXISTS "automation_runs_service_insert" ON public.automation_runs;
DROP POLICY IF EXISTS "automation_runs_admin_all" ON public.automation_runs;

CREATE POLICY "automation_runs_admin_select" ON public.automation_runs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

-- No INSERT/UPDATE/DELETE policy for authenticated users — service_role and SECURITY DEFINER functions still work.

-- Tighten RLS on lead_assignment_queue: only admins/managers
DROP POLICY IF EXISTS "lead_assignment_queue_read_all" ON public.lead_assignment_queue;
DROP POLICY IF EXISTS "lead_assignment_queue_admin_write" ON public.lead_assignment_queue;
DROP POLICY IF EXISTS "lead_assignment_queue_admin_all" ON public.lead_assignment_queue;

CREATE POLICY "lead_assignment_queue_admin_all" ON public.lead_assignment_queue
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

-- Lock down SECURITY DEFINER functions: revoke broad EXECUTE, grant only those needed by clients
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;

-- Re-grant EXECUTE only for functions intentionally callable by clients
-- set_user_role is admin-only but invoked by an authenticated admin; the function itself enforces the admin check.
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, app_role) TO authenticated;
-- has_role is used inside RLS policies; policies run as the table-querying role, so authenticated needs EXECUTE.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, anon;
-- current_role_label is used by client UI to read the signed-in user's role label.
GRANT EXECUTE ON FUNCTION public.current_role_label() TO authenticated;
