-- Additive: invoice discount recalculation + receipt lock.
-- No table changes, no data deletion, no RLS changes.

CREATE OR REPLACE FUNCTION public.invoice_has_valid_receipt(_invoice_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.receipts
     WHERE invoice_id = _invoice_id
       AND status = 'issued'
       AND deleted_at IS NULL
  )
$$;

REVOKE ALL ON FUNCTION public.invoice_has_valid_receipt(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.invoice_has_valid_receipt(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.invoice_has_valid_receipt(uuid) FROM authenticated;

-- Discount edits recalculate totals AND the paid rollup/status/paid_at.
CREATE OR REPLACE FUNCTION public.invoices_recalculate_on_discount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.discount_type IS DISTINCT FROM OLD.discount_type
     OR NEW.discount_value IS DISTINCT FROM OLD.discount_value THEN
    PERFORM public.recalculate_invoice_totals(NEW.id);
    PERFORM public.recalculate_invoice_payments(NEW.id);
  END IF;
  RETURN NULL;
END;
$function$;

-- Pricing/discount edits are refused once a valid receipt exists.
CREATE OR REPLACE FUNCTION public.invoices_before_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _recalculating_totals BOOLEAN :=
    COALESCE(NULLIF(current_setting('app.recalculating_invoice_totals', true), ''), 'false')::BOOLEAN;
  _recalculating_payments BOOLEAN :=
    COALESCE(NULLIF(current_setting('app.recalculating_invoice_payments', true), ''), 'false')::BOOLEAN;
BEGIN
  IF (NEW.discount_type IS DISTINCT FROM OLD.discount_type
      OR NEW.discount_value IS DISTINCT FROM OLD.discount_value)
     AND NOT _recalculating_totals
     AND NOT _recalculating_payments
     AND public.invoice_has_valid_receipt(OLD.id) THEN
    RAISE EXCEPTION 'Invoice % already has a recorded payment - void the receipt before changing its discount',
      OLD.invoice_number USING ERRCODE = '42501';
  END IF;

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
$function$;

-- Line items are locked once a valid receipt exists (as well as when paid/cancelled).
CREATE OR REPLACE FUNCTION public.invoice_line_items_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  IF pg_trigger_depth() = 1 AND public.invoice_has_valid_receipt(_invoice) THEN
    RAISE EXCEPTION 'Invoice % already has a recorded payment - its items are locked', _number
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  NEW.last_modified_by := COALESCE(auth.uid(), NEW.last_modified_by);
  RETURN NEW;
END;
$function$;

-- Bring open invoices in line with their authoritative line items and receipts.
DO $$
DECLARE
  _id UUID;
BEGIN
  FOR _id IN
    SELECT id FROM public.invoices
     WHERE deleted_at IS NULL
       AND status IN ('draft','sent','partially_paid','overdue')
  LOOP
    PERFORM public.recalculate_invoice_totals(_id);
    PERFORM public.recalculate_invoice_payments(_id);
  END LOOP;
END $$;