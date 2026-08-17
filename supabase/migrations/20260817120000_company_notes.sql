-- Company notes. Small free-text notes attached to company records.

CREATE TABLE IF NOT EXISTS public.company_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (TRIM(body) <> ''),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  origin_node_id UUID REFERENCES public.sync_nodes(id) ON DELETE SET NULL,
  last_modified_by UUID
);

CREATE INDEX IF NOT EXISTS company_notes_company_created_idx
  ON public.company_notes (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS company_notes_updated_at_idx
  ON public.company_notes (updated_at);

CREATE OR REPLACE FUNCTION public.company_notes_before_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.body := TRIM(NEW.body);
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(auth.uid(), NEW.created_by);
  END IF;
  NEW.last_modified_by := COALESCE(auth.uid(), NEW.last_modified_by);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.company_notes_before_write() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.company_notes_before_write() TO service_role;

DROP TRIGGER IF EXISTS company_notes_before_write ON public.company_notes;
CREATE TRIGGER company_notes_before_write
  BEFORE INSERT OR UPDATE ON public.company_notes
  FOR EACH ROW EXECUTE FUNCTION public.company_notes_before_write();

DROP TRIGGER IF EXISTS set_updated_at_company_notes ON public.company_notes;
CREATE TRIGGER set_updated_at_company_notes
  BEFORE UPDATE ON public.company_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

REVOKE ALL ON public.company_notes FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_notes TO authenticated;
GRANT ALL ON public.company_notes TO service_role;

ALTER TABLE public.company_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_notes_select_scoped" ON public.company_notes;
CREATE POLICY "company_notes_select_scoped"
  ON public.company_notes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.companies company
      WHERE company.id = company_notes.company_id
        AND company.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "company_notes_insert_scoped" ON public.company_notes;
CREATE POLICY "company_notes_insert_scoped"
  ON public.company_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.companies company
      WHERE company.id = company_notes.company_id
        AND company.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "company_notes_update_scoped" ON public.company_notes;
CREATE POLICY "company_notes_update_scoped"
  ON public.company_notes
  FOR UPDATE
  TO authenticated
  USING (
    (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager')
      OR created_by = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM public.companies company
      WHERE company.id = company_notes.company_id
        AND company.deleted_at IS NULL
    )
  )
  WITH CHECK (
    (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager')
      OR created_by = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM public.companies company
      WHERE company.id = company_notes.company_id
        AND company.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "company_notes_delete_manager_admin" ON public.company_notes;
CREATE POLICY "company_notes_delete_manager_admin"
  ON public.company_notes
  FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  );

NOTIFY pgrst, 'reload schema';
