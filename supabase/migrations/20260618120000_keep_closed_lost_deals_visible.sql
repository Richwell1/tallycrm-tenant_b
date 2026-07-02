-- Closed-Lost deals are reportable CRM records, not deleted records.
-- The existing stage-change trigger sets deals.deleted_at when a deal is
-- moved to the Closed-Lost stage, which hides it from scoped RLS policies and
-- from app queries that filter on deleted_at IS NULL. Keep those deals visible.

CREATE OR REPLACE FUNCTION public.keep_closed_lost_deals_visible()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _stage RECORD;
BEGIN
  SELECT is_closed, is_won
    INTO _stage
  FROM public.pipeline_stages
  WHERE id = NEW.stage_id;

  IF COALESCE(_stage.is_closed, false) AND NOT COALESCE(_stage.is_won, false) THEN
    NEW.deleted_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zz_keep_closed_lost_deals_visible ON public.deals;
CREATE TRIGGER zz_keep_closed_lost_deals_visible
  BEFORE UPDATE OF stage_id ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.keep_closed_lost_deals_visible();

UPDATE public.deals AS d
SET deleted_at = NULL
FROM public.pipeline_stages AS ps
WHERE d.stage_id = ps.id
  AND ps.is_closed = true
  AND ps.is_won = false
  AND d.deleted_at IS NOT NULL;
