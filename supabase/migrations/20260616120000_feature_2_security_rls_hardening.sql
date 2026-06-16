-- Feature 2 hardening: enforce role/ownership boundaries server-side.
-- Reps see and mutate only own/assigned operational records; managers/admins
-- keep team-wide access. Deletes remain manager/admin-only.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loss_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_value_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_assignment_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.user_roles FROM anon;
REVOKE ALL ON public.pipeline_stages FROM anon;
REVOKE ALL ON public.loss_reasons FROM anon;
REVOKE ALL ON public.companies FROM anon;
REVOKE ALL ON public.contacts FROM anon;
REVOKE ALL ON public.leads FROM anon;
REVOKE ALL ON public.deals FROM anon;
REVOKE ALL ON public.activities FROM anon;
REVOKE ALL ON public.tasks FROM anon;
REVOKE ALL ON public.deal_stage_history FROM anon;
REVOKE ALL ON public.deal_value_history FROM anon;
REVOKE ALL ON public.notifications FROM anon;
REVOKE ALL ON public.audit_log FROM anon;
REVOKE ALL ON public.app_settings FROM anon;
REVOKE ALL ON public.user_invites FROM anon;
REVOKE ALL ON public.lead_assignment_queue FROM anon;
REVOKE ALL ON public.automation_rules FROM anon;
REVOKE ALL ON public.automation_runs FROM anon;

GRANT INSERT (
  first_name,
  last_name,
  email,
  phone,
  company_name,
  message,
  source,
  ip_country,
  email_status
) ON public.leads TO anon;

CREATE OR REPLACE FUNCTION public.is_rep_owned_insert()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND NOT public.has_role(auth.uid(), 'admin')
    AND NOT public.has_role(auth.uid(), 'manager')
$$;

CREATE OR REPLACE FUNCTION public.assign_rep_company_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_rep_owned_insert() AND NEW.account_manager_id IS NULL THEN
    NEW.account_manager_id := auth.uid();
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_rep_assigned_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_rep_owned_insert() AND NEW.assigned_to IS NULL THEN
    NEW.assigned_to := auth.uid();
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_rep_activity_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_rep_owned_insert() AND NEW.owner_id IS NULL THEN
    NEW.owner_id := auth.uid();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_rep_owned_insert_companies ON public.companies;
CREATE TRIGGER assign_rep_owned_insert_companies
  BEFORE INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.assign_rep_company_insert();

DROP TRIGGER IF EXISTS assign_rep_owned_insert_contacts ON public.contacts;
CREATE TRIGGER assign_rep_owned_insert_contacts
  BEFORE INSERT ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.assign_rep_assigned_insert();

DROP TRIGGER IF EXISTS assign_rep_owned_insert_leads ON public.leads;
CREATE TRIGGER assign_rep_owned_insert_leads
  BEFORE INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.assign_rep_assigned_insert();

DROP TRIGGER IF EXISTS assign_rep_owned_insert_deals ON public.deals;
CREATE TRIGGER assign_rep_owned_insert_deals
  BEFORE INSERT ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.assign_rep_assigned_insert();

DROP TRIGGER IF EXISTS assign_rep_owned_insert_activities ON public.activities;
CREATE TRIGGER assign_rep_owned_insert_activities
  BEFORE INSERT ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.assign_rep_activity_insert();

DROP TRIGGER IF EXISTS assign_rep_owned_insert_tasks ON public.tasks;
CREATE TRIGGER assign_rep_owned_insert_tasks
  BEFORE INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.assign_rep_assigned_insert();

CREATE OR REPLACE FUNCTION public.set_user_role(target_user_id UUID, target_role public.app_role)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can manage user roles'
      USING ERRCODE = '42501';
  END IF;

  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Admins cannot change their own role'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = target_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (target_user_id, target_role);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_user_role(UUID, public.app_role) TO authenticated;

DROP POLICY IF EXISTS "co_select_all_auth" ON public.companies;
DROP POLICY IF EXISTS "co_select_scoped" ON public.companies;
DROP POLICY IF EXISTS "co_write_mgr_admin" ON public.companies;
DROP POLICY IF EXISTS "co_update_mgr_admin" ON public.companies;
DROP POLICY IF EXISTS "co_delete_mgr_admin" ON public.companies;

