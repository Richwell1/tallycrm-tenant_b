-- Delivery notes module (tenant_b). Records goods or licences dispatched against invoices.

DO $$ BEGIN
  CREATE TYPE public.delivery_note_status AS ENUM ('draft','dispatched','delivered','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS delivery_note_number_prefix TEXT NOT NULL DEFAULT 'DN';

CREATE TABLE IF NOT EXISTS public.delivery_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_note_number TEXT NOT NULL UNIQUE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status public.delivery_note_status NOT NULL DEFAULT 'draft',
  recipient_name TEXT,
  delivery_address TEXT,
  carrier TEXT,
  tracking_reference TEXT,
  notes TEXT,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  dispatched_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  origin_node_id UUID REFERENCES public.sync_nodes(id) ON DELETE SET NULL,
  last_modified_by UUID
);

CREATE INDEX IF NOT EXISTS delivery_notes_invoice_idx
  ON public.delivery_notes (invoice_id, delivery_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS delivery_notes_status_idx
  ON public.delivery_notes (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS delivery_notes_company_idx ON public.delivery_notes (company_id);
CREATE INDEX IF NOT EXISTS delivery_notes_contact_idx ON public.delivery_notes (contact_id);
CREATE INDEX IF NOT EXISTS delivery_notes_assigned_idx ON public.delivery_notes (assigned_to);
CREATE INDEX IF NOT EXISTS delivery_notes_updated_at_idx ON public.delivery_notes (updated_at);

CREATE TABLE IF NOT EXISTS public.delivery_note_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_note_id UUID NOT NULL REFERENCES public.delivery_notes(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  catalog_item_id UUID REFERENCES public.quote_catalog_items(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  unit TEXT NOT NULL DEFAULT 'unit',
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  origin_node_id UUID REFERENCES public.sync_nodes(id) ON DELETE SET NULL,
  last_modified_by UUID
);

CREATE INDEX IF NOT EXISTS delivery_note_items_note_idx
  ON public.delivery_note_items (delivery_note_id, position);

CREATE TABLE IF NOT EXISTS public.delivery_note_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_note_id UUID NOT NULL REFERENCES public.delivery_notes(id) ON DELETE CASCADE,
  from_status public.delivery_note_status,
  to_status public.delivery_note_status NOT NULL,
  note TEXT,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS delivery_note_status_history_note_idx
  ON public.delivery_note_status_history (delivery_note_id, changed_at DESC);

CREATE SEQUENCE IF NOT EXISTS public.delivery_note_number_seq;

CREATE OR REPLACE FUNCTION public.next_delivery_note_number()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _prefix TEXT; _node_prefix TEXT; _serial TEXT;
BEGIN
  SELECT COALESCE(NULLIF(TRIM(delivery_note_number_prefix), ''), 'DN'),
         NULLIF(TRIM(COALESCE(quote_number_node_prefix, '')), '')
    INTO _prefix, _node_prefix FROM public.app_settings
   ORDER BY (id = '00000000-0000-0000-0000-000000000001') DESC, created_at LIMIT 1;
  _prefix := COALESCE(_prefix, 'DN');
  _serial := LPAD(nextval('public.delivery_note_number_seq')::TEXT, 5, '0');
  RETURN CONCAT_WS('-', _prefix, _node_prefix, to_char(CURRENT_DATE, 'YYYY'), _serial);
END; $$;
REVOKE ALL ON FUNCTION public.next_delivery_note_number() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_delivery_note_number() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delivery_notes_before_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _invoice public.invoices%ROWTYPE;
BEGIN
  IF NEW.delivery_note_number IS NULL OR TRIM(NEW.delivery_note_number) = '' THEN
    NEW.delivery_note_number := public.next_delivery_note_number();
  END IF;
  IF NEW.invoice_id IS NOT NULL THEN
    SELECT * INTO _invoice FROM public.invoices WHERE id = NEW.invoice_id AND deleted_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found' USING ERRCODE = 'P0002'; END IF;
    NEW.contact_id := COALESCE(NEW.contact_id, _invoice.contact_id);
    NEW.company_id := COALESCE(NEW.company_id, _invoice.company_id);
    NEW.assigned_to := COALESCE(NEW.assigned_to, _invoice.assigned_to);
  END IF;
  NEW.created_by := COALESCE(NEW.created_by, auth.uid());
  NEW.assigned_to := COALESCE(NEW.assigned_to, auth.uid());
  NEW.last_modified_by := COALESCE(auth.uid(), NEW.last_modified_by);
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.delivery_notes_before_insert() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delivery_notes_before_insert() TO service_role;

CREATE OR REPLACE FUNCTION public.delivery_notes_before_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status IN ('delivered','cancelled') THEN
      RAISE EXCEPTION 'Delivery note % is already % and cannot change status',
        OLD.delivery_note_number, OLD.status USING ERRCODE = '42501';
    END IF;
    IF NEW.status IN ('dispatched','delivered') THEN
      IF NEW.company_id IS NULL OR COALESCE(TRIM(NEW.recipient_name), '') = ''
         OR COALESCE(TRIM(NEW.delivery_address), '') = '' THEN
        RAISE EXCEPTION 'Company, recipient and delivery address are required before dispatch'
          USING ERRCODE = '23514';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.delivery_note_items WHERE delivery_note_id = NEW.id)
         OR EXISTS (SELECT 1 FROM public.delivery_note_items WHERE delivery_note_id = NEW.id AND quantity <= 0) THEN
        RAISE EXCEPTION 'At least one item with positive quantities is required before dispatch'
          USING ERRCODE = '23514';
      END IF;
    END IF;
    NEW.dispatched_at := CASE WHEN NEW.status = 'dispatched' THEN COALESCE(NEW.dispatched_at, now()) ELSE NEW.dispatched_at END;
    NEW.delivered_at := CASE WHEN NEW.status = 'delivered' THEN now() ELSE NEW.delivered_at END;
    IF NEW.status = 'cancelled' THEN NEW.cancelled_at := now(); NEW.cancelled_by := auth.uid(); END IF;
  END IF;
  NEW.last_modified_by := COALESCE(auth.uid(), NEW.last_modified_by);
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.delivery_notes_before_update() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delivery_notes_before_update() TO service_role;

CREATE OR REPLACE FUNCTION public.delivery_notes_log_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.delivery_note_status_history (delivery_note_id, from_status, to_status, note, changed_by)
    VALUES (NEW.id, NULL, NEW.status, NEW.notes, auth.uid());
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.delivery_note_status_history (delivery_note_id, from_status, to_status, note, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, NEW.notes, auth.uid());
  END IF;
  RETURN NULL;
END; $$;
REVOKE ALL ON FUNCTION public.delivery_notes_log_status_change() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delivery_notes_log_status_change() TO service_role;

DROP TRIGGER IF EXISTS delivery_notes_before_insert ON public.delivery_notes;
CREATE TRIGGER delivery_notes_before_insert BEFORE INSERT ON public.delivery_notes
  FOR EACH ROW EXECUTE FUNCTION public.delivery_notes_before_insert();
DROP TRIGGER IF EXISTS delivery_notes_before_update ON public.delivery_notes;
CREATE TRIGGER delivery_notes_before_update BEFORE UPDATE ON public.delivery_notes
  FOR EACH ROW EXECUTE FUNCTION public.delivery_notes_before_update();
DROP TRIGGER IF EXISTS delivery_notes_log_status_change ON public.delivery_notes;
CREATE TRIGGER delivery_notes_log_status_change AFTER INSERT OR UPDATE ON public.delivery_notes
  FOR EACH ROW EXECUTE FUNCTION public.delivery_notes_log_status_change();
DROP TRIGGER IF EXISTS set_updated_at_delivery_notes ON public.delivery_notes;
CREATE TRIGGER set_updated_at_delivery_notes BEFORE UPDATE ON public.delivery_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS set_updated_at_delivery_note_items ON public.delivery_note_items;
CREATE TRIGGER set_updated_at_delivery_note_items BEFORE UPDATE ON public.delivery_note_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.create_delivery_note_from_invoice(_invoice_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _inv public.invoices%ROWTYPE; _new_id UUID; _recipient TEXT; _address TEXT;
BEGIN
  IF NOT public.can_access_invoice(_invoice_id) THEN
    RAISE EXCEPTION 'Invoice not found' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO _inv FROM public.invoices WHERE id = _invoice_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found' USING ERRCODE = 'P0002'; END IF;
  SELECT NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), '') INTO _recipient
    FROM public.contacts WHERE id = _inv.contact_id AND deleted_at IS NULL;
  SELECT COALESCE(_recipient, name), address INTO _recipient, _address
    FROM public.companies WHERE id = _inv.company_id AND deleted_at IS NULL;
  INSERT INTO public.delivery_notes (
    invoice_id, company_id, contact_id, delivery_date, recipient_name,
    delivery_address, assigned_to, created_by
  ) VALUES (
    _inv.id, _inv.company_id, _inv.contact_id, CURRENT_DATE, _recipient,
    _address, COALESCE(_inv.assigned_to, auth.uid()), auth.uid()
  ) RETURNING id INTO _new_id;
  INSERT INTO public.delivery_note_items (
    delivery_note_id, position, catalog_item_id, name, description, unit, quantity
  ) SELECT _new_id, position, catalog_item_id, name, description, unit, quantity
      FROM public.invoice_line_items WHERE invoice_id = _inv.id ORDER BY position;
  RETURN _new_id;
END; $$;
REVOKE ALL ON FUNCTION public.create_delivery_note_from_invoice(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_delivery_note_from_invoice(UUID) TO authenticated;

REVOKE ALL ON public.delivery_notes, public.delivery_note_items, public.delivery_note_status_history FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_notes, public.delivery_note_items TO authenticated;
GRANT SELECT ON public.delivery_note_status_history TO authenticated;
GRANT ALL ON public.delivery_notes, public.delivery_note_items, public.delivery_note_status_history TO service_role;
ALTER TABLE public.delivery_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_note_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_note_status_history ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_delivery_note(_delivery_note_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.delivery_notes dn WHERE dn.id = _delivery_note_id AND (
      public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
      OR dn.assigned_to = auth.uid() OR dn.created_by = auth.uid()
    )
  )
$$;
REVOKE ALL ON FUNCTION public.can_access_delivery_note(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_delivery_note(UUID) TO authenticated;

DROP POLICY IF EXISTS "dn_select_scoped" ON public.delivery_notes;
CREATE POLICY "dn_select_scoped" ON public.delivery_notes FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR (deleted_at IS NULL AND (
    public.has_role(auth.uid(), 'manager') OR assigned_to = auth.uid() OR created_by = auth.uid()
  ))
);
DROP POLICY IF EXISTS "dn_insert_scoped" ON public.delivery_notes;
CREATE POLICY "dn_insert_scoped" ON public.delivery_notes FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
  OR assigned_to IS NULL OR assigned_to = auth.uid()
);
DROP POLICY IF EXISTS "dn_update_scoped" ON public.delivery_notes;
CREATE POLICY "dn_update_scoped" ON public.delivery_notes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR assigned_to = auth.uid() OR created_by = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR assigned_to = auth.uid() OR created_by = auth.uid());
DROP POLICY IF EXISTS "dn_delete_manager_admin" ON public.delivery_notes;
CREATE POLICY "dn_delete_manager_admin" ON public.delivery_notes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "dni_select_scoped" ON public.delivery_note_items;
CREATE POLICY "dni_select_scoped" ON public.delivery_note_items FOR SELECT TO authenticated USING (public.can_access_delivery_note(delivery_note_id));
DROP POLICY IF EXISTS "dni_insert_scoped" ON public.delivery_note_items;
CREATE POLICY "dni_insert_scoped" ON public.delivery_note_items FOR INSERT TO authenticated WITH CHECK (public.can_access_delivery_note(delivery_note_id));
DROP POLICY IF EXISTS "dni_update_scoped" ON public.delivery_note_items;
CREATE POLICY "dni_update_scoped" ON public.delivery_note_items FOR UPDATE TO authenticated USING (public.can_access_delivery_note(delivery_note_id)) WITH CHECK (public.can_access_delivery_note(delivery_note_id));
DROP POLICY IF EXISTS "dni_delete_scoped" ON public.delivery_note_items;
CREATE POLICY "dni_delete_scoped" ON public.delivery_note_items FOR DELETE TO authenticated USING (public.can_access_delivery_note(delivery_note_id));
DROP POLICY IF EXISTS "dnsh_select_scoped" ON public.delivery_note_status_history;
CREATE POLICY "dnsh_select_scoped" ON public.delivery_note_status_history FOR SELECT TO authenticated USING (public.can_access_delivery_note(delivery_note_id));

NOTIFY pgrst, 'reload schema';
