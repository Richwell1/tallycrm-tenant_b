-- Warehouse locations module (tenant_b). Sites goods are dispatched from.

CREATE TABLE IF NOT EXISTS public.warehouse_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE CHECK (TRIM(code) <> ''),
  name TEXT NOT NULL CHECK (TRIM(name) <> ''),
  address TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  origin_node_id UUID REFERENCES public.sync_nodes(id) ON DELETE SET NULL,
  last_modified_by UUID
);

CREATE INDEX IF NOT EXISTS warehouse_locations_active_name_idx
  ON public.warehouse_locations (is_active, name);
CREATE INDEX IF NOT EXISTS warehouse_locations_updated_at_idx
  ON public.warehouse_locations (updated_at);

CREATE OR REPLACE FUNCTION public.warehouse_locations_before_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.code := UPPER(TRIM(NEW.code));
  NEW.name := TRIM(NEW.name);
  NEW.address := NULLIF(TRIM(COALESCE(NEW.address, '')), '');
  NEW.contact_name := NULLIF(TRIM(COALESCE(NEW.contact_name, '')), '');
  NEW.contact_phone := NULLIF(TRIM(COALESCE(NEW.contact_phone, '')), '');
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(auth.uid(), NEW.created_by);
  END IF;
  NEW.last_modified_by := COALESCE(auth.uid(), NEW.last_modified_by);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.warehouse_locations_before_write() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.warehouse_locations_before_write() TO service_role;

DROP TRIGGER IF EXISTS warehouse_locations_before_write ON public.warehouse_locations;
CREATE TRIGGER warehouse_locations_before_write
  BEFORE INSERT OR UPDATE ON public.warehouse_locations
  FOR EACH ROW EXECUTE FUNCTION public.warehouse_locations_before_write();

DROP TRIGGER IF EXISTS set_updated_at_warehouse_locations ON public.warehouse_locations;
CREATE TRIGGER set_updated_at_warehouse_locations
  BEFORE UPDATE ON public.warehouse_locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

REVOKE ALL ON public.warehouse_locations FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouse_locations TO authenticated;
GRANT ALL ON public.warehouse_locations TO service_role;
ALTER TABLE public.warehouse_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "warehouse_locations_select_scoped" ON public.warehouse_locations;
CREATE POLICY "warehouse_locations_select_scoped" ON public.warehouse_locations
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
    OR is_active OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS "warehouse_locations_insert_scoped" ON public.warehouse_locations;
CREATE POLICY "warehouse_locations_insert_scoped" ON public.warehouse_locations
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "warehouse_locations_update_scoped" ON public.warehouse_locations;
CREATE POLICY "warehouse_locations_update_scoped" ON public.warehouse_locations
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
    OR created_by = auth.uid()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS "warehouse_locations_delete_manager_admin" ON public.warehouse_locations;
CREATE POLICY "warehouse_locations_delete_manager_admin" ON public.warehouse_locations
  FOR DELETE TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
  );

NOTIFY pgrst, 'reload schema';
