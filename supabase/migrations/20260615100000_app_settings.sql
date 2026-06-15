
-- =========================================================
-- app_settings  (singleton — one row for the whole workspace)
-- =========================================================
CREATE TABLE public.app_settings (
  id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crm_name                       TEXT NOT NULL DEFAULT 'Tally CRM Sales',
  default_currency               TEXT NOT NULL DEFAULT 'GHS',
  timezone                       TEXT NOT NULL DEFAULT 'GMT',
  date_format                    TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
  language                       TEXT NOT NULL DEFAULT 'English (United States)',
  logo_url                       TEXT,
  -- email / notification provider
  email_provider                 TEXT NOT NULL DEFAULT 'Resend',
  from_name                      TEXT NOT NULL DEFAULT 'Tally CRM Sales',
  from_email                     TEXT NOT NULL DEFAULT 'sales@tallycrm.io',
  -- notification matrix toggles
  notif_new_lead_email           BOOLEAN NOT NULL DEFAULT TRUE,
  notif_new_lead_app             BOOLEAN NOT NULL DEFAULT TRUE,
  notif_deal_stage_email         BOOLEAN NOT NULL DEFAULT TRUE,
  notif_deal_stage_app           BOOLEAN NOT NULL DEFAULT TRUE,
  notif_sla_email                BOOLEAN NOT NULL DEFAULT TRUE,
  notif_sla_app                  BOOLEAN NOT NULL DEFAULT TRUE,
  notif_digest_email             BOOLEAN NOT NULL DEFAULT TRUE,
  notif_digest_app               BOOLEAN NOT NULL DEFAULT FALSE,
  -- lead assignment
  assignment_strategy            TEXT NOT NULL DEFAULT 'round_robin',
  updated_at                     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the singleton row
INSERT INTO public.app_settings (id) VALUES ('00000000-0000-0000-0000-000000000001')
  ON CONFLICT (id) DO NOTHING;

-- RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.app_settings TO authenticated;
GRANT UPDATE ON public.app_settings TO authenticated;

-- Anyone authenticated can read settings; only admins can write
CREATE POLICY "app_settings_select_authenticated" ON public.app_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "app_settings_update_admin" ON public.app_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- updated_at auto-trigger
CREATE TRIGGER app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
