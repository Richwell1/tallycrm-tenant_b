-- App settings (singleton)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL DEFAULT 'Tally CRM',
  company_email TEXT,
  company_phone TEXT,
  company_address TEXT,
  logo_url TEXT,
  default_currency TEXT NOT NULL DEFAULT 'USD',
  time_zone TEXT NOT NULL DEFAULT 'UTC',
  email_api_key_masked TEXT NOT NULL DEFAULT 're_xxxxxxxxxxxxxxxxxxxx',
  landing_api_key TEXT NOT NULL DEFAULT 'sb_publishable_xxxxxxxxxxxxxxxxxxxx',
  landing_last_test_at TIMESTAMPTZ,
  landing_last_test_status TEXT,
  landing_response_log JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS company_name TEXT NOT NULL DEFAULT 'Tally CRM',
  ADD COLUMN IF NOT EXISTS company_email TEXT,
  ADD COLUMN IF NOT EXISTS company_phone TEXT,
  ADD COLUMN IF NOT EXISTS company_address TEXT,
  ADD COLUMN IF NOT EXISTS time_zone TEXT NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

GRANT SELECT, INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_settings_read_all" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_admin_write" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_insert_admin" ON public.app_settings;
CREATE POLICY "app_settings_read_all" ON public.app_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "app_settings_admin_write" ON public.app_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "app_settings_insert_admin" ON public.app_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));
DROP TRIGGER IF EXISTS set_updated_at_app_settings ON public.app_settings;
CREATE TRIGGER set_updated_at_app_settings
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- user_invites
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
DROP POLICY IF EXISTS "user_invites_admin_all" ON public.user_invites;
CREATE POLICY "user_invites_admin_all" ON public.user_invites
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
DROP TRIGGER IF EXISTS set_updated_at_user_invites ON public.user_invites;
CREATE TRIGGER set_updated_at_user_invites
  BEFORE UPDATE ON public.user_invites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- lead_assignment_queue
CREATE TABLE IF NOT EXISTS public.lead_assignment_queue (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  position INT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_assignment_queue TO authenticated;
GRANT ALL ON public.lead_assignment_queue TO service_role;
ALTER TABLE public.lead_assignment_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lead_assignment_queue_read_all" ON public.lead_assignment_queue;
DROP POLICY IF EXISTS "lead_assignment_queue_admin_write" ON public.lead_assignment_queue;
CREATE POLICY "lead_assignment_queue_read_all" ON public.lead_assignment_queue
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "lead_assignment_queue_admin_write" ON public.lead_assignment_queue
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
DROP TRIGGER IF EXISTS set_updated_at_lead_assignment_queue ON public.lead_assignment_queue;
CREATE TRIGGER set_updated_at_lead_assignment_queue
  BEFORE UPDATE ON public.lead_assignment_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- notifications.deleted_at
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- set_user_role admin RPC
CREATE OR REPLACE FUNCTION public.set_user_role(
  target_user_id UUID, target_role public.app_role
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Only admins may change user roles';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = target_user_id;
  INSERT INTO public.user_roles(user_id, role) VALUES (target_user_id, target_role);
END $$;
GRANT EXECUTE ON FUNCTION public.set_user_role(UUID, public.app_role) TO authenticated;

-- Seed a default app_settings row if empty
INSERT INTO public.app_settings(company_name)
SELECT 'Tally CRM' WHERE NOT EXISTS (SELECT 1 FROM public.app_settings);
