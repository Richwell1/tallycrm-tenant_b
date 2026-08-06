REVOKE ALL ON FUNCTION public.invoices_before_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.invoices_before_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.invoices_recalculate_on_discount() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.invoices_log_status_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.invoice_line_items_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.invoice_line_items_recalculate() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recalculate_invoice_totals(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.next_invoice_number() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_invoice(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_invoice_from_quote(UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.next_invoice_number() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_invoice(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_invoice_from_quote(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_invoice_totals(UUID) TO service_role;