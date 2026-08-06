-- =========================================================
-- Invoicing module — additive only. Mirrors the quotations
-- module's schema, numbering, totals and RLS patterns.
-- =========================================================

DO $$ BEGIN
  CREATE TYPE public.invoice_status AS ENUM
    ('draft','sent','partially_paid','paid','overdue','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Additive workspace defaults
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS invoice_number_prefix TEXT NOT NULL DEFAULT 'INV',
  ADD COLUMN IF NOT EXISTS invoice_default_due_days INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS invoice_payment_terms TEXT;

-- ── Invoices ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number    TEXT NOT NULL UNIQUE,
  title             TEXT NOT NULL DEFAULT 'Invoice',
  status            public.invoice_status NOT NULL DEFAULT 'draft',

  -- Reference back to the source quotation. Editing an invoice never
  -- touches the quotation.
  quote_id          UUID REFERENCES public.quotes(id) ON DELETE SET NULL,

  contact_id        UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  company_id        UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  deal_id           UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  assigned_to       UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  currency          TEXT NOT NULL DEFAULT 'GHS',
  issue_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date          DATE,

  discount_type     public.quote_discount_type NOT NULL DEFAULT 'none',
  discount_value    NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (discount_value >= 0),

  -- Trigger-maintained. Never trust client-supplied values here.
  subtotal          NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_amount   NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_amount        NUMERIC(14,2) NOT NULL DEFAULT 0,
  total             NUMERIC(14,2) NOT NULL DEFAULT 0,
  amount_paid       NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),

  notes             TEXT,
  payment_terms     TEXT,

  sent_at           TIMESTAMPTZ,
  paid_at           TIMESTAMPTZ,
  cancelled_at      TIMESTAMPTZ,

  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  origin_node_id    UUID REFERENCES public.sync_nodes(id) ON DELETE SET NULL,
  last_modified_by  UUID
);

CREATE INDEX IF NOT EXISTS invoices_status_idx     ON public.invoices (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS invoices_quote_idx      ON public.invoices (quote_id);
CREATE INDEX IF NOT EXISTS invoices_contact_idx    ON public.invoices (contact_id);
CREATE INDEX IF NOT EXISTS invoices_company_idx    ON public.invoices (company_id);
CREATE INDEX IF NOT EXISTS invoices_assigned_idx   ON public.invoices (assigned_to);
CREATE INDEX IF NOT EXISTS invoices_updated_at_idx ON public.invoices (updated_at);

-- ── Invoice line items ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoice_line_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id       UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  position         INT NOT NULL DEFAULT 0,
  catalog_item_id  UUID REFERENCES public.quote_catalog_items(id) ON DELETE SET NULL,

  name             TEXT NOT NULL,
  description      TEXT,
  unit             TEXT NOT NULL DEFAULT 'unit',
  quantity         NUMERIC(12,3) NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  unit_price       NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  discount_percent NUMERIC(6,3) NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  tax_rate         NUMERIC(6,3) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0),

  line_gross       NUMERIC(14,2) NOT NULL DEFAULT 0,
  line_discount    NUMERIC(14,2) NOT NULL DEFAULT 0,
  line_net         NUMERIC(14,2) NOT NULL DEFAULT 0,
  line_tax         NUMERIC(14,2) NOT NULL DEFAULT 0,
  line_total       NUMERIC(14,2) NOT NULL DEFAULT 0,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  origin_node_id   UUID REFERENCES public.sync_nodes(id) ON DELETE SET NULL,
  last_modified_by UUID
);

CREATE INDEX IF NOT EXISTS invoice_line_items_invoice_idx
  ON public.invoice_line_items (invoice_id, position);

-- ── Status history ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoice_status_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id   UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  from_status  public.invoice_status,
  to_status    public.invoice_status NOT NULL,
  note         TEXT,
  changed_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoice_status_history_invoice_idx
  ON public.invoice_status_history (invoice_id, changed_at DESC);

-- =========================================================
-- Numbering
-- =========================================================
CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq;

CREATE OR REPLACE FUNCTION public.next_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _prefix      TEXT;
  _node_prefix TEXT;
  _serial      TEXT;