CREATE POLICY "co_select_scoped" ON public.companies
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (
      companies.deleted_at IS NULL
      AND (
        public.has_role(auth.uid(), 'manager')
        OR account_manager_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.contacts c
          WHERE c.company_id = companies.id
            AND c.assigned_to = auth.uid()
            AND c.deleted_at IS NULL
        )
        OR EXISTS (
          SELECT 1 FROM public.deals d
          WHERE d.company_id = companies.id
            AND d.assigned_to = auth.uid()
            AND d.deleted_at IS NULL
        )
      )
    )
  );

CREATE POLICY "co_insert_scoped" ON public.companies
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR account_manager_id IS NULL
    OR account_manager_id = auth.uid()
  );

CREATE POLICY "co_update_scoped" ON public.companies
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR account_manager_id = auth.uid()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR account_manager_id = auth.uid()
  );

CREATE POLICY "co_delete_manager_admin" ON public.companies
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "ct_select" ON public.contacts;
DROP POLICY IF EXISTS "ct_insert" ON public.contacts;
DROP POLICY IF EXISTS "ct_update" ON public.contacts;
DROP POLICY IF EXISTS "ct_delete" ON public.contacts;

CREATE POLICY "ct_select_scoped" ON public.contacts
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (
      contacts.deleted_at IS NULL
      AND (
        public.has_role(auth.uid(), 'manager')
        OR assigned_to = auth.uid()
      )
    )
  );

CREATE POLICY "ct_insert_scoped" ON public.contacts
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR assigned_to IS NULL
    OR assigned_to = auth.uid()
  );

CREATE POLICY "ct_update_scoped" ON public.contacts
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR assigned_to = auth.uid()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR assigned_to = auth.uid()
  );

CREATE POLICY "ct_delete_manager_admin" ON public.contacts
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "ld_select" ON public.leads;
DROP POLICY IF EXISTS "ld_insert" ON public.leads;
DROP POLICY IF EXISTS "ld_update" ON public.leads;
DROP POLICY IF EXISTS "ld_delete" ON public.leads;

CREATE POLICY "ld_select_scoped" ON public.leads
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (
      leads.deleted_at IS NULL
      AND (
        public.has_role(auth.uid(), 'manager')
        OR assigned_to = auth.uid()
      )
    )
  );

CREATE POLICY "ld_public_insert_capture" ON public.leads
  FOR INSERT TO anon
  WITH CHECK (
    source = 'Tally Landing Page'
    AND status = 'new'
    AND assigned_to IS NULL
    AND deleted_at IS NULL
  );

CREATE POLICY "ld_insert_scoped" ON public.leads
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR assigned_to IS NULL
    OR assigned_to = auth.uid()
  );

CREATE POLICY "ld_update_scoped" ON public.leads
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR assigned_to = auth.uid()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR assigned_to = auth.uid()
  );

CREATE POLICY "ld_delete_manager_admin" ON public.leads
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "dl_select" ON public.deals;
DROP POLICY IF EXISTS "dl_insert" ON public.deals;
DROP POLICY IF EXISTS "dl_update" ON public.deals;
DROP POLICY IF EXISTS "dl_delete" ON public.deals;

CREATE POLICY "dl_select_scoped" ON public.deals
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (
      deals.deleted_at IS NULL
      AND (
        public.has_role(auth.uid(), 'manager')
        OR assigned_to = auth.uid()
      )
    )
  );

CREATE POLICY "dl_insert_scoped" ON public.deals
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR assigned_to IS NULL
    OR assigned_to = auth.uid()
  );

CREATE POLICY "dl_update_scoped" ON public.deals
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR assigned_to = auth.uid()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR assigned_to = auth.uid()
  );

CREATE POLICY "dl_delete_manager_admin" ON public.deals
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "ac_select" ON public.activities;
DROP POLICY IF EXISTS "ac_insert" ON public.activities;
DROP POLICY IF EXISTS "ac_update" ON public.activities;
DROP POLICY IF EXISTS "ac_delete" ON public.activities;

