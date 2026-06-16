
-- 1. app_settings: restrict SELECT to admin/manager
DROP POLICY IF EXISTS app_settings_read_all ON public.app_settings;
CREATE POLICY app_settings_read_admins ON public.app_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- 2. audit_log: restrict INSERT to service_role only
DROP POLICY IF EXISTS al_insert ON public.audit_log;
REVOKE INSERT ON public.audit_log FROM authenticated, anon;

-- 3. deal_stage_history: restrict SELECT
DROP POLICY IF EXISTS dsh_select ON public.deal_stage_history;
CREATE POLICY dsh_select ON public.deal_stage_history
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'manager')
    OR EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_id AND d.assigned_to = auth.uid())
  );

-- 4. deal_value_history: restrict SELECT
DROP POLICY IF EXISTS dvh_select ON public.deal_value_history;
CREATE POLICY dvh_select ON public.deal_value_history
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'manager')
    OR EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_id AND d.assigned_to = auth.uid())
  );

-- 5. lead_status_history: restrict SELECT
DROP POLICY IF EXISTS lead_status_history_read_all ON public.lead_status_history;
CREATE POLICY lead_status_history_read ON public.lead_status_history
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'manager')
    OR EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.assigned_to = auth.uid())
  );

-- 6. Revoke EXECUTE on internal SECURITY DEFINER functions from anon/authenticated.
--    Keep has_role / automation_rule_* / current_role_label executable as they are used in RLS.
REVOKE EXECUTE ON FUNCTION public.cron_daily_digest() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cron_reminder_dispatch() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cron_sla_monitor() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cron_reengagement_sweep() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_automation_run(text,text,uuid,text,text,text,text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_audit_system(text,text,uuid,text,jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.queue_email(text,text,text,jsonb,text,uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_user(uuid,text,text,text,text,uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_auto_task(text,text,numeric,uuid,uuid,uuid,numeric,task_priority) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_deal_stage_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_lead_stage_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_deal_value_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.capture_landing_lead(text,text,text,text,text,text,text) FROM anon, authenticated;