BEGIN
  SELECT COALESCE(NULLIF(TRIM(invoice_number_prefix), ''), 'INV'),
         NULLIF(TRIM(COALESCE(quote_number_node_prefix, '')), '')
    INTO _prefix, _node_prefix
    FROM public.app_settings
   ORDER BY (id = '00000000-0000-0000-0000-000000000001') DESC, created_at
   LIMIT 1;

  _prefix := COALESCE(_prefix, 'INV');
  _serial := LPAD(nextval('public.invoice_number_seq')::TEXT, 5, '0');

  RETURN CONCAT_WS('-', _prefix, _node_prefix, to_char(CURRENT_DATE, 'YYYY'), _serial);
END;
$$;

REVOKE ALL ON FUNCTION public.next_invoice_number() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_invoice_number() TO authenticated, service_role;

-- =========================================================
-- Totals — identical arithmetic to recalculate_quote_totals
-- =========================================================
CREATE OR REPLACE FUNCTION public.recalculate_invoice_totals(_invoice_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inv              public.invoices%ROWTYPE;
  _subtotal         NUMERIC(14,2) := 0;
  _discount_amount  NUMERIC(14,2) := 0;
  _tax_amount       NUMERIC(14,2) := 0;
  _allocated        NUMERIC(14,2) := 0;
  _line             RECORD;
  _line_count       INT := 0;
  _index            INT := 0;
  _share            NUMERIC(14,2);
  _taxable          NUMERIC(14,2);
  _line_tax         NUMERIC(14,2);
BEGIN
  SELECT * INTO _inv FROM public.invoices WHERE id = _invoice_id;
  IF NOT FOUND THEN RETURN; END IF;

  UPDATE public.invoice_line_items
     SET line_gross    = ROUND(quantity * unit_price, 2),
         line_discount = ROUND(ROUND(quantity * unit_price, 2) * discount_percent / 100, 2),
         line_net      = ROUND(quantity * unit_price, 2)
                         - ROUND(ROUND(quantity * unit_price, 2) * discount_percent / 100, 2)
   WHERE invoice_id = _invoice_id;

  SELECT COALESCE(SUM(line_net), 0), COUNT(*)
    INTO _subtotal, _line_count
    FROM public.invoice_line_items
   WHERE invoice_id = _invoice_id;

  _discount_amount := CASE _inv.discount_type
    WHEN 'percent' THEN ROUND(_subtotal * LEAST(_inv.discount_value, 100) / 100, 2)
    WHEN 'amount'  THEN LEAST(_inv.discount_value, _subtotal)
    ELSE 0
  END;

  FOR _line IN
    SELECT id, line_net, tax_rate
      FROM public.invoice_line_items
     WHERE invoice_id = _invoice_id
     ORDER BY position, created_at, id
  LOOP
    _index := _index + 1;

    IF _subtotal > 0 THEN
      IF _index = _line_count THEN
        _share := _discount_amount - _allocated;
      ELSE
        _share := ROUND(_discount_amount * _line.line_net / _subtotal, 2);
      END IF;
    ELSE
      _share := 0;
    END IF;

    _allocated := _allocated + _share;
    _taxable   := _line.line_net - _share;
    _line_tax  := ROUND(_taxable * _line.tax_rate / 100, 2);
    _tax_amount := _tax_amount + _line_tax;

    UPDATE public.invoice_line_items
       SET line_tax   = _line_tax,
           line_total = _taxable + _line_tax
     WHERE id = _line.id;
  END LOOP;

  UPDATE public.invoices
     SET subtotal        = _subtotal,
         discount_amount = _discount_amount,
         tax_amount      = _tax_amount,
         total           = _subtotal - _discount_amount + _tax_amount
   WHERE id = _invoice_id;
END;
$$;

REVOKE ALL ON FUNCTION public.recalculate_invoice_totals(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recalculate_invoice_totals(UUID) TO service_role;

-- =========================================================
-- Triggers
-- =========================================================
CREATE OR REPLACE FUNCTION public.invoices_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR TRIM(NEW.invoice_number) = '' THEN
    NEW.invoice_number := public.next_invoice_number();
  END IF;
  IF NEW.created_by IS NULL THEN NEW.created_by := auth.uid(); END IF;
  IF NEW.assigned_to IS NULL THEN NEW.assigned_to := auth.uid(); END IF;

  NEW.subtotal := 0;
  NEW.discount_amount := 0;
  NEW.tax_amount := 0;
  NEW.total := 0;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.invoices_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status IN ('paid','cancelled') THEN
      RAISE EXCEPTION 'Invoice % is already % and cannot change status',
        OLD.invoice_number, OLD.status USING ERRCODE = '42501';
    END IF;
    NEW.sent_at      := CASE WHEN NEW.status = 'sent' THEN COALESCE(NEW.sent_at, now()) ELSE NEW.sent_at END;
    NEW.paid_at      := CASE WHEN NEW.status = 'paid' THEN now() ELSE NEW.paid_at END;
    NEW.cancelled_at := CASE WHEN NEW.status = 'cancelled' THEN now() ELSE NEW.cancelled_at END;
  END IF;

  -- Totals are trigger-owned; ignore any client-supplied value.
  NEW.subtotal        := OLD.subtotal;
  NEW.discount_amount := OLD.discount_amount;
  NEW.tax_amount      := OLD.tax_amount;
  NEW.total           := OLD.total;

  NEW.last_modified_by := COALESCE(auth.uid(), NEW.last_modified_by);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.invoices_recalculate_on_discount()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.discount_type IS DISTINCT FROM OLD.discount_type
     OR NEW.discount_value IS DISTINCT FROM OLD.discount_value THEN
    PERFORM public.recalculate_invoice_totals(NEW.id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.invoices_log_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.invoice_status_history (invoice_id, from_status, to_status, changed_by)
    VALUES (NEW.id, NULL, NEW.status, auth.uid());
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.invoice_status_history (invoice_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.invoice_line_items_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _status  public.invoice_status;
  _number  TEXT;
  _invoice UUID := COALESCE(NEW.invoice_id, OLD.invoice_id);
BEGIN
  SELECT status, invoice_number INTO _status, _number
    FROM public.invoices WHERE id = _invoice;

  IF _status IN ('paid','cancelled') THEN
    RAISE EXCEPTION 'Invoice % is % - its items are locked', _number, _status
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  NEW.last_modified_by := COALESCE(auth.uid(), NEW.last_modified_by);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.invoice_line_items_recalculate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recalculate_invoice_totals(COALESCE(NEW.invoice_id, OLD.invoice_id));
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS invoices_before_insert ON public.invoices;
CREATE TRIGGER invoices_before_insert BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.invoices_before_insert();

DROP TRIGGER IF EXISTS invoices_before_update ON public.invoices;
CREATE TRIGGER invoices_before_update BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.invoices_before_update();

DROP TRIGGER IF EXISTS set_updated_at_invoices ON public.invoices;
CREATE TRIGGER set_updated_at_invoices BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS invoices_recalculate_on_discount ON public.invoices;
CREATE TRIGGER invoices_recalculate_on_discount AFTER UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.invoices_recalculate_on_discount();

DROP TRIGGER IF EXISTS invoices_log_status_change ON public.invoices;
CREATE TRIGGER invoices_log_status_change AFTER INSERT OR UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.invoices_log_status_change();

DROP TRIGGER IF EXISTS invoice_line_items_guard ON public.invoice_line_items;
CREATE TRIGGER invoice_line_items_guard BEFORE INSERT OR UPDATE OR DELETE ON public.invoice_line_items
  FOR EACH ROW EXECUTE FUNCTION public.invoice_line_items_guard();

DROP TRIGGER IF EXISTS invoice_line_items_recalculate ON public.invoice_line_items;
CREATE TRIGGER invoice_line_items_recalculate AFTER INSERT OR UPDATE OR DELETE ON public.invoice_line_items
  FOR EACH ROW EXECUTE FUNCTION public.invoice_line_items_recalculate();

DROP TRIGGER IF EXISTS set_updated_at_invoice_line_items ON public.invoice_line_items;
CREATE TRIGGER set_updated_at_invoice_line_items BEFORE UPDATE ON public.invoice_line_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- Create an invoice from a quotation (read-only on the quote)
-- =========================================================
CREATE OR REPLACE FUNCTION public.create_invoice_from_quote(_quote_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _q        public.quotes%ROWTYPE;
  _due_days INT;
  _terms    TEXT;
  _new_id   UUID;
BEGIN
  SELECT * INTO _q FROM public.quotes WHERE id = _quote_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quotation not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(invoice_default_due_days, 30), invoice_payment_terms
    INTO _due_days, _terms
    FROM public.app_settings
   ORDER BY (id = '00000000-0000-0000-0000-000000000001') DESC, created_at
   LIMIT 1;

  INSERT INTO public.invoices (
    title, status, quote_id, contact_id, company_id, deal_id, assigned_to,
    currency, issue_date, due_date, discount_type, discount_value,
    notes, payment_terms, created_by
  ) VALUES (
    _q.title, 'draft', _q.id, _q.contact_id, _q.company_id, _q.deal_id,
    COALESCE(_q.assigned_to, auth.uid()),
    _q.currency, CURRENT_DATE, CURRENT_DATE + COALESCE(_due_days, 30),
    _q.discount_type, _q.discount_value,
    _q.notes, COALESCE(_terms, _q.terms), auth.uid()
  )
  RETURNING id INTO _new_id;

  INSERT INTO public.invoice_line_items (
    invoice_id, position, catalog_item_id, name, description, unit,
    quantity, unit_price, discount_percent, tax_rate
  )
  SELECT _new_id, position, catalog_item_id, name, description, unit,
         quantity, unit_price, discount_percent, tax_rate
    FROM public.quote_line_items
   WHERE quote_id = _q.id
   ORDER BY position;

  RETURN _new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_invoice_from_quote(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_invoice_from_quote(UUID) TO authenticated;

-- =========================================================
-- Grants + RLS
-- =========================================================
REVOKE ALL ON public.invoices FROM anon;
REVOKE ALL ON public.invoice_line_items FROM anon;
REVOKE ALL ON public.invoice_status_history FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_line_items TO authenticated;
GRANT SELECT ON public.invoice_status_history TO authenticated;
GRANT ALL ON public.invoices TO service_role;
GRANT ALL ON public.invoice_line_items TO service_role;
GRANT ALL ON public.invoice_status_history TO service_role;

ALTER TABLE public.invoices              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_line_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_status_history ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_invoice(_invoice_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.invoices i
     WHERE i.id = _invoice_id
       AND (
         public.has_role(auth.uid(), 'admin')
         OR public.has_role(auth.uid(), 'manager')
         OR i.assigned_to = auth.uid()
         OR i.created_by = auth.uid()
       )
  )
$$;

REVOKE ALL ON FUNCTION public.can_access_invoice(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_invoice(UUID) TO authenticated;

DROP POLICY IF EXISTS "inv_select_scoped" ON public.invoices;
CREATE POLICY "inv_select_scoped" ON public.invoices
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (
      invoices.deleted_at IS NULL
      AND (
        public.has_role(auth.uid(), 'manager')
        OR assigned_to = auth.uid()
        OR created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "inv_insert_scoped" ON public.invoices;
CREATE POLICY "inv_insert_scoped" ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR assigned_to IS NULL
    OR assigned_to = auth.uid()
  );

DROP POLICY IF EXISTS "inv_update_scoped" ON public.invoices;
CREATE POLICY "inv_update_scoped" ON public.invoices
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

DROP POLICY IF EXISTS "inv_delete_manager_admin" ON public.invoices;
CREATE POLICY "inv_delete_manager_admin" ON public.invoices
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "ili_select_scoped" ON public.invoice_line_items;
CREATE POLICY "ili_select_scoped" ON public.invoice_line_items
  FOR SELECT TO authenticated USING (public.can_access_invoice(invoice_id));

DROP POLICY IF EXISTS "ili_insert_scoped" ON public.invoice_line_items;
CREATE POLICY "ili_insert_scoped" ON public.invoice_line_items
  FOR INSERT TO authenticated WITH CHECK (public.can_access_invoice(invoice_id));

DROP POLICY IF EXISTS "ili_update_scoped" ON public.invoice_line_items;
CREATE POLICY "ili_update_scoped" ON public.invoice_line_items
  FOR UPDATE TO authenticated
  USING (public.can_access_invoice(invoice_id))
  WITH CHECK (public.can_access_invoice(invoice_id));

DROP POLICY IF EXISTS "ili_delete_scoped" ON public.invoice_line_items;
CREATE POLICY "ili_delete_scoped" ON public.invoice_line_items
  FOR DELETE TO authenticated USING (public.can_access_invoice(invoice_id));

DROP POLICY IF EXISTS "ish_select_scoped" ON public.invoice_status_history;
CREATE POLICY "ish_select_scoped" ON public.invoice_status_history
  FOR SELECT TO authenticated USING (public.can_access_invoice(invoice_id));