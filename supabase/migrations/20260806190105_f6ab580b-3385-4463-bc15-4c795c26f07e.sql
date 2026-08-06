-- Helper: may the current user assign a record to _target?
CREATE OR REPLACE FUNCTION public.can_assign_owner(_target uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND (
       public.has_role(auth.uid(), 'admin')
       OR public.has_role(auth.uid(), 'manager')
       OR _target = auth.uid()
     )
$$;

REVOKE ALL ON FUNCTION public.can_assign_owner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_assign_owner(uuid) TO authenticated, service_role;

-- Default owner to the acting user when omitted
CREATE OR REPLACE FUNCTION public.default_assigned_to()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_to IS NULL THEN
    NEW.assigned_to := auth.uid();
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.default_owner_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_id IS NULL THEN
    NEW.owner_id := auth.uid();
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.default_assigned_to() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.default_owner_id() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_default_assigned_to ON public.leads;
CREATE TRIGGER trg_default_assigned_to BEFORE INSERT ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.default_assigned_to();

DROP TRIGGER IF EXISTS trg_default_assigned_to ON public.deals;
CREATE TRIGGER trg_default_assigned_to BEFORE INSERT ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.default_assigned_to();

DROP TRIGGER IF EXISTS trg_default_assigned_to ON public.contacts;
CREATE TRIGGER trg_default_assigned_to BEFORE INSERT ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.default_assigned_to();

DROP TRIGGER IF EXISTS trg_default_assigned_to ON public.tasks;
CREATE TRIGGER trg_default_assigned_to BEFORE INSERT ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.default_assigned_to();

DROP TRIGGER IF EXISTS trg_default_owner_id ON public.activities;
CREATE TRIGGER trg_default_owner_id BEFORE INSERT ON public.activities
FOR EACH ROW EXECUTE FUNCTION public.default_owner_id();

-- Ownership-scoped INSERT policies
DROP POLICY IF EXISTS ld_insert ON public.leads;
CREATE POLICY ld_insert ON public.leads FOR INSERT TO authenticated
WITH CHECK (public.can_assign_owner(assigned_to));

DROP POLICY IF EXISTS dl_insert ON public.deals;
CREATE POLICY dl_insert ON public.deals FOR INSERT TO authenticated
WITH CHECK (public.can_assign_owner(assigned_to));

DROP POLICY IF EXISTS ct_insert ON public.contacts;
CREATE POLICY ct_insert ON public.contacts FOR INSERT TO authenticated
WITH CHECK (public.can_assign_owner(assigned_to));

DROP POLICY IF EXISTS tk_insert ON public.tasks;
CREATE POLICY tk_insert ON public.tasks FOR INSERT TO authenticated
WITH CHECK (public.can_assign_owner(assigned_to));

DROP POLICY IF EXISTS ac_insert ON public.activities;
CREATE POLICY ac_insert ON public.activities FOR INSERT TO authenticated
WITH CHECK (public.can_assign_owner(owner_id));

-- History tables: no forged entries
DROP POLICY IF EXISTS dsh_insert ON public.deal_stage_history;
CREATE POLICY dsh_insert ON public.deal_stage_history FOR INSERT TO authenticated
WITH CHECK (
  changed_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.deals d
     WHERE d.id = deal_id
       AND (public.has_role(auth.uid(),'admin')
            OR public.has_role(auth.uid(),'manager')
            OR d.assigned_to = auth.uid())
  )
);

DROP POLICY IF EXISTS dvh_insert ON public.deal_value_history;
CREATE POLICY dvh_insert ON public.deal_value_history FOR INSERT TO authenticated
WITH CHECK (
  changed_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.deals d
     WHERE d.id = deal_id
       AND (public.has_role(auth.uid(),'admin')
            OR public.has_role(auth.uid(),'manager')
            OR d.assigned_to = auth.uid())
  )
);

DROP POLICY IF EXISTS lead_status_history_insert_all ON public.lead_status_history;
CREATE POLICY lead_status_history_insert ON public.lead_status_history FOR INSERT TO authenticated
WITH CHECK (
  changed_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.leads l
     WHERE l.id = lead_id
       AND (public.has_role(auth.uid(),'admin')
            OR public.has_role(auth.uid(),'manager')
            OR l.assigned_to = auth.uid())
  )
);

-- Internal SECURITY DEFINER helpers should not be callable from the API
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE ALL ON FUNCTION public.next_quote_number() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.next_invoice_number() FROM anon, authenticated;
