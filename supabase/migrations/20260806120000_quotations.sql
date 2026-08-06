-- =========================================================
-- Quotations module
--
-- quotes ─┬─ quote_line_items      (what the client is billed for)
--         ├─ quote_status_history  (append-only audit of transitions)
--         └─ quote_catalog_items   (reusable products/services)
--
-- Money is authoritative in the database: every line and quote total is
-- recomputed by trigger, so a client that posts wrong numbers cannot skew a
-- document. src/lib/quote-totals.ts mirrors this math for live preview only.
-- =========================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quote_status') THEN
    CREATE TYPE public.quote_status AS ENUM ('draft','sent','accepted','rejected','expired');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quote_discount_type') THEN
    CREATE TYPE public.quote_discount_type AS ENUM ('none','percent','amount');
  END IF;
END
$$;

-- ── Workspace defaults ────────────────────────────────────────────────────────
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS quote_number_prefix       TEXT NOT NULL DEFAULT 'QT',
  -- Set per branch install so LAN/offline nodes cannot mint the same number.
  ADD COLUMN IF NOT EXISTS quote_number_node_prefix  TEXT,
  ADD COLUMN IF NOT EXISTS quote_default_tax_rate    NUMERIC(6,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quote_default_validity_days INT NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS quote_terms               TEXT,
  ADD COLUMN IF NOT EXISTS quote_footer_note         TEXT;

-- ── Catalog of reusable products / services ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quote_catalog_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  description  TEXT,
  unit         TEXT NOT NULL DEFAULT 'unit',
  unit_price   NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  currency     TEXT NOT NULL DEFAULT 'GHS',
  tax_rate     NUMERIC(6,3) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0),
  category     TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS quote_catalog_items_active_idx
  ON public.quote_catalog_items (is_active) WHERE deleted_at IS NULL;

-- ── Quotes ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quotes (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number         TEXT NOT NULL UNIQUE,
  version              INT NOT NULL DEFAULT 1 CHECK (version >= 1),
  -- Revision chain: every version of a document shares one root.
  root_quote_id        UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  supersedes_quote_id  UUID REFERENCES public.quotes(id) ON DELETE SET NULL,

  title                TEXT NOT NULL,
  status               public.quote_status NOT NULL DEFAULT 'draft',

  contact_id           UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  company_id           UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  deal_id              UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  assigned_to          UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  currency             TEXT NOT NULL DEFAULT 'GHS',
  issue_date           DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until          DATE,

  discount_type        public.quote_discount_type NOT NULL DEFAULT 'none',
  discount_value       NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (discount_value >= 0),

  -- Trigger-maintained. Never trust a client-supplied value here.
  subtotal             NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_amount           NUMERIC(14,2) NOT NULL DEFAULT 0,
  total                NUMERIC(14,2) NOT NULL DEFAULT 0,

  notes                TEXT,
  terms                TEXT,

  sent_at              TIMESTAMPTZ,
  accepted_at          TIMESTAMPTZ,
  rejected_at          TIMESTAMPTZ,
  decision_note        TEXT,
  converted_deal_id    UUID REFERENCES public.deals(id) ON DELETE SET NULL,

  created_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at           TIMESTAMPTZ,
  origin_node_id       UUID REFERENCES public.sync_nodes(id) ON DELETE SET NULL,
  last_modified_by     UUID
);

