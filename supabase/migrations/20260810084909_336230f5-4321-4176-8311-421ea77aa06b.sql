-- Repair: the invoice line recalculation trigger in this database was created
-- without the recursion guard from 20260807093000_guard_invoice_line_item_recalculation.sql.
-- recalculate_invoice_totals() re-writes invoice_line_items, which re-fired the
-- same AFTER trigger until "stack depth limit exceeded" aborted the transaction.
-- quote_line_items_recalculate already carries this guard; mirror it here.

DROP TRIGGER IF EXISTS invoice_line_items_recalculate ON public.invoice_line_items;

CREATE TRIGGER invoice_line_items_recalculate
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_line_items
  FOR EACH ROW
  WHEN (pg_trigger_depth() = 0)
  EXECUTE FUNCTION public.invoice_line_items_recalculate();