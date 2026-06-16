ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS crm_name TEXT NOT NULL DEFAULT 'Tally CRM',
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS date_format TEXT NOT NULL DEFAULT 'YYYY-MM-DD',
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS assignment_strategy TEXT NOT NULL DEFAULT 'round_robin',
  ADD COLUMN IF NOT EXISTS email_provider TEXT NOT NULL DEFAULT 'resend',
  ADD COLUMN IF NOT EXISTS from_name TEXT NOT NULL DEFAULT 'Tally CRM',
  ADD COLUMN IF NOT EXISTS from_email TEXT NOT NULL DEFAULT 'no-reply@example.com',
  ADD COLUMN IF NOT EXISTS notif_new_lead_email BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_new_lead_app BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_deal_stage_email BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_deal_stage_app BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_sla_email BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_sla_app BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_digest_email BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_digest_app BOOLEAN NOT NULL DEFAULT true;

-- Backfill crm_name from existing company_name where appropriate
UPDATE public.app_settings SET crm_name = COALESCE(NULLIF(crm_name,''), company_name, 'Tally CRM');

ALTER TABLE public.notifications
  ALTER COLUMN deleted_at SET DEFAULT NULL;
