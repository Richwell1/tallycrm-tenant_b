-- =========================================================
-- Credit notes module. A credit note reverses an invoice in whole or in part —
-- a returned licence, an overcharge, a cancelled line. It references an invoice,
-- carries its own numbered document, and has its own line items.
--
-- Additive only: no existing invoice function is redefined. invoices.total,
-- invoices.amount_paid and the receipt balance check are deliberately untouched,
-- so this migration cannot change how any existing document behaves.
-- =========================================================

DO $$ BEGIN
  CREATE TYPE public.credit_note_status AS ENUM ('draft','issued','applied','void');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS credit_note_number_prefix TEXT NOT NULL DEFAULT 'CN';

CREATE TABLE IF NOT EXISTS public.credit_notes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_number TEXT NOT NULL UNIQUE,
  status             public.credit_note_status NOT NULL DEFAULT 'draft',

  invoice_id         UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  contact_id         UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  company_id         UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  assigned_to        UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  currency           TEXT NOT NULL DEFAULT 'GHS',
  issue_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  reason             TEXT,

  -- Trigger-maintained. Never trust client-supplied values here.
  subtotal           NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_amount         NUMERIC(14,2) NOT NULL DEFAULT 0,
  total              NUMERIC(14,2) NOT NULL DEFAULT 0,

  notes              TEXT,

  issued_at          TIMESTAMPTZ,
  applied_at         TIMESTAMPTZ,
  voided_at          TIMESTAMPTZ,
  voided_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  created_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at         TIMESTAMPTZ,
  origin_node_id     UUID REFERENCES public.sync_nodes(id) ON DELETE SET NULL,
  last_modified_by   UUID
);