CREATE POLICY "ac_select_scoped" ON public.activities
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (
      activities.deleted_at IS NULL
      AND (
        public.has_role(auth.uid(), 'manager')
        OR owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "ac_insert_scoped" ON public.activities
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR owner_id IS NULL
    OR owner_id = auth.uid()
  );

CREATE POLICY "ac_update_scoped" ON public.activities
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR owner_id = auth.uid()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR owner_id = auth.uid()
  );

CREATE POLICY "ac_delete_manager_admin" ON public.activities
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "tk_select" ON public.tasks;
DROP POLICY IF EXISTS "tk_insert" ON public.tasks;
DROP POLICY IF EXISTS "tk_update" ON public.tasks;
DROP POLICY IF EXISTS "tk_delete" ON public.tasks;

CREATE POLICY "tk_select_scoped" ON public.tasks
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (
      tasks.deleted_at IS NULL
      AND (
        public.has_role(auth.uid(), 'manager')
        OR assigned_to = auth.uid()
      )
    )
  );

CREATE POLICY "tk_insert_scoped" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR assigned_to IS NULL
    OR assigned_to = auth.uid()
  );

CREATE POLICY "tk_update_scoped" ON public.tasks
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR assigned_to = auth.uid()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR assigned_to = auth.uid()
  );

CREATE POLICY "tk_delete_manager_admin" ON public.tasks
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "dsh_select" ON public.deal_stage_history;
DROP POLICY IF EXISTS "dsh_insert" ON public.deal_stage_history;
DROP POLICY IF EXISTS "dvh_select" ON public.deal_value_history;
DROP POLICY IF EXISTS "dvh_insert" ON public.deal_value_history;

CREATE POLICY "dsh_select_scoped" ON public.deal_stage_history
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR EXISTS (
      SELECT 1 FROM public.deals d
      WHERE d.id = deal_stage_history.deal_id
        AND d.assigned_to = auth.uid()
        AND d.deleted_at IS NULL
    )
  );

CREATE POLICY "dsh_insert_scoped" ON public.deal_stage_history
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR (
      changed_by = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.deals d
        WHERE d.id = deal_stage_history.deal_id
          AND d.assigned_to = auth.uid()
          AND d.deleted_at IS NULL
      )
    )
  );

CREATE POLICY "dvh_select_scoped" ON public.deal_value_history
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR EXISTS (
      SELECT 1 FROM public.deals d
      WHERE d.id = deal_value_history.deal_id
        AND d.assigned_to = auth.uid()
        AND d.deleted_at IS NULL
    )
  );

CREATE POLICY "dvh_insert_scoped" ON public.deal_value_history
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR (
      changed_by = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.deals d
        WHERE d.id = deal_value_history.deal_id
          AND d.assigned_to = auth.uid()
          AND d.deleted_at IS NULL
      )
    )
  );

DROP POLICY IF EXISTS "al_insert" ON public.audit_log;
CREATE POLICY "al_insert_system_or_self" ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (actor_id IS NULL OR actor_id = auth.uid());

DROP POLICY IF EXISTS "nt_own" ON public.notifications;
CREATE POLICY "nt_select_own_active" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND deleted_at IS NULL);
CREATE POLICY "nt_insert_own" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "nt_update_own" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "lead_assignment_queue_read_all" ON public.lead_assignment_queue;
DROP POLICY IF EXISTS "lead_assignment_queue_admin_write" ON public.lead_assignment_queue;
CREATE POLICY "lead_assignment_queue_admin_all" ON public.lead_assignment_queue
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "automation_rules_read_all" ON public.automation_rules;
DROP POLICY IF EXISTS "automation_rules_admin_write" ON public.automation_rules;
CREATE POLICY "automation_rules_admin_all" ON public.automation_rules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "automation_runs_read_all" ON public.automation_runs;
DROP POLICY IF EXISTS "automation_runs_admin_insert" ON public.automation_runs;
CREATE POLICY "automation_runs_admin_all" ON public.automation_runs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
