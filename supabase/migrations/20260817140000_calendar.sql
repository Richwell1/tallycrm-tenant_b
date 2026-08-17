-- Calendar events. User-created events share a month view with existing dated CRM records.

DO $$ BEGIN
  CREATE TYPE public.calendar_event_type AS ENUM ('meeting','call','demo','deadline','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (TRIM(title) <> ''),
  description TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  all_day BOOLEAN NOT NULL DEFAULT false,
  event_type public.calendar_event_type NOT NULL DEFAULT 'other',
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  origin_node_id UUID REFERENCES public.sync_nodes(id) ON DELETE SET NULL,
  last_modified_by UUID,
  CONSTRAINT calendar_events_valid_range CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

CREATE INDEX IF NOT EXISTS calendar_events_range_idx
  ON public.calendar_events (starts_at, ends_at);
CREATE INDEX IF NOT EXISTS calendar_events_company_idx
  ON public.calendar_events (company_id);
CREATE INDEX IF NOT EXISTS calendar_events_contact_idx
  ON public.calendar_events (contact_id);
CREATE INDEX IF NOT EXISTS calendar_events_assigned_idx
  ON public.calendar_events (assigned_to);
CREATE INDEX IF NOT EXISTS calendar_events_updated_at_idx
  ON public.calendar_events (updated_at);

CREATE OR REPLACE FUNCTION public.calendar_events_before_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.title := TRIM(NEW.title);
  NEW.description := NULLIF(TRIM(COALESCE(NEW.description, '')), '');
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(auth.uid(), NEW.created_by);
    NEW.assigned_to := COALESCE(NEW.assigned_to, auth.uid());
  END IF;
  NEW.last_modified_by := COALESCE(auth.uid(), NEW.last_modified_by);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.calendar_events_before_write() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calendar_events_before_write() TO service_role;

DROP TRIGGER IF EXISTS calendar_events_before_write ON public.calendar_events;
CREATE TRIGGER calendar_events_before_write
  BEFORE INSERT OR UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.calendar_events_before_write();

DROP TRIGGER IF EXISTS set_updated_at_calendar_events ON public.calendar_events;
CREATE TRIGGER set_updated_at_calendar_events
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

REVOKE ALL ON public.calendar_events FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_events TO authenticated;
GRANT ALL ON public.calendar_events TO service_role;

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "calendar_events_select_scoped" ON public.calendar_events;
CREATE POLICY "calendar_events_select_scoped" ON public.calendar_events
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR assigned_to = auth.uid()
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS "calendar_events_insert_scoped" ON public.calendar_events;
CREATE POLICY "calendar_events_insert_scoped" ON public.calendar_events
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager')
      OR assigned_to IS NULL
      OR assigned_to = auth.uid()
    )
  );

DROP POLICY IF EXISTS "calendar_events_update_scoped" ON public.calendar_events;
CREATE POLICY "calendar_events_update_scoped" ON public.calendar_events
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR assigned_to = auth.uid()
    OR created_by = auth.uid()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR assigned_to = auth.uid()
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS "calendar_events_delete_manager_admin" ON public.calendar_events;
CREATE POLICY "calendar_events_delete_manager_admin" ON public.calendar_events
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

NOTIFY pgrst, 'reload schema';