CREATE INDEX IF NOT EXISTS credit_notes_invoice_idx
  ON public.credit_notes (invoice_id, issue_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS credit_notes_status_idx
  ON public.credit_notes (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS credit_notes_contact_idx  ON public.credit_notes (contact_id);
CREATE INDEX IF NOT EXISTS credit_notes_company_idx  ON public.credit_notes (company_id);
CREATE INDEX IF NOT EXISTS credit_notes_assigned_idx ON public.credit_notes (assigned_to);
CREATE INDEX IF NOT EXISTS credit_notes_updated_at_idx ON public.credit_notes (updated_at);

CREATE TABLE IF NOT EXISTS public.credit_note_line_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_id   UUID NOT NULL REFERENCES public.credit_notes(id) ON DELETE CASCADE,
  position         INT NOT NULL DEFAULT 0,
  catalog_item_id  UUID REFERENCES public.quote_catalog_items(id) ON DELETE SET NULL,

  name             TEXT NOT NULL,
  description      TEXT,
  unit             TEXT NOT NULL DEFAULT 'unit',
  quantity         NUMERIC(12,3) NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  unit_price       NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  discount_percent NUMERIC(6,3) NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  tax_rate         NUMERIC(6,3) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0),

  -- Trigger-maintained.
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

CREATE INDEX IF NOT EXISTS credit_note_line_items_note_idx
  ON public.credit_note_line_items (credit_note_id, position);

CREATE TABLE IF NOT EXISTS public.credit_note_status_history (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_id UUID NOT NULL REFERENCES public.credit_notes(id) ON DELETE CASCADE,
  from_status    public.credit_note_status,
  to_status      public.credit_note_status NOT NULL,
  note           TEXT,
  changed_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS credit_note_status_history_note_idx
  ON public.credit_note_status_history (credit_note_id, changed_at DESC);

-- =========================================================
-- Numbering. Mirrors next_receipt_number(); the node prefix is the shared
-- quote_number_node_prefix, set per branch install so LAN/offline nodes cannot
-- mint the same number.
-- =========================================================
CREATE SEQUENCE IF NOT EXISTS public.credit_note_number_seq;

CREATE OR REPLACE FUNCTION public.next_credit_note_number()
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
  -- Prefer the singleton the app writes to, then any other row.
  SELECT COALESCE(NULLIF(TRIM(credit_note_number_prefix), ''), 'CN'),
         NULLIF(TRIM(COALESCE(quote_number_node_prefix, '')), '')
    INTO _prefix, _node_prefix
    FROM public.app_settings
   ORDER BY (id = '00000000-0000-0000-0000-000000000001') DESC, created_at
   LIMIT 1;

  _prefix := COALESCE(_prefix, 'CN');
  _serial := LPAD(nextval('public.credit_note_number_seq')::TEXT, 5, '0');

  RETURN CONCAT_WS('-', _prefix, _node_prefix, to_char(CURRENT_DATE, 'YYYY'), _serial);
END;
$$;

REVOKE ALL ON FUNCTION public.next_credit_note_number() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_credit_note_number() TO authenticated, service_role;

-- =========================================================
-- Totals. The header UPDATE is bracketed by a transaction-local flag so that
-- credit_notes_before_update() can tell the trusted recalculation apart from a
-- client trying to post its own totals.
-- =========================================================
CREATE OR REPLACE FUNCTION public.recalculate_credit_note_totals(_credit_note_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _subtotal   NUMERIC(14,2) := 0;
  _tax_amount NUMERIC(14,2) := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.credit_notes WHERE id = _credit_note_id) THEN
    RETURN;
  END IF;

  UPDATE public.credit_note_line_items
     SET line_gross    = ROUND(quantity * unit_price, 2),
         line_discount = ROUND(ROUND(quantity * unit_price, 2) * discount_percent / 100, 2),
         line_net      = ROUND(quantity * unit_price, 2)
                         - ROUND(ROUND(quantity * unit_price, 2) * discount_percent / 100, 2)
   WHERE credit_note_id = _credit_note_id;

  UPDATE public.credit_note_line_items
     SET line_tax   = ROUND(line_net * tax_rate / 100, 2),
         line_total = line_net + ROUND(line_net * tax_rate / 100, 2)
   WHERE credit_note_id = _credit_note_id;

  SELECT COALESCE(SUM(line_net), 0), COALESCE(SUM(line_tax), 0)
    INTO _subtotal, _tax_amount
    FROM public.credit_note_line_items
   WHERE credit_note_id = _credit_note_id;

  PERFORM set_config('app.recalculating_credit_note_totals', 'true', true);

  UPDATE public.credit_notes
     SET subtotal   = _subtotal,
         tax_amount = _tax_amount,
         total      = _subtotal + _tax_amount
   WHERE id = _credit_note_id;

  PERFORM set_config('app.recalculating_credit_note_totals', '', true);
END;
$$;

REVOKE ALL ON FUNCTION public.recalculate_credit_note_totals(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_credit_note_totals(UUID) TO service_role;

-- =========================================================
-- Triggers
-- =========================================================
CREATE OR REPLACE FUNCTION public.credit_notes_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invoice public.invoices%ROWTYPE;
BEGIN
  IF NEW.credit_note_number IS NULL OR TRIM(NEW.credit_note_number) = '' THEN
    NEW.credit_note_number := public.next_credit_note_number();
  END IF;

  IF NEW.invoice_id IS NOT NULL THEN
    SELECT * INTO _invoice FROM public.invoices WHERE id = NEW.invoice_id AND deleted_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invoice not found' USING ERRCODE = 'P0002';
    END IF;
    NEW.contact_id := COALESCE(NEW.contact_id, _invoice.contact_id);
    NEW.company_id := COALESCE(NEW.company_id, _invoice.company_id);
    NEW.currency   := COALESCE(NULLIF(TRIM(NEW.currency), ''), _invoice.currency);
    NEW.assigned_to := COALESCE(NEW.assigned_to, _invoice.assigned_to);
  END IF;

  IF NEW.created_by IS NULL THEN NEW.created_by := auth.uid(); END IF;
  IF NEW.assigned_to IS NULL THEN NEW.assigned_to := auth.uid(); END IF;

  NEW.subtotal   := 0;
  NEW.tax_amount := 0;
  NEW.total      := 0;

  NEW.last_modified_by := COALESCE(auth.uid(), NEW.last_modified_by);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.credit_notes_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _recalculating BOOLEAN :=
    COALESCE(NULLIF(current_setting('app.recalculating_credit_note_totals', true), ''), 'false')::BOOLEAN;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status IN ('applied','void') THEN
      RAISE EXCEPTION 'Credit note % is already % and cannot change status',
        OLD.credit_note_number, OLD.status USING ERRCODE = '42501';
    END IF;
    NEW.issued_at  := CASE WHEN NEW.status = 'issued'  THEN COALESCE(NEW.issued_at, now()) ELSE NEW.issued_at END;
    NEW.applied_at := CASE WHEN NEW.status = 'applied' THEN now() ELSE NEW.applied_at END;
    IF NEW.status = 'void' THEN
      NEW.voided_at := now();
      NEW.voided_by := auth.uid();
    END IF;
  END IF;

  -- A credit note is a financial document: once it leaves draft the amounts and
  -- the invoice it reverses are fixed.
  IF OLD.status <> 'draft' AND NEW.invoice_id IS DISTINCT FROM OLD.invoice_id THEN
    RAISE EXCEPTION 'Credit note % has been issued and cannot be moved between invoices',
      OLD.credit_note_number USING ERRCODE = '42501';
  END IF;

  -- Totals are trigger-owned; ignore any client-supplied value.
  IF NOT _recalculating THEN
    NEW.subtotal   := OLD.subtotal;
    NEW.tax_amount := OLD.tax_amount;
    NEW.total      := OLD.total;
  END IF;

  NEW.last_modified_by := COALESCE(auth.uid(), NEW.last_modified_by);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.credit_note_line_items_recalculate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_credit_note_totals(OLD.credit_note_id);
  ELSE
    PERFORM public.recalculate_credit_note_totals(NEW.credit_note_id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.credit_notes_log_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.credit_note_status_history (credit_note_id, from_status, to_status, note, changed_by)
    VALUES (NEW.id, NULL, NEW.status, NEW.reason, auth.uid());
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.credit_note_status_history (credit_note_id, from_status, to_status, note, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, NEW.reason, auth.uid());
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS credit_notes_before_insert ON public.credit_notes;
CREATE TRIGGER credit_notes_before_insert BEFORE INSERT ON public.credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.credit_notes_before_insert();

DROP TRIGGER IF EXISTS credit_notes_before_update ON public.credit_notes;
CREATE TRIGGER credit_notes_before_update BEFORE UPDATE ON public.credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.credit_notes_before_update();

DROP TRIGGER IF EXISTS credit_notes_log_status_change ON public.credit_notes;
CREATE TRIGGER credit_notes_log_status_change AFTER INSERT OR UPDATE ON public.credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.credit_notes_log_status_change();

DROP TRIGGER IF EXISTS set_updated_at_credit_notes ON public.credit_notes;
CREATE TRIGGER set_updated_at_credit_notes BEFORE UPDATE ON public.credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_credit_note_line_items ON public.credit_note_line_items;
CREATE TRIGGER set_updated_at_credit_note_line_items BEFORE UPDATE ON public.credit_note_line_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- A trigger's WHEN clause is evaluated outside the trigger body, so
-- pg_trigger_depth() is 0 for a statement issued directly and 1 for the
-- recalculation's own writes. Without this guard those writes would re-fire this
-- trigger and recurse until the stack blows.
DROP TRIGGER IF EXISTS credit_note_line_items_recalculate ON public.credit_note_line_items;
CREATE TRIGGER credit_note_line_items_recalculate
  AFTER INSERT OR UPDATE OR DELETE ON public.credit_note_line_items
  FOR EACH ROW
  WHEN (pg_trigger_depth() = 0)
  EXECUTE FUNCTION public.credit_note_line_items_recalculate();

-- =========================================================
-- Draft a credit note from an invoice. Customer, currency and line items are
-- copied across; the invoice stays as it is.
-- =========================================================
CREATE OR REPLACE FUNCTION public.create_credit_note_from_invoice(_invoice_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _inv    public.invoices%ROWTYPE;
  _new_id UUID;
BEGIN
  SELECT * INTO _inv FROM public.invoices WHERE id = _invoice_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.credit_notes (
    status, invoice_id, contact_id, company_id, assigned_to,
    currency, issue_date, created_by
  ) VALUES (
    'draft', _inv.id, _inv.contact_id, _inv.company_id,
    COALESCE(_inv.assigned_to, auth.uid()),
    _inv.currency, CURRENT_DATE, auth.uid()
  )
  RETURNING id INTO _new_id;

  INSERT INTO public.credit_note_line_items (
    credit_note_id, position, catalog_item_id, name, description, unit,
    quantity, unit_price, discount_percent, tax_rate
  )
  SELECT _new_id, position, catalog_item_id, name, description, unit,
         quantity, unit_price, discount_percent, tax_rate
    FROM public.invoice_line_items
   WHERE invoice_id = _inv.id
   ORDER BY position;

  RETURN _new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_credit_note_from_invoice(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_credit_note_from_invoice(UUID) TO authenticated;

-- =========================================================
-- Grants + RLS
-- =========================================================
REVOKE ALL ON public.credit_notes              FROM anon;
REVOKE ALL ON public.credit_note_line_items    FROM anon;
REVOKE ALL ON public.credit_note_status_history FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_notes           TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_note_line_items TO authenticated;
GRANT SELECT ON public.credit_note_status_history TO authenticated;
GRANT ALL ON public.credit_notes               TO service_role;
GRANT ALL ON public.credit_note_line_items     TO service_role;
GRANT ALL ON public.credit_note_status_history TO service_role;

ALTER TABLE public.credit_notes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_note_line_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_note_status_history ENABLE ROW LEVEL SECURITY;

-- invoice_id is nullable, so a credit note cannot delegate access to its invoice
-- the way a receipt does. It is scoped on its own assigned_to/created_by.
CREATE OR REPLACE FUNCTION public.can_access_credit_note(_credit_note_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.credit_notes cn
     WHERE cn.id = _credit_note_id
       AND (
         public.has_role(auth.uid(), 'admin')
         OR public.has_role(auth.uid(), 'manager')
         OR cn.assigned_to = auth.uid()
         OR cn.created_by = auth.uid()
       )
  )
$$;

REVOKE ALL ON FUNCTION public.can_access_credit_note(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_credit_note(UUID) TO authenticated;

DROP POLICY IF EXISTS "cn_select_scoped" ON public.credit_notes;
CREATE POLICY "cn_select_scoped" ON public.credit_notes
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (
      credit_notes.deleted_at IS NULL
      AND (
        public.has_role(auth.uid(), 'manager')
        OR assigned_to = auth.uid()
        OR created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "cn_insert_scoped" ON public.credit_notes;
CREATE POLICY "cn_insert_scoped" ON public.credit_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR assigned_to IS NULL
    OR assigned_to = auth.uid()
  );

DROP POLICY IF EXISTS "cn_update_scoped" ON public.credit_notes;
CREATE POLICY "cn_update_scoped" ON public.credit_notes
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

DROP POLICY IF EXISTS "cn_delete_manager_admin" ON public.credit_notes;
CREATE POLICY "cn_delete_manager_admin" ON public.credit_notes
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "cnli_select_scoped" ON public.credit_note_line_items;
CREATE POLICY "cnli_select_scoped" ON public.credit_note_line_items
  FOR SELECT TO authenticated USING (public.can_access_credit_note(credit_note_id));

DROP POLICY IF EXISTS "cnli_insert_scoped" ON public.credit_note_line_items;
CREATE POLICY "cnli_insert_scoped" ON public.credit_note_line_items
  FOR INSERT TO authenticated WITH CHECK (public.can_access_credit_note(credit_note_id));

DROP POLICY IF EXISTS "cnli_update_scoped" ON public.credit_note_line_items;
CREATE POLICY "cnli_update_scoped" ON public.credit_note_line_items
  FOR UPDATE TO authenticated
  USING (public.can_access_credit_note(credit_note_id))
  WITH CHECK (public.can_access_credit_note(credit_note_id));

DROP POLICY IF EXISTS "cnli_delete_scoped" ON public.credit_note_line_items;
CREATE POLICY "cnli_delete_scoped" ON public.credit_note_line_items
  FOR DELETE TO authenticated USING (public.can_access_credit_note(credit_note_id));

DROP POLICY IF EXISTS "cnsh_select_scoped" ON public.credit_note_status_history;
CREATE POLICY "cnsh_select_scoped" ON public.credit_note_status_history
  FOR SELECT TO authenticated USING (public.can_access_credit_note(credit_note_id));

NOTIFY pgrst, 'reload schema';
