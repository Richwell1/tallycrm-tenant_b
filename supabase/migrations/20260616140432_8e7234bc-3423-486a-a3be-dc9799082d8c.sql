
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
  v_assigned_to uuid;
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

  SELECT ur.user_id INTO v_assigned_to
  FROM public.user_roles ur
  WHERE ur.role = 'rep'
  ORDER BY (
    SELECT count(*) FROM public.leads l
    WHERE l.assigned_to = ur.user_id
      AND l.status IN ('new'::lead_status, 'contacted'::lead_status, 'qualified'::lead_status)
  ) ASC, ur.user_id ASC
  LIMIT 1;

  IF v_existing_assigned IS NOT NULL THEN
    v_assigned_to := v_existing_assigned;
  END IF;

  INSERT INTO public.leads (
    first_name, last_name, email, phone, company_name, message,
    source, status, ip_country, assigned_to, email_status
  ) VALUES (
    p_first_name, p_last_name, v_email,
    nullif(p_phone, ''), nullif(p_company_name, ''), nullif(p_message, ''),
    'Tally Landing Page', 'new'::lead_status, p_ip_country, v_assigned_to, 'queued'
  )
  RETURNING id INTO v_lead_id;

  v_lead_name := trim(p_first_name || ' ' || p_last_name);

  INSERT INTO public.tasks (title, type, due_at, priority, assigned_to, contact_id, notes)
  VALUES (
    'Make first contact: ' || v_lead_name,
    'call',
    now() + interval '4 hours',
    'high'::task_priority,
    v_assigned_to,
    v_existing_contact_id,
    'Auto-created from Tally Landing Page lead. Email: ' || v_email
  );

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
      'assigned_to', v_assigned_to,
      'existing_contact_id', v_existing_contact_id
    )
  );

  RETURN v_lead_id;
END;
$$;

REVOKE ALL ON FUNCTION public.capture_landing_lead(text,text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.capture_landing_lead(text,text,text,text,text,text,text) TO anon, authenticated;
