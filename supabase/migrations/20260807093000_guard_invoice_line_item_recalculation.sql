-- Prevent invoice total recalculation from recursively firing itself, and allow
-- the server-owned invoice totals to be written only by the recalculation path.

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

  PERFORM set_config('app.recalculating_invoice_totals', 'true', true);

  UPDATE public.invoices
     SET subtotal        = _subtotal,
         discount_amount = _discount_amount,
         tax_amount      = _tax_amount,
         total           = _subtotal - _discount_amount + _tax_amount
   WHERE id = _invoice_id;

  PERFORM set_config('app.recalculating_invoice_totals', '', true);
END;
$$;

REVOKE ALL ON FUNCTION public.recalculate_invoice_totals(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_invoice_totals(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.invoices_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _recalculating BOOLEAN :=
    COALESCE(NULLIF(current_setting('app.recalculating_invoice_totals', true), ''), 'false')::BOOLEAN;
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

  IF NOT _recalculating THEN
    NEW.subtotal        := OLD.subtotal;
    NEW.discount_amount := OLD.discount_amount;
    NEW.tax_amount      := OLD.tax_amount;
    NEW.total           := OLD.total;
  END IF;

  NEW.last_modified_by := COALESCE(auth.uid(), NEW.last_modified_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoice_line_items_recalculate ON public.invoice_line_items;

CREATE TRIGGER invoice_line_items_recalculate
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_line_items
  FOR EACH ROW
  WHEN (pg_trigger_depth() = 0)
  EXECUTE FUNCTION public.invoice_line_items_recalculate();