CREATE INDEX IF NOT EXISTS quotes_status_idx      ON public.quotes (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS quotes_deal_idx        ON public.quotes (deal_id);
CREATE INDEX IF NOT EXISTS quotes_company_idx     ON public.quotes (company_id);
CREATE INDEX IF NOT EXISTS quotes_contact_idx     ON public.quotes (contact_id);
CREATE INDEX IF NOT EXISTS quotes_assigned_idx    ON public.quotes (assigned_to);
CREATE INDEX IF NOT EXISTS quotes_root_idx        ON public.quotes (root_quote_id);
CREATE INDEX IF NOT EXISTS quotes_updated_at_idx  ON public.quotes (updated_at);

-- ── Line items ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quote_line_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id         UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS quote_line_items_quote_idx
  ON public.quote_line_items (quote_id, position);

-- ── Status history ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quote_status_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id     UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  from_status  public.quote_status,
  to_status    public.quote_status NOT NULL,
  note         TEXT,
  changed_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quote_status_history_quote_idx
  ON public.quote_status_history (quote_id, changed_at DESC);

-- =========================================================
-- Numbering
-- =========================================================
CREATE SEQUENCE IF NOT EXISTS public.quote_number_seq;

CREATE OR REPLACE FUNCTION public.next_quote_number()
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
  SELECT COALESCE(NULLIF(TRIM(quote_number_prefix), ''), 'QT'),
         NULLIF(TRIM(COALESCE(quote_number_node_prefix, '')), '')
    INTO _prefix, _node_prefix
    FROM public.app_settings
   -- Prefer the singleton the app writes to, then any other row.
   ORDER BY (id = '00000000-0000-0000-0000-000000000001') DESC, created_at
   LIMIT 1;

  _prefix := COALESCE(_prefix, 'QT');
  _serial := LPAD(nextval('public.quote_number_seq')::TEXT, 5, '0');

  RETURN CONCAT_WS(
    '-',
    _prefix,
    _node_prefix,
    to_char(CURRENT_DATE, 'YYYY'),
    _serial
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_quote_number() TO authenticated;

-- =========================================================
-- Totals
--
-- line_gross     = quantity × unit_price
-- line_discount  = line_gross × discount_percent%
-- line_net       = line_gross − line_discount
-- subtotal       = Σ line_net
-- discount_amount= quote-level discount (percent of subtotal, or fixed amount
--                  capped at subtotal), allocated back across lines pro rata
-- line_tax       = (line_net − allocated discount) × tax_rate%
-- total          = subtotal − discount_amount + Σ line_tax
--
-- The allocation remainder lands on the last line so the parts always sum to
-- the whole (no drifting cent).
-- =========================================================
CREATE OR REPLACE FUNCTION public.recalculate_quote_totals(_quote_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _quote            public.quotes%ROWTYPE;
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
  SELECT * INTO _quote FROM public.quotes WHERE id = _quote_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.quote_line_items
     SET line_gross    = ROUND(quantity * unit_price, 2),
         line_discount = ROUND(ROUND(quantity * unit_price, 2) * discount_percent / 100, 2),
         line_net      = ROUND(quantity * unit_price, 2)
                         - ROUND(ROUND(quantity * unit_price, 2) * discount_percent / 100, 2)
   WHERE quote_id = _quote_id;

  SELECT COALESCE(SUM(line_net), 0), COUNT(*)
    INTO _subtotal, _line_count
    FROM public.quote_line_items
   WHERE quote_id = _quote_id;

  _discount_amount := CASE _quote.discount_type
    WHEN 'percent' THEN ROUND(_subtotal * LEAST(_quote.discount_value, 100) / 100, 2)
    WHEN 'amount'  THEN LEAST(_quote.discount_value, _subtotal)
    ELSE 0
  END;

  FOR _line IN
    SELECT id, line_net, tax_rate
      FROM public.quote_line_items
     WHERE quote_id = _quote_id
     ORDER BY position, created_at, id
  LOOP
    _index := _index + 1;

    IF _subtotal > 0 THEN
      IF _index = _line_count THEN
        _share := _discount_amount - _allocated;  -- remainder closes the gap
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

    UPDATE public.quote_line_items
       SET line_tax   = _line_tax,
           line_total = _taxable + _line_tax
     WHERE id = _line.id;
  END LOOP;

  UPDATE public.quotes
     SET subtotal        = _subtotal,
         discount_amount = _discount_amount,
         tax_amount      = _tax_amount,
         total           = _subtotal - _discount_amount + _tax_amount
   WHERE id = _quote_id;
END;
$$;

-- Reachable only through the triggers below and by service_role; clients never
-- write totals directly.
REVOKE ALL ON FUNCTION public.recalculate_quote_totals(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recalculate_quote_totals(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.quote_line_items_recalculate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recalculate_quote_totals(COALESCE(NEW.quote_id, OLD.quote_id));
  RETURN NULL;
END;
$$;

-- A trigger's WHEN clause is evaluated outside the trigger body, so
-- pg_trigger_depth() is 0 for a statement issued directly and 1 for the
-- recalculation's own writes. Without this guard those writes would re-fire
-- this trigger and recurse until the stack blows.
DROP TRIGGER IF EXISTS quote_line_items_recalculate ON public.quote_line_items;
CREATE TRIGGER quote_line_items_recalculate
  AFTER INSERT OR UPDATE OR DELETE ON public.quote_line_items
  FOR EACH ROW
  WHEN (pg_trigger_depth() = 0)
  EXECUTE FUNCTION public.quote_line_items_recalculate();

CREATE OR REPLACE FUNCTION public.quotes_recalculate_on_discount()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.discount_type IS DISTINCT FROM OLD.discount_type
     OR NEW.discount_value IS DISTINCT FROM OLD.discount_value THEN
    PERFORM public.recalculate_quote_totals(NEW.id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS quotes_recalculate_on_discount ON public.quotes;
CREATE TRIGGER quotes_recalculate_on_discount
  AFTER UPDATE ON public.quotes
  FOR EACH ROW
  WHEN (pg_trigger_depth() = 0)
  EXECUTE FUNCTION public.quotes_recalculate_on_discount();

-- =========================================================
-- Lifecycle guards
-- =========================================================
CREATE OR REPLACE FUNCTION public.quotes_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.quote_number IS NULL OR TRIM(NEW.quote_number) = '' THEN
    NEW.quote_number := public.next_quote_number();
  END IF;

  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;

  IF public.is_rep_owned_insert() AND NEW.assigned_to IS NULL THEN
    NEW.assigned_to := auth.uid();
  END IF;

  -- Totals are derived; a fresh quote has no lines yet.
  NEW.subtotal := 0;
  NEW.discount_amount := 0;
  NEW.tax_amount := 0;
  NEW.total := 0;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quotes_before_insert ON public.quotes;
CREATE TRIGGER quotes_before_insert
  BEFORE INSERT ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.quotes_before_insert();

-- A quote that has left draft is a document someone has seen: freeze its
-- commercial content and record every status move.
CREATE OR REPLACE FUNCTION public.quotes_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _content_changed BOOLEAN;
BEGIN
  _content_changed :=
       NEW.title           IS DISTINCT FROM OLD.title
    OR NEW.currency        IS DISTINCT FROM OLD.currency
    OR NEW.issue_date      IS DISTINCT FROM OLD.issue_date
    OR NEW.discount_type   IS DISTINCT FROM OLD.discount_type
    OR NEW.discount_value  IS DISTINCT FROM OLD.discount_value
    OR NEW.contact_id      IS DISTINCT FROM OLD.contact_id
    OR NEW.company_id      IS DISTINCT FROM OLD.company_id
    OR NEW.terms           IS DISTINCT FROM OLD.terms;

  IF OLD.status <> 'draft' AND _content_changed THEN
    RAISE EXCEPTION 'Quote % is % and can no longer be edited — create a revision instead',
      OLD.quote_number, OLD.status
      USING ERRCODE = '42501';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status IN ('accepted','rejected') THEN
      RAISE EXCEPTION 'Quote % is already % and cannot change status',
        OLD.quote_number, OLD.status
        USING ERRCODE = '42501';
    END IF;

    NEW.sent_at     := CASE WHEN NEW.status = 'sent'     THEN COALESCE(NEW.sent_at, now())  ELSE NEW.sent_at END;
    NEW.accepted_at := CASE WHEN NEW.status = 'accepted' THEN now() ELSE NEW.accepted_at END;
    NEW.rejected_at := CASE WHEN NEW.status = 'rejected' THEN now() ELSE NEW.rejected_at END;
  END IF;

  NEW.last_modified_by := COALESCE(auth.uid(), NEW.last_modified_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quotes_before_update ON public.quotes;
CREATE TRIGGER quotes_before_update
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.quotes_before_update();

CREATE OR REPLACE FUNCTION public.quotes_log_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.quote_status_history (quote_id, from_status, to_status, changed_by)
    VALUES (NEW.id, NULL, NEW.status, auth.uid());
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.quote_status_history (quote_id, from_status, to_status, note, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, NEW.decision_note, auth.uid());
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS quotes_log_status_change ON public.quotes;
CREATE TRIGGER quotes_log_status_change
  AFTER INSERT OR UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.quotes_log_status_change();

CREATE OR REPLACE FUNCTION public.quote_line_items_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _status public.quote_status;
  _number TEXT;
  _quote  UUID := COALESCE(NEW.quote_id, OLD.quote_id);
BEGIN
  SELECT status, quote_number INTO _status, _number FROM public.quotes WHERE id = _quote;

  IF _status IS NOT NULL AND _status <> 'draft' THEN
    RAISE EXCEPTION 'Quote % is % — its line items are locked, create a revision instead',
      _number, _status
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  NEW.last_modified_by := COALESCE(auth.uid(), NEW.last_modified_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quote_line_items_guard ON public.quote_line_items;
CREATE TRIGGER quote_line_items_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.quote_line_items
  FOR EACH ROW EXECUTE FUNCTION public.quote_line_items_guard();

DROP TRIGGER IF EXISTS set_updated_at_quotes ON public.quotes;
CREATE TRIGGER set_updated_at_quotes
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_quote_line_items ON public.quote_line_items;
CREATE TRIGGER set_updated_at_quote_line_items
  BEFORE UPDATE ON public.quote_line_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_quote_catalog_items ON public.quote_catalog_items;
CREATE TRIGGER set_updated_at_quote_catalog_items
  BEFORE UPDATE ON public.quote_catalog_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- Revisions
-- =========================================================
CREATE OR REPLACE FUNCTION public.revise_quote(_quote_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER            -- caller's RLS decides whether this is allowed
SET search_path = public
AS $$
DECLARE
  _source  public.quotes%ROWTYPE;
  _root    UUID;
  _version INT;
  _new_id  UUID;
BEGIN
  SELECT * INTO _source FROM public.quotes WHERE id = _quote_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found' USING ERRCODE = 'P0002';
  END IF;

  _root := COALESCE(_source.root_quote_id, _source.id);

  SELECT COALESCE(MAX(version), 0) + 1 INTO _version
    FROM public.quotes
   WHERE COALESCE(root_quote_id, id) = _root;

  INSERT INTO public.quotes (
    quote_number, version, root_quote_id, supersedes_quote_id,
    title, status, contact_id, company_id, deal_id, assigned_to,
    currency, issue_date, valid_until, discount_type, discount_value,
    notes, terms, created_by
  ) VALUES (
    public.next_quote_number(), _version, _root, _source.id,
    _source.title, 'draft', _source.contact_id, _source.company_id,
    _source.deal_id, _source.assigned_to,
    _source.currency, CURRENT_DATE,
    CASE
      WHEN _source.valid_until IS NULL THEN NULL
      ELSE CURRENT_DATE + (_source.valid_until - _source.issue_date)
    END,
    _source.discount_type, _source.discount_value,
    _source.notes, _source.terms, auth.uid()
  )
  RETURNING id INTO _new_id;

  INSERT INTO public.quote_line_items (
    quote_id, position, catalog_item_id, name, description, unit,
    quantity, unit_price, discount_percent, tax_rate
  )
  SELECT _new_id, position, catalog_item_id, name, description, unit,
         quantity, unit_price, discount_percent, tax_rate
    FROM public.quote_line_items
   WHERE quote_id = _source.id
   ORDER BY position;
  -- The line-item insert trigger recalculates the new quote's totals; calling
  -- recalculate_quote_totals() here would need EXECUTE on a SECURITY DEFINER
  -- function this SECURITY INVOKER function deliberately does not have.

  RETURN _new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.revise_quote(UUID) TO authenticated;

-- Sent quotes past their validity date. Safe to call from a schedule; the UI
-- also derives the expired look so a missed run never shows a stale document.
CREATE OR REPLACE FUNCTION public.expire_stale_quotes()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count INT;
BEGIN
  UPDATE public.quotes
     SET status = 'expired'
   WHERE status = 'sent'
     AND deleted_at IS NULL
     AND valid_until IS NOT NULL
     AND valid_until < CURRENT_DATE;
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_stale_quotes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_stale_quotes() TO service_role;

-- =========================================================
-- Grants + RLS (mirrors the deal ownership model: reps see their own,
-- managers/admins see everything, deletes stay manager/admin only)
-- =========================================================
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_status_history ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.quotes FROM anon;
REVOKE ALL ON public.quote_line_items FROM anon;
REVOKE ALL ON public.quote_catalog_items FROM anon;
REVOKE ALL ON public.quote_status_history FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_line_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_catalog_items TO authenticated;
GRANT SELECT ON public.quote_status_history TO authenticated;
GRANT ALL ON public.quotes TO service_role;
GRANT ALL ON public.quote_line_items TO service_role;
GRANT ALL ON public.quote_catalog_items TO service_role;
GRANT ALL ON public.quote_status_history TO service_role;

CREATE OR REPLACE FUNCTION public.can_access_quote(_quote_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.quotes q
     WHERE q.id = _quote_id
       AND (
         public.has_role(auth.uid(), 'admin')
         OR public.has_role(auth.uid(), 'manager')
         OR q.assigned_to = auth.uid()
         OR q.created_by = auth.uid()
       )
  )
$$;

GRANT EXECUTE ON FUNCTION public.can_access_quote(UUID) TO authenticated;

DROP POLICY IF EXISTS "qt_select_scoped" ON public.quotes;
CREATE POLICY "qt_select_scoped" ON public.quotes
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (
      quotes.deleted_at IS NULL
      AND (
        public.has_role(auth.uid(), 'manager')
        OR assigned_to = auth.uid()
        OR created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "qt_insert_scoped" ON public.quotes;
CREATE POLICY "qt_insert_scoped" ON public.quotes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR assigned_to IS NULL
    OR assigned_to = auth.uid()
  );

DROP POLICY IF EXISTS "qt_update_scoped" ON public.quotes;
CREATE POLICY "qt_update_scoped" ON public.quotes
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

DROP POLICY IF EXISTS "qt_delete_manager_admin" ON public.quotes;
CREATE POLICY "qt_delete_manager_admin" ON public.quotes
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "qli_select_scoped" ON public.quote_line_items;
CREATE POLICY "qli_select_scoped" ON public.quote_line_items
  FOR SELECT TO authenticated
  USING (public.can_access_quote(quote_id));

DROP POLICY IF EXISTS "qli_insert_scoped" ON public.quote_line_items;
CREATE POLICY "qli_insert_scoped" ON public.quote_line_items
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_quote(quote_id));

DROP POLICY IF EXISTS "qli_update_scoped" ON public.quote_line_items;
CREATE POLICY "qli_update_scoped" ON public.quote_line_items
  FOR UPDATE TO authenticated
  USING (public.can_access_quote(quote_id))
  WITH CHECK (public.can_access_quote(quote_id));

DROP POLICY IF EXISTS "qli_delete_scoped" ON public.quote_line_items;
CREATE POLICY "qli_delete_scoped" ON public.quote_line_items
  FOR DELETE TO authenticated
  USING (public.can_access_quote(quote_id));

DROP POLICY IF EXISTS "qsh_select_scoped" ON public.quote_status_history;
CREATE POLICY "qsh_select_scoped" ON public.quote_status_history
  FOR SELECT TO authenticated
  USING (public.can_access_quote(quote_id));

DROP POLICY IF EXISTS "qci_select_all" ON public.quote_catalog_items;
CREATE POLICY "qci_select_all" ON public.quote_catalog_items
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "qci_write_manager_admin" ON public.quote_catalog_items;
CREATE POLICY "qci_write_manager_admin" ON public.quote_catalog_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
