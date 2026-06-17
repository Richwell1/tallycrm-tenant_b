-- Landing-page leads must remain in an admin/manager-only queue until they
-- are explicitly assigned. Reps see only leads assigned to them; manual lead
-- creation by reps remains owned by that rep.

CREATE OR REPLACE FUNCTION public.capture_landing_lead(
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_company_name text,
  p_message text,
  p_ip_country text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_id uuid;
  v_existing_contact_id uuid;
  v_existing_assigned uuid;
  v_lead_name text;
  v_email text := lower(trim(p_email));
BEGIN
  IF v_email IS NULL OR v_email = '' OR p_first_name IS NULL OR p_last_name IS NULL THEN
    RAISE EXCEPTION 'Missing required fields';
  END IF;

  SELECT id, assigned_to INTO v_existing_contact_id, v_existing_assigned
  FROM public.contacts
  WHERE email = v_email AND deleted_at IS NULL
  LIMIT 1;

  INSERT INTO public.leads (
    first_name, last_name, email, phone, company_name, message,
    source, status, ip_country, assigned_to, email_status
  ) VALUES (
    p_first_name, p_last_name, v_email,
    nullif(p_phone, ''), nullif(p_company_name, ''), nullif(p_message, ''),
    'Tally Landing Page', 'new'::lead_status, p_ip_country, NULL, 'queued'
  )
  RETURNING id INTO v_lead_id;

  v_lead_name := trim(p_first_name || ' ' || p_last_name);

  INSERT INTO public.email_queue (template, recipient, subject, payload, related_entity, related_entity_id)
  VALUES (
    'landing_lead_confirmation',
    v_email,
    'We received your TallyPrime demo request',
    jsonb_build_object(
      'first_name', p_first_name,
      'last_name', p_last_name,
      'company_name', nullif(p_company_name, ''),
      'message', nullif(p_message, '')
    ),
    'lead',
    v_lead_id
  );

  INSERT INTO public.audit_log (entity, entity_id, entity_name, action, actor_id, metadata)
  VALUES (
    'lead', v_lead_id, v_lead_name, 'create', NULL,
    jsonb_build_object(
      'source', 'Tally Landing Page',
      'ip_country', p_ip_country,
      'assigned_to', NULL,
      'existing_contact_id', v_existing_contact_id,
      'existing_contact_assigned_to', v_existing_assigned,
      'assignment_mode', 'manual'
    )
  );

  RETURN v_lead_id;
END;
$$;

REVOKE ALL ON FUNCTION public.capture_landing_lead(text,text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.capture_landing_lead(text,text,text,text,text,text,text) TO anon, authenticated;

DROP POLICY IF EXISTS "ld_insert_scoped" ON public.leads;
CREATE POLICY "ld_insert_scoped" ON public.leads
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR assigned_to = auth.uid()
  );

DROP POLICY IF EXISTS "ld_update_scoped" ON public.leads;
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

CREATE OR REPLACE FUNCTION public.handle_lead_manual_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_name text;
BEGIN
  IF NEW.assigned_to IS NULL OR NEW.assigned_to IS NOT DISTINCT FROM OLD.assigned_to THEN
    RETURN NEW;
  END IF;

  v_lead_name := trim(NEW.first_name || ' ' || NEW.last_name);

  IF OLD.assigned_to IS NULL THEN
    INSERT INTO public.tasks (title, type, due_at, priority, assigned_to, notes)
    VALUES (
      'Make first contact: ' || v_lead_name,
      'call',
      now() + interval '4 hours',
      'high'::task_priority,
      NEW.assigned_to,
      'Created when the lead was assigned. Email: ' || NEW.email
    );
  END IF;

  PERFORM public.notify_user(
    NEW.assigned_to,
    'lead_assignment',
    'New lead assigned',
    v_lead_name || ' is now assigned to you.',
    'lead',
    NEW.id
  );

  INSERT INTO public.audit_log (entity, entity_id, entity_name, action, actor_id, metadata)
  VALUES (
    'lead',
    NEW.id,
    v_lead_name,
    'assign',
    auth.uid(),
    jsonb_build_object('from', OLD.assigned_to, 'to', NEW.assigned_to)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_lead_manual_assignment ON public.leads;
CREATE TRIGGER trg_handle_lead_manual_assignment
  AFTER UPDATE OF assigned_to ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_lead_manual_assignment();

ALTER TABLE public.app_settings
  ALTER COLUMN assignment_strategy SET DEFAULT 'manual';

UPDATE public.app_settings
SET assignment_strategy = 'manual'
WHERE assignment_strategy = 'round_robin';
