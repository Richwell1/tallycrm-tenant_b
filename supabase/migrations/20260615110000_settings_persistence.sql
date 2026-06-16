-- Settings persistence gaps: integrations, invites, assignment queue, automations.

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS email_api_key_masked TEXT NOT NULL DEFAULT 're_xxxxxxxxxxxxxxxxxxxx',
  ADD COLUMN IF NOT EXISTS landing_api_key TEXT NOT NULL DEFAULT 'sb_publishable_xxxxxxxxxxxxxxxxxxxx',
  ADD COLUMN IF NOT EXISTS landing_last_test_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS landing_last_test_status TEXT,
  ADD COLUMN IF NOT EXISTS landing_response_log JSONB NOT NULL DEFAULT '[]'::jsonb;
GRANT INSERT ON public.app_settings TO authenticated;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'app_settings'
      AND policyname = 'app_settings_insert_admin'
  ) THEN
    CREATE POLICY "app_settings_insert_admin" ON public.app_settings
      FOR INSERT TO authenticated
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

CREATE TABLE IF NOT EXISTS public.user_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role public.app_role NOT NULL DEFAULT 'rep',
  status TEXT NOT NULL DEFAULT 'pending_2fa',
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_invites TO authenticated;
GRANT ALL ON public.user_invites TO service_role;
ALTER TABLE public.user_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_invites_admin_all" ON public.user_invites
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP TRIGGER IF EXISTS set_updated_at_user_invites ON public.user_invites;
CREATE TRIGGER set_updated_at_user_invites
  BEFORE UPDATE ON public.user_invites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.lead_assignment_queue (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  position INT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.lead_assignment_queue TO authenticated;
GRANT ALL ON public.lead_assignment_queue TO service_role;
ALTER TABLE public.lead_assignment_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lead_assignment_queue_read_all" ON public.lead_assignment_queue
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "lead_assignment_queue_admin_write" ON public.lead_assignment_queue
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP TRIGGER IF EXISTS set_updated_at_lead_assignment_queue ON public.lead_assignment_queue;
CREATE TRIGGER set_updated_at_lead_assignment_queue
  BEFORE UPDATE ON public.lead_assignment_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.automation_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  trigger_type TEXT NOT NULL,
  trigger_label TEXT NOT NULL,
  trigger_icon TEXT NOT NULL DEFAULT 'bolt',
  object TEXT NOT NULL,
  condition TEXT NOT NULL DEFAULT '',
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  is_default BOOLEAN NOT NULL DEFAULT false,
  owner TEXT NOT NULL DEFAULT 'Admin',
  success_rate NUMERIC NOT NULL DEFAULT 0,
  audit_logged BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_run_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_rules TO authenticated;
GRANT ALL ON public.automation_rules TO service_role;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automation_rules_read_all" ON public.automation_rules
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "automation_rules_admin_write" ON public.automation_rules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP TRIGGER IF EXISTS set_updated_at_automation_rules ON public.automation_rules;
CREATE TRIGGER set_updated_at_automation_rules
  BEFORE UPDATE ON public.automation_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id TEXT REFERENCES public.automation_rules(id) ON DELETE SET NULL,
  record_name TEXT NOT NULL,
  record_type TEXT NOT NULL,
  action_taken TEXT NOT NULL,
  result TEXT NOT NULL DEFAULT 'success',
  duration_ms INT NOT NULL DEFAULT 0,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.automation_runs TO authenticated;
GRANT ALL ON public.automation_runs TO service_role;
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automation_runs_read_all" ON public.automation_runs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "automation_runs_admin_insert" ON public.automation_runs
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
