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
  _pricing_change BOOLEAN;
BEGIN
  SELECT status, invoice_number INTO _status, _number
    FROM public.invoices WHERE id = _invoice;

  IF _status IN ('paid','cancelled') THEN
    RAISE EXCEPTION 'Invoice % is % - its items are locked', _number, _status
      USING ERRCODE = '42501';
  END IF;

  _pricing_change := TG_OP <> 'UPDATE'
    OR NEW.name             IS DISTINCT FROM OLD.name
    OR NEW.quantity         IS DISTINCT FROM OLD.quantity
    OR NEW.unit_price       IS DISTINCT FROM OLD.unit_price
    OR NEW.discount_percent IS DISTINCT FROM OLD.discount_percent
    OR NEW.tax_rate         IS DISTINCT FROM OLD.tax_rate
    OR NEW.unit             IS DISTINCT FROM OLD.unit;

  IF _pricing_change AND public.invoice_has_valid_receipt(_invoice) THEN
    RAISE EXCEPTION 'Invoice % already has a recorded payment - its items are locked', _number
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  NEW.last_modified_by := COALESCE(auth.uid(), NEW.last_modified_by);
  RETURN NEW;
END;
$function$;