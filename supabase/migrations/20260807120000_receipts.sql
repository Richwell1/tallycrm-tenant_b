-- =========================================================
-- Receipts module. Receipts are payment records against invoices; invoice
-- amount_paid and payment status are derived from active receipts.
-- =========================================================

DO $$ BEGIN
  CREATE TYPE public.receipt_status AS ENUM ('issued','void');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS receipt_number_prefix TEXT NOT NULL DEFAULT 'RCT';

CREATE TABLE IF NOT EXISTS public.receipts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number   TEXT NOT NULL UNIQUE,
  status           public.receipt_status NOT NULL DEFAULT 'issued',
  invoice_id       UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  contact_id       UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  company_id       UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  deal_id          UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  quote_id         UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  assigned_to      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  currency         TEXT NOT NULL DEFAULT 'GHS',
  amount           NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  payment_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method   TEXT NOT NULL DEFAULT 'Cash',
  reference        TEXT,
  notes            TEXT,
  issued_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  issued_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  voided_at        TIMESTAMPTZ,
  voided_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ,
  origin_node_id   UUID REFERENCES public.sync_nodes(id) ON DELETE SET NULL,
  last_modified_by UUID
);

CREATE INDEX IF NOT EXISTS receipts_invoice_idx
  ON public.receipts (invoice_id, payment_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS receipts_status_idx
  ON public.receipts (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS receipts_updated_at_idx
  ON public.receipts (updated_at);

CREATE SEQUENCE IF NOT EXISTS public.receipt_number_seq;

CREATE OR REPLACE FUNCTION public.next_receipt_number()
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
  SELECT COALESCE(NULLIF(TRIM(receipt_number_prefix), ''), 'RCT'),
         NULLIF(TRIM(COALESCE(quote_number_node_prefix, '')), '')
    INTO _prefix, _node_prefix
    FROM public.app_settings
   ORDER BY (id = '00000000-0000-0000-0000-000000000001') DESC, created_at
   LIMIT 1;

  _prefix := COALESCE(_prefix, 'RCT');
  _serial := LPAD(nextval('public.receipt_number_seq')::TEXT, 5, '0');

  RETURN CONCAT_WS('-', _prefix, _node_prefix, to_char(CURRENT_DATE, 'YYYY'), _serial);
END;
$$;

REVOKE ALL ON FUNCTION public.next_receipt_number() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_receipt_number() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.recalculate_invoice_payments(_invoice_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invoice     public.invoices%ROWTYPE;
  _amount_paid NUMERIC(14,2) := 0;
  _next_status public.invoice_status;
BEGIN
  SELECT * INTO _invoice FROM public.invoices WHERE id = _invoice_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE(SUM(amount), 0)
    INTO _amount_paid
    FROM public.receipts
   WHERE invoice_id = _invoice_id
     AND status = 'issued'
     AND deleted_at IS NULL;

  _amount_paid := LEAST(_amount_paid, _invoice.total);
  _next_status := _invoice.status;

  IF _invoice.status <> 'cancelled' THEN
    IF _invoice.total > 0 AND _amount_paid >= _invoice.total THEN
      _next_status := 'paid';
    ELSIF _amount_paid > 0 THEN
      _next_status := 'partially_paid';
    ELSIF _invoice.status IN ('paid','partially_paid') THEN
      _next_status := CASE WHEN _invoice.sent_at IS NULL THEN 'draft' ELSE 'sent' END;
    END IF;
  END IF;

  PERFORM set_config('app.recalculating_invoice_payments', 'true', true);

  UPDATE public.invoices
     SET amount_paid = _amount_paid,
         status = _next_status,
         paid_at = CASE WHEN _next_status = 'paid' THEN COALESCE(paid_at, now()) ELSE NULL END
   WHERE id = _invoice_id;

  PERFORM set_config('app.recalculating_invoice_payments', '', true);
END;
$$;

REVOKE ALL ON FUNCTION public.recalculate_invoice_payments(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_invoice_payments(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.invoices_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _recalculating_totals BOOLEAN :=
    COALESCE(NULLIF(current_setting('app.recalculating_invoice_totals', true), ''), 'false')::BOOLEAN;
  _recalculating_payments BOOLEAN :=
    COALESCE(NULLIF(current_setting('app.recalculating_invoice_payments', true), ''), 'false')::BOOLEAN;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status IN ('paid','cancelled') AND NOT _recalculating_payments THEN
      RAISE EXCEPTION 'Invoice % is already % and cannot change status',
        OLD.invoice_number, OLD.status USING ERRCODE = '42501';
    END IF;
    NEW.sent_at      := CASE WHEN NEW.status = 'sent' THEN COALESCE(NEW.sent_at, now()) ELSE NEW.sent_at END;
    NEW.paid_at      := CASE WHEN NEW.status = 'paid' THEN COALESCE(NEW.paid_at, now()) ELSE NEW.paid_at END;
    NEW.cancelled_at := CASE WHEN NEW.status = 'cancelled' THEN now() ELSE NEW.cancelled_at END;
  END IF;

  IF NOT _recalculating_totals THEN
    NEW.subtotal        := OLD.subtotal;
    NEW.discount_amount := OLD.discount_amount;
    NEW.tax_amount      := OLD.tax_amount;
    NEW.total           := OLD.total;
  END IF;

  IF NOT _recalculating_payments THEN
    NEW.amount_paid := OLD.amount_paid;
  END IF;

  NEW.last_modified_by := COALESCE(auth.uid(), NEW.last_modified_by);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.receipts_before_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invoice public.invoices%ROWTYPE;
  _other_paid NUMERIC(14,2) := 0;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.invoice_id IS DISTINCT FROM OLD.invoice_id THEN
    RAISE EXCEPTION 'Receipts cannot be moved between invoices' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _invoice FROM public.invoices WHERE id = NEW.invoice_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found' USING ERRCODE = 'P0002';
  END IF;

  IF _invoice.status = 'cancelled' THEN
    RAISE EXCEPTION 'Invoice % is cancelled and cannot receive receipts',
      _invoice.invoice_number USING ERRCODE = '42501';
  END IF;

  IF NEW.status = 'issued' AND NEW.deleted_at IS NULL THEN
    SELECT COALESCE(SUM(amount), 0)
      INTO _other_paid
      FROM public.receipts
     WHERE invoice_id = NEW.invoice_id
       AND status = 'issued'
       AND deleted_at IS NULL
       AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID);

    IF _other_paid + NEW.amount > _invoice.total THEN
      RAISE EXCEPTION 'Receipt would exceed the invoice balance' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.receipt_number IS NULL OR TRIM(NEW.receipt_number) = '' THEN
      NEW.receipt_number := public.next_receipt_number();
    END IF;
    NEW.contact_id := COALESCE(NEW.contact_id, _invoice.contact_id);
    NEW.company_id := COALESCE(NEW.company_id, _invoice.company_id);
    NEW.deal_id := COALESCE(NEW.deal_id, _invoice.deal_id);
    NEW.quote_id := COALESCE(NEW.quote_id, _invoice.quote_id);
    NEW.assigned_to := COALESCE(NEW.assigned_to, _invoice.assigned_to, auth.uid());
    NEW.currency := COALESCE(NULLIF(TRIM(NEW.currency), ''), _invoice.currency);
    NEW.issued_by := COALESCE(NEW.issued_by, auth.uid());
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status = 'void' AND OLD.status IS DISTINCT FROM 'void' THEN
    NEW.voided_at := now();
    NEW.voided_by := auth.uid();
  END IF;

  NEW.last_modified_by := COALESCE(auth.uid(), NEW.last_modified_by);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.receipts_recalculate_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_invoice_payments(OLD.invoice_id);
  ELSE
    PERFORM public.recalculate_invoice_payments(NEW.invoice_id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.invoices_recalculate_payments_on_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.total IS DISTINCT FROM OLD.total THEN
    PERFORM public.recalculate_invoice_payments(NEW.id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS receipts_before_insert ON public.receipts;
CREATE TRIGGER receipts_before_insert BEFORE INSERT ON public.receipts
  FOR EACH ROW EXECUTE FUNCTION public.receipts_before_write();

DROP TRIGGER IF EXISTS receipts_before_update ON public.receipts;
CREATE TRIGGER receipts_before_update BEFORE UPDATE ON public.receipts
  FOR EACH ROW EXECUTE FUNCTION public.receipts_before_write();

DROP TRIGGER IF EXISTS set_updated_at_receipts ON public.receipts;
CREATE TRIGGER set_updated_at_receipts BEFORE UPDATE ON public.receipts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS receipts_recalculate_invoice ON public.receipts;
CREATE TRIGGER receipts_recalculate_invoice AFTER INSERT OR UPDATE OR DELETE ON public.receipts
  FOR EACH ROW EXECUTE FUNCTION public.receipts_recalculate_invoice();

DROP TRIGGER IF EXISTS invoices_recalculate_payments_on_total ON public.invoices;
CREATE TRIGGER invoices_recalculate_payments_on_total AFTER UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.invoices_recalculate_payments_on_total();

REVOKE ALL ON public.receipts FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receipts TO authenticated;
GRANT ALL ON public.receipts TO service_role;

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "receipts_select_scoped" ON public.receipts;
CREATE POLICY "receipts_select_scoped" ON public.receipts
  FOR SELECT TO authenticated USING (public.can_access_invoice(invoice_id));

DROP POLICY IF EXISTS "receipts_insert_scoped" ON public.receipts;
CREATE POLICY "receipts_insert_scoped" ON public.receipts
  FOR INSERT TO authenticated WITH CHECK (public.can_access_invoice(invoice_id));

DROP POLICY IF EXISTS "receipts_update_scoped" ON public.receipts;
CREATE POLICY "receipts_update_scoped" ON public.receipts
  FOR UPDATE TO authenticated
  USING (public.can_access_invoice(invoice_id))
  WITH CHECK (public.can_access_invoice(invoice_id));

DROP POLICY IF EXISTS "receipts_delete_scoped" ON public.receipts;
CREATE POLICY "receipts_delete_scoped" ON public.receipts
  FOR DELETE TO authenticated USING (public.can_access_invoice(invoice_id));

NOTIFY pgrst, 'reload schema';
