
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS value numeric,
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS expected_close_date date;

-- Allow authenticated users to read minimal profile info for assignment dropdown.
-- Use existing profiles table if present; otherwise this is a no-op safe statement.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles') THEN
    EXECUTE 'GRANT SELECT ON public.profiles TO authenticated';
  END IF;
END$$;
