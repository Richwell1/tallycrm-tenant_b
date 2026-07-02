-- Keep Closed-Lost deals visible in the pipeline and reports.
-- Older automation logic marked lost deals as deleted, which made them
-- disappear from app queries and scoped RLS reads. A lost deal is a closed
-- outcome, not an archived/deleted record.

CREATE OR REPLACE FUNCTION public.restore_closed_lost_deal_visibility()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_closed_lost BOOLEAN;
BEGIN
  SELECT ps.is_closed AND NOT ps.is_won
    INTO _is_closed_lost
  FROM public.pipeline_stages ps
  WHERE ps.id = NEW.stage_id;

  IF COALESCE(_is_closed_lost, false) AND NEW.deleted_at IS NOT NULL THEN
    UPDATE public.deals
    SET deleted_at = NULL
    WHERE id = NEW.id
      AND deleted_at IS NOT NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zzz_restore_closed_lost_deal_visibility ON public.deals;
CREATE TRIGGER zzz_restore_closed_lost_deal_visibility
  AFTER UPDATE OF stage_id, deleted_at ON public.deals
  FOR EACH ROW
  WHEN (NEW.deleted_at IS NOT NULL)
  EXECUTE FUNCTION public.restore_closed_lost_deal_visibility();

UPDATE public.deals AS d
SET deleted_at = NULL
FROM public.pipeline_stages AS ps
WHERE d.stage_id = ps.id
  AND ps.is_closed = true
  AND ps.is_won = false
  AND d.deleted_at IS NOT NULL;

DROP POLICY IF EXISTS "dl_select_scoped" ON public.deals;
CREATE POLICY "dl_select_scoped" ON public.deals
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (
      (
        deals.deleted_at IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.pipeline_stages ps
          WHERE ps.id = deals.stage_id
            AND ps.is_closed = true
            AND ps.is_won = false
        )
      )
      AND (
        public.has_role(auth.uid(), 'manager')
        OR assigned_to = auth.uid()
      )
    )
  );
