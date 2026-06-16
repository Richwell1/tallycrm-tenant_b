-- ============================================================================
-- Tally CRM — Automation Engine
-- ============================================================================

-- Extensions ----------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- automation_rules (data-driven)
CREATE TABLE IF NOT EXISTS public.automation_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  trigger_type TEXT NOT NULL,
  trigger_label TEXT NOT NULL DEFAULT '',
  trigger_icon TEXT NOT NULL DEFAULT 'bolt',
  object TEXT NOT NULL,
  condition TEXT NOT NULL DEFAULT '',
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  is_default BOOLEAN NOT NULL DEFAULT false,
  owner TEXT NOT NULL DEFAULT 'system',
  success_rate NUMERIC NOT NULL DEFAULT 0,
  audit_logged BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_run_at TIMESTAMPTZ
);

ALTER TABLE public.automation_rules
  ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS config JSONB NOT NULL DEFAULT '{}'::jsonb;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_rules TO authenticated;
GRANT ALL ON public.automation_rules TO service_role;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "automation_rules_read_all" ON public.automation_rules;
DROP POLICY IF EXISTS "automation_rules_admin_write" ON public.automation_rules;
DROP POLICY IF EXISTS "automation_rules_admin_all" ON public.automation_rules;
CREATE POLICY "automation_rules_read_all" ON public.automation_rules
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "automation_rules_admin_write" ON public.automation_rules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP TRIGGER IF EXISTS set_updated_at_automation_rules ON public.automation_rules;
CREATE TRIGGER set_updated_at_automation_rules
  BEFORE UPDATE ON public.automation_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- automation_runs (log)
CREATE TABLE IF NOT EXISTS public.automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id TEXT REFERENCES public.automation_rules(id) ON DELETE SET NULL,
  record_name TEXT NOT NULL DEFAULT '',
  record_type TEXT NOT NULL DEFAULT '',
  record_id UUID,
  action_taken TEXT NOT NULL,
  result TEXT NOT NULL DEFAULT 'success',
  duration_ms INT NOT NULL DEFAULT 0,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.automation_runs ADD COLUMN IF NOT EXISTS record_id UUID;

GRANT SELECT, INSERT ON public.automation_runs TO authenticated;
GRANT ALL ON public.automation_runs TO service_role;
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "automation_runs_read_all" ON public.automation_runs;
DROP POLICY IF EXISTS "automation_runs_service_insert" ON public.automation_runs;
CREATE POLICY "automation_runs_read_all" ON public.automation_runs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "automation_runs_service_insert" ON public.automation_runs
  FOR INSERT TO authenticated WITH CHECK (true);

-- lead_status_history
CREATE TABLE IF NOT EXISTS public.lead_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  from_status public.lead_status,
  to_status public.lead_status NOT NULL,
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.lead_status_history TO authenticated;
GRANT ALL ON public.lead_status_history TO service_role;
ALTER TABLE public.lead_status_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lead_status_history_read_all" ON public.lead_status_history;
DROP POLICY IF EXISTS "lead_status_history_insert_all" ON public.lead_status_history;
CREATE POLICY "lead_status_history_read_all" ON public.lead_status_history
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "lead_status_history_insert_all" ON public.lead_status_history
  FOR INSERT TO authenticated WITH CHECK (true);

-- email_queue
CREATE TABLE IF NOT EXISTS public.email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  related_entity TEXT,
  related_entity_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE ON public.email_queue TO authenticated;
GRANT ALL ON public.email_queue TO service_role;
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "email_queue_admin_read" ON public.email_queue;
DROP POLICY IF EXISTS "email_queue_service_all" ON public.email_queue;
CREATE POLICY "email_queue_admin_read" ON public.email_queue
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
-- service_role bypasses RLS, no explicit policy needed for writes

-- columns on leads/deals -----------------------------------------------------
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS overdue_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_status_change_at TIMESTAMPTZ;

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS last_stage_change_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS overdue_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.automation_rule_enabled(_rule_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT enabled FROM public.automation_rules WHERE id = _rule_id),
    FALSE
  );
$$;

CREATE OR REPLACE FUNCTION public.automation_rule_config(_rule_id TEXT)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT config FROM public.automation_rules WHERE id = _rule_id),
    '{}'::jsonb
  );
$$;

CREATE OR REPLACE FUNCTION public.log_automation_run(
  _rule_id TEXT, _record_type TEXT, _record_id UUID, _record_name TEXT,
  _action TEXT, _result TEXT DEFAULT 'success', _message TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.automation_runs(rule_id, record_type, record_id, record_name, action_taken, result, message)
  VALUES (_rule_id, _record_type, _record_id, _record_name, _action, _result, _message);
  UPDATE public.automation_rules SET last_run_at = now() WHERE id = _rule_id;
END $$;

CREATE OR REPLACE FUNCTION public.log_audit_system(
  _action TEXT, _entity TEXT, _entity_id UUID, _entity_name TEXT, _metadata JSONB DEFAULT '{}'::jsonb
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_log(actor_id, action, entity, entity_id, entity_name, metadata)
  VALUES (NULL, _action, _entity, _entity_id, _entity_name,
          _metadata || jsonb_build_object('actor','system'));
END $$;

CREATE OR REPLACE FUNCTION public.notify_user(
  _user_id UUID, _type TEXT, _title TEXT, _body TEXT,
  _entity TEXT DEFAULT NULL, _entity_id UUID DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.notifications(user_id, type, title, body, entity, entity_id)
  VALUES (_user_id, _type, _title, _body, _entity, _entity_id);
END $$;

CREATE OR REPLACE FUNCTION public.queue_email(
  _template TEXT, _recipient TEXT, _subject TEXT, _payload JSONB,
  _entity TEXT DEFAULT NULL, _entity_id UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _id UUID;
BEGIN
  IF _recipient IS NULL OR _recipient = '' THEN RETURN NULL; END IF;
  INSERT INTO public.email_queue(template, recipient, subject, payload, related_entity, related_entity_id)
  VALUES (_template, _recipient, _subject, _payload, _entity, _entity_id)
  RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.create_auto_task(
  _title TEXT, _type TEXT, _due_in_days NUMERIC,
  _assigned_to UUID, _deal_id UUID DEFAULT NULL, _contact_id UUID DEFAULT NULL,
  _reminder_in_days NUMERIC DEFAULT NULL, _priority public.task_priority DEFAULT 'medium'
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _id UUID;
BEGIN
  INSERT INTO public.tasks(title, type, due_at, reminder_at, status, priority,
                           contact_id, deal_id, assigned_to, notes)
  VALUES (
    _title, _type,
    now() + (_due_in_days || ' days')::interval,
    CASE WHEN _reminder_in_days IS NULL THEN NULL
         ELSE now() + (_reminder_in_days || ' days')::interval END,
    'pending', _priority, _contact_id, _deal_id, _assigned_to,
    'Created by automation engine'
  ) RETURNING id INTO _id;
  RETURN _id;
END $$;

-- ---------------------------------------------------------------------------
-- Lead stage-change trigger
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_lead_stage_change()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _cfg JSONB;
  _owner UUID;
  _name TEXT;
  _task UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.last_status_change_at := now();
    RETURN NEW;
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  NEW.last_status_change_at := now();
  NEW.overdue_at := NULL;
  _owner := NEW.assigned_to;
  _name := TRIM(COALESCE(NEW.first_name,'') || ' ' || COALESCE(NEW.last_name,''));
  IF _name = '' THEN _name := COALESCE(NEW.email, NEW.company_name, 'lead'); END IF;

  -- Always write status history
  INSERT INTO public.lead_status_history(lead_id, from_status, to_status, changed_by)
  VALUES (NEW.id, OLD.status, NEW.status, auth.uid());

  -- New → Contacted: Qualify (BANT) +2d
  IF NEW.status = 'contacted' AND OLD.status = 'new'
     AND public.automation_rule_enabled('lead_new_to_contacted') THEN
    _cfg := public.automation_rule_config('lead_new_to_contacted');
    _task := public.create_auto_task(
      'Qualify (BANT) — ' || _name,
      'call',
      COALESCE((_cfg->>'due_in_days')::numeric, 2),
      _owner, NULL, NULL, NULL, 'high'
    );
    PERFORM public.log_automation_run('lead_new_to_contacted','lead',NEW.id,_name,'task_created');
    PERFORM public.log_audit_system('automation.task_created','lead',NEW.id,_name,
            jsonb_build_object('task_id',_task,'rule','lead_new_to_contacted'));
    PERFORM public.notify_user(_owner,'task','New qualification task',
            'BANT call task created for ' || _name,'lead',NEW.id);
  END IF;

  -- Contacted → Qualified: Prepare demo / convert +1d
  IF NEW.status = 'qualified' AND OLD.status <> 'qualified'
     AND public.automation_rule_enabled('lead_to_qualified') THEN
    _cfg := public.automation_rule_config('lead_to_qualified');
    _task := public.create_auto_task(
      'Prepare demo / convert — ' || _name,
      'demo',
      COALESCE((_cfg->>'due_in_days')::numeric, 1),
      _owner, NULL, NULL, NULL, 'high'
    );
    PERFORM public.log_automation_run('lead_to_qualified','lead',NEW.id,_name,'task_created');
    PERFORM public.log_audit_system('automation.task_created','lead',NEW.id,_name,
            jsonb_build_object('task_id',_task,'rule','lead_to_qualified'));
    PERFORM public.notify_user(_owner,'task','Lead qualified',
            _name || ' is qualified — prepare demo.','lead',NEW.id);
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_handle_lead_stage_change ON public.leads;
CREATE TRIGGER trg_handle_lead_stage_change
  BEFORE INSERT OR UPDATE OF status ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.handle_lead_stage_change();

-- ---------------------------------------------------------------------------
-- Deal stage-change trigger
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_deal_stage_change()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _new_stage public.pipeline_stages%ROWTYPE;
  _old_stage public.pipeline_stages%ROWTYPE;
  _cfg JSONB;
  _owner UUID;
  _task UUID;
  _mgr RECORD;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.last_stage_change_at := now();
    SELECT * INTO _new_stage FROM public.pipeline_stages WHERE id = NEW.stage_id;
    IF NEW.probability IS NULL AND _new_stage.default_probability IS NOT NULL THEN
      NEW.probability := _new_stage.default_probability;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.stage_id IS NOT DISTINCT FROM OLD.stage_id THEN
    RETURN NEW;
  END IF;

  SELECT * INTO _new_stage FROM public.pipeline_stages WHERE id = NEW.stage_id;
  SELECT * INTO _old_stage FROM public.pipeline_stages WHERE id = OLD.stage_id;
  _owner := NEW.assigned_to;
  NEW.last_stage_change_at := now();
  NEW.overdue_at := NULL;

  -- Reset probability to stage default unless going to closed
  IF _new_stage.default_probability IS NOT NULL AND NOT _new_stage.is_closed THEN
    NEW.probability := _new_stage.default_probability;
  END IF;

  -- stage history
  INSERT INTO public.deal_stage_history(deal_id, from_stage, to_stage, changed_by)
  VALUES (NEW.id, OLD.stage_id, NEW.stage_id, auth.uid());

  -- Proposal Submitted: Send proposal +1d + reminder +3d
  IF _new_stage.name IN ('Proposal Submitted','Demo')
     AND public.automation_rule_enabled('deal_to_proposal') THEN
    _cfg := public.automation_rule_config('deal_to_proposal');
    _task := public.create_auto_task(
      'Send proposal — ' || NEW.name,
      'proposal',
      COALESCE((_cfg->>'due_in_days')::numeric, 1),
      _owner, NEW.id, NEW.primary_contact_id,
      COALESCE((_cfg->>'reminder_in_days')::numeric, 3),
      'high'
    );
    PERFORM public.log_automation_run('deal_to_proposal','deal',NEW.id,NEW.name,'task_created');
    PERFORM public.log_audit_system('automation.task_created','deal',NEW.id,NEW.name,
            jsonb_build_object('task_id',_task,'rule','deal_to_proposal'));
    PERFORM public.notify_user(_owner,'task','Proposal stage',
            'Send proposal task created for ' || NEW.name,'deal',NEW.id);
  END IF;

  -- Negotiation: Follow up +2d
  IF _new_stage.name = 'Negotiation'
     AND public.automation_rule_enabled('deal_to_negotiation') THEN
    _cfg := public.automation_rule_config('deal_to_negotiation');
    _task := public.create_auto_task(
      'Follow up on negotiation — ' || NEW.name,
      'call',
      COALESCE((_cfg->>'due_in_days')::numeric, 2),
      _owner, NEW.id, NEW.primary_contact_id, NULL, 'high'
    );
    PERFORM public.log_automation_run('deal_to_negotiation','deal',NEW.id,NEW.name,'task_created');
    PERFORM public.log_audit_system('automation.task_created','deal',NEW.id,NEW.name,
            jsonb_build_object('task_id',_task,'rule','deal_to_negotiation'));
  END IF;

  -- Closed-Won: prob 100, welcome +1d, renewal +11mo, notify managers + admins
  IF _new_stage.is_closed AND _new_stage.is_won
     AND public.automation_rule_enabled('deal_won') THEN
    _cfg := public.automation_rule_config('deal_won');
    NEW.probability := 100;
    NEW.actual_close_date := COALESCE(NEW.actual_close_date, CURRENT_DATE);
    NEW.actual_value := COALESCE(NEW.actual_value, NEW.value);

    _task := public.create_auto_task(
      'Send welcome — ' || NEW.name, 'email',
      COALESCE((_cfg->>'welcome_due_in_days')::numeric, 1),
      _owner, NEW.id, NEW.primary_contact_id, NULL, 'high'
    );
    PERFORM public.log_automation_run('deal_won','deal',NEW.id,NEW.name,'welcome_task_created');

    _task := public.create_auto_task(
      'Renewal check-in — ' || NEW.name, 'call',
      COALESCE((_cfg->>'renewal_due_in_days')::numeric, 330),  -- ~11 months
      _owner, NEW.id, NEW.primary_contact_id, NULL, 'medium'
    );
    PERFORM public.log_automation_run('deal_won','deal',NEW.id,NEW.name,'renewal_task_created');

    -- notify managers + admins
    FOR _mgr IN
      SELECT ur.user_id FROM public.user_roles ur
      WHERE ur.role IN ('manager','admin')
    LOOP
      PERFORM public.notify_user(_mgr.user_id,'deal_won','Deal won 🎉',
              NEW.name || ' was closed-won.','deal',NEW.id);
    END LOOP;

    PERFORM public.log_audit_system('automation.deal_won','deal',NEW.id,NEW.name,
            jsonb_build_object('rule','deal_won'));
  END IF;

  -- Closed-Lost: require reason, prob 0, archive, re-engagement +90d
  IF _new_stage.is_closed AND NOT _new_stage.is_won
     AND public.automation_rule_enabled('deal_lost') THEN
    IF NEW.lost_reason IS NULL OR LENGTH(TRIM(NEW.lost_reason)) = 0 THEN
      RAISE EXCEPTION 'A lost_reason is required when moving a deal to Closed-Lost';
    END IF;
    _cfg := public.automation_rule_config('deal_lost');
    NEW.probability := 0;
    NEW.actual_close_date := COALESCE(NEW.actual_close_date, CURRENT_DATE);
    NEW.deleted_at := COALESCE(NEW.deleted_at, now());

    _task := public.create_auto_task(
      'Re-engagement check — ' || NEW.name, 'call',
      COALESCE((_cfg->>'reengagement_due_in_days')::numeric, 90),
      _owner, NEW.id, NEW.primary_contact_id, NULL, 'low'
    );
    PERFORM public.log_automation_run('deal_lost','deal',NEW.id,NEW.name,'reengagement_task_created');
    PERFORM public.log_audit_system('automation.deal_lost','deal',NEW.id,NEW.name,
            jsonb_build_object('rule','deal_lost','lost_reason',NEW.lost_reason));
    PERFORM public.notify_user(_owner,'deal_lost','Deal closed-lost',
            NEW.name || ' lost: ' || NEW.lost_reason,'deal',NEW.id);
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_handle_deal_stage_change ON public.deals;
CREATE TRIGGER trg_handle_deal_stage_change
  BEFORE INSERT OR UPDATE OF stage_id ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.handle_deal_stage_change();

-- ---------------------------------------------------------------------------
-- Deal value-change trigger (records history with reason via session var)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_deal_value_change()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _reason TEXT;
BEGIN
  IF NEW.value IS NOT DISTINCT FROM OLD.value THEN RETURN NEW; END IF;
  _reason := NULLIF(current_setting('app.deal_value_change_reason', true), '');
  INSERT INTO public.deal_value_history(deal_id, old_value, new_value, reason, changed_by)
  VALUES (NEW.id, OLD.value, NEW.value, _reason, auth.uid());
  PERFORM public.log_audit_system('deal.value_changed','deal',NEW.id,NEW.name,
          jsonb_build_object('old',OLD.value,'new',NEW.value,'reason',_reason));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_handle_deal_value_change ON public.deals;
CREATE TRIGGER trg_handle_deal_value_change
  AFTER UPDATE OF value ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.handle_deal_value_change();

-- RPC for value updates that carries reason
CREATE OR REPLACE FUNCTION public.update_deal_value(
  _deal_id UUID, _new_value NUMERIC, _reason TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF _reason IS NULL OR LENGTH(TRIM(_reason)) = 0 THEN
    RAISE EXCEPTION 'A reason is required when updating deal value';
  END IF;
  PERFORM set_config('app.deal_value_change_reason', _reason, true);
  UPDATE public.deals SET value = _new_value, updated_at = now()
  WHERE id = _deal_id;
  PERFORM set_config('app.deal_value_change_reason', '', true);
END $$;
GRANT EXECUTE ON FUNCTION public.update_deal_value(UUID,NUMERIC,TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Lead convert RPC: creates deal + "Schedule Tally demo" +2d
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.convert_lead_to_deal(
  _lead_id UUID, _deal_name TEXT, _value NUMERIC DEFAULT 0,
  _stage_id UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _lead public.leads%ROWTYPE;
  _deal_id UUID;
  _stage UUID;
  _cfg JSONB;
  _task UUID;
BEGIN
  SELECT * INTO _lead FROM public.leads WHERE id = _lead_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lead % not found', _lead_id; END IF;

  _stage := _stage_id;
  IF _stage IS NULL THEN
    SELECT id INTO _stage FROM public.pipeline_stages
    WHERE NOT is_closed ORDER BY position LIMIT 1;
  END IF;

  INSERT INTO public.deals(name, value, currency, stage_id, assigned_to, description)
  VALUES (_deal_name, COALESCE(_value, _lead.value, 0),
          COALESCE(_lead.currency,'USD'), _stage, _lead.assigned_to,
          'Converted from lead ' || _lead_id)
  RETURNING id INTO _deal_id;

  UPDATE public.leads
  SET status = 'converted', converted_deal_id = _deal_id, updated_at = now()
  WHERE id = _lead_id;

  IF public.automation_rule_enabled('lead_converted') THEN
    _cfg := public.automation_rule_config('lead_converted');
    _task := public.create_auto_task(
      'Schedule Tally demo — ' || _deal_name, 'demo',
      COALESCE((_cfg->>'due_in_days')::numeric, 2),
      _lead.assigned_to, _deal_id, NULL, NULL, 'high'
    );
    PERFORM public.log_automation_run('lead_converted','deal',_deal_id,_deal_name,'task_created');
    PERFORM public.log_audit_system('automation.lead_converted','deal',_deal_id,_deal_name,
            jsonb_build_object('lead_id',_lead_id,'task_id',_task));
    PERFORM public.notify_user(_lead.assigned_to,'task','Lead converted',
            'Demo task created for ' || _deal_name,'deal',_deal_id);
  END IF;
  RETURN _deal_id;
END $$;
GRANT EXECUTE ON FUNCTION public.convert_lead_to_deal(UUID,TEXT,NUMERIC,UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Scheduled jobs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cron_sla_monitor()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _row RECORD;
  _count INT := 0;
  _mgr RECORD;
BEGIN
  IF NOT public.automation_rule_enabled('sla_monitor') THEN RETURN 0; END IF;

  -- Leads past stage SLA (default 3 days if no per-status mapping)
  FOR _row IN
    SELECT l.id, l.first_name, l.last_name, l.email, l.assigned_to, l.status,
           l.last_status_change_at
    FROM public.leads l
    WHERE l.deleted_at IS NULL
      AND l.status IN ('new','contacted')
      AND l.overdue_at IS NULL
      AND COALESCE(l.last_status_change_at, l.created_at) <
          now() - INTERVAL '3 days'
  LOOP
    UPDATE public.leads SET overdue_at = now() WHERE id = _row.id;
    PERFORM public.notify_user(_row.assigned_to,'sla','Lead overdue',
            'Lead ' || COALESCE(_row.first_name,'') || ' ' ||
            COALESCE(_row.last_name,'') || ' is past SLA','lead',_row.id);
    FOR _mgr IN SELECT user_id FROM public.user_roles WHERE role IN ('manager','admin') LOOP
      PERFORM public.notify_user(_mgr.user_id,'sla','Escalation: overdue lead',
              'A lead is past SLA.','lead',_row.id);
    END LOOP;
    PERFORM public.log_automation_run('sla_monitor','lead',_row.id,
            COALESCE(_row.email,'lead'),'flagged_overdue');
    _count := _count + 1;
  END LOOP;

  -- Deals past stage SLA
  FOR _row IN
    SELECT d.id, d.name, d.assigned_to, d.stage_id, d.last_stage_change_at,
           ps.sla_days
    FROM public.deals d
    JOIN public.pipeline_stages ps ON ps.id = d.stage_id
    WHERE d.deleted_at IS NULL
      AND NOT ps.is_closed
      AND ps.sla_days > 0
      AND d.overdue_at IS NULL
      AND COALESCE(d.last_stage_change_at, d.created_at) <
          now() - (ps.sla_days || ' days')::interval
  LOOP
    UPDATE public.deals SET overdue_at = now() WHERE id = _row.id;
    PERFORM public.notify_user(_row.assigned_to,'sla','Deal stale',
            _row.name || ' is past stage SLA','deal',_row.id);
    FOR _mgr IN SELECT user_id FROM public.user_roles WHERE role IN ('manager','admin') LOOP
      PERFORM public.notify_user(_mgr.user_id,'sla','Escalation: stale deal',
              _row.name || ' past SLA','deal',_row.id);
    END LOOP;
    PERFORM public.log_automation_run('sla_monitor','deal',_row.id,_row.name,'flagged_overdue');
    _count := _count + 1;
  END LOOP;

  RETURN _count;
END $$;
GRANT EXECUTE ON FUNCTION public.cron_sla_monitor() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cron_reminder_dispatch()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _row RECORD;
  _count INT := 0;
BEGIN
  IF NOT public.automation_rule_enabled('reminder_dispatch') THEN RETURN 0; END IF;

  FOR _row IN
    SELECT id, title, assigned_to, due_at, reminder_at
    FROM public.tasks
    WHERE status IN ('pending','in_progress')
      AND reminder_at IS NOT NULL
      AND reminder_at <= now()
      AND reminder_at > now() - INTERVAL '15 minutes'
  LOOP
    PERFORM public.notify_user(_row.assigned_to,'reminder','Task reminder',
            _row.title,'task',_row.id);
    PERFORM public.log_automation_run('reminder_dispatch','task',_row.id,_row.title,'reminder_sent');
    _count := _count + 1;
  END LOOP;
  RETURN _count;
END $$;
GRANT EXECUTE ON FUNCTION public.cron_reminder_dispatch() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cron_daily_digest()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user RECORD;
  _today INT;
  _overdue INT;
  _new_leads INT;
  _count INT := 0;
  _email TEXT;
BEGIN
  IF NOT public.automation_rule_enabled('daily_digest') THEN RETURN 0; END IF;
  FOR _user IN SELECT id FROM auth.users WHERE deleted_at IS NULL LOOP
    SELECT COUNT(*) INTO _today FROM public.tasks
      WHERE assigned_to = _user.id
        AND status IN ('pending','in_progress')
        AND due_at::date = CURRENT_DATE;
    SELECT COUNT(*) INTO _overdue FROM public.tasks
      WHERE assigned_to = _user.id
        AND status IN ('pending','in_progress')
        AND due_at < now();
    SELECT COUNT(*) INTO _new_leads FROM public.leads
      WHERE assigned_to = _user.id AND deleted_at IS NULL
        AND created_at > now() - INTERVAL '24 hours';

    IF _today + _overdue + _new_leads = 0 THEN CONTINUE; END IF;

    PERFORM public.notify_user(_user.id,'digest','Your daily digest',
      'Today: ' || _today || ' tasks · Overdue: ' || _overdue ||
      ' · New leads: ' || _new_leads);

    SELECT email INTO _email FROM auth.users WHERE id = _user.id;
    IF _email IS NOT NULL THEN
      PERFORM public.queue_email('daily_digest', _email, 'Your Tally CRM digest',
        jsonb_build_object('today',_today,'overdue',_overdue,'new_leads',_new_leads));
    END IF;
    _count := _count + 1;
  END LOOP;
  PERFORM public.log_automation_run('daily_digest','system',NULL,'digest','dispatched',
          'success', _count || ' users');
  RETURN _count;
END $$;
GRANT EXECUTE ON FUNCTION public.cron_daily_digest() TO service_role;

CREATE OR REPLACE FUNCTION public.cron_reengagement_sweep()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _row RECORD;
  _count INT := 0;
BEGIN
  IF NOT public.automation_rule_enabled('reengagement_sweep') THEN RETURN 0; END IF;

  FOR _row IN
    SELECT id, first_name, last_name, email, assigned_to
    FROM public.leads
    WHERE status = 'disqualified'
      AND updated_at < now() - INTERVAL '90 days'
      AND deleted_at IS NULL
  LOOP
    PERFORM public.notify_user(_row.assigned_to,'reengagement','Re-engage disqualified lead',
            COALESCE(_row.email,'lead') || ' is past 90d cooldown','lead',_row.id);
    PERFORM public.log_automation_run('reengagement_sweep','lead',_row.id,
            COALESCE(_row.email,'lead'),'surface_reengagement');
    _count := _count + 1;
  END LOOP;
  RETURN _count;
END $$;
GRANT EXECUTE ON FUNCTION public.cron_reengagement_sweep() TO service_role;

-- ---------------------------------------------------------------------------
-- Seed default automation rules (PRD §14.2)
-- ---------------------------------------------------------------------------

INSERT INTO public.automation_rules
  (id, name, description, trigger_type, trigger_label, trigger_icon, object,
   condition, actions, status, is_default, owner, enabled, config)
VALUES
  ('lead_new_to_contacted','Lead: New → Contacted',
   'Creates a Qualify (BANT) task when a lead moves to Contacted.',
   'stage_change','Lead status changes','call','lead',
   'status = ''contacted''',
   '[{"type":"create_task","title":"Qualify (BANT)","due_in_days":2}]'::jsonb,
   'active', true, 'system', true,
   '{"due_in_days":2,"task_title":"Qualify (BANT)"}'::jsonb),
  ('lead_to_qualified','Lead: → Qualified',
   'Creates a Prepare demo task when a lead becomes qualified.',
   'stage_change','Lead status changes','demo','lead',
   'status = ''qualified''',
   '[{"type":"create_task","title":"Prepare demo / convert","due_in_days":1}]'::jsonb,
   'active', true, 'system', true,
   '{"due_in_days":1,"task_title":"Prepare demo / convert"}'::jsonb),
  ('lead_converted','Lead: converted to deal',
   'Creates a Schedule Tally demo task when a lead is converted.',
   'stage_change','Lead converted','swap_horiz','lead',
   'status = ''converted''',
   '[{"type":"create_task","title":"Schedule Tally demo","due_in_days":2}]'::jsonb,
   'active', true, 'system', true,
   '{"due_in_days":2}'::jsonb),
  ('deal_to_proposal','Deal: → Proposal Submitted',
   'Creates Send proposal task with 3-day reminder.',
   'stage_change','Deal stage changes','description','deal',
   'stage = ''Proposal Submitted''',
   '[{"type":"create_task","title":"Send proposal","due_in_days":1,"reminder_in_days":3}]'::jsonb,
   'active', true, 'system', true,
   '{"due_in_days":1,"reminder_in_days":3}'::jsonb),
  ('deal_to_negotiation','Deal: → Negotiation',
   'Creates Follow up task in 2 days.',
   'stage_change','Deal stage changes','forum','deal',
   'stage = ''Negotiation''',
   '[{"type":"create_task","title":"Follow up on negotiation","due_in_days":2}]'::jsonb,
   'active', true, 'system', true,
   '{"due_in_days":2}'::jsonb),
  ('deal_won','Deal: Closed-Won',
   'Sets probability to 100, creates Welcome + Renewal tasks, notifies managers.',
   'stage_change','Deal won','emoji_events','deal',
   'stage.is_won',
   '[{"type":"set_probability","value":100},{"type":"create_task","title":"Send welcome","due_in_days":1},{"type":"create_task","title":"Renewal check-in","due_in_days":330}]'::jsonb,
   'active', true, 'system', true,
   '{"welcome_due_in_days":1,"renewal_due_in_days":330,"probability":100,"escalate_to":["manager","admin"]}'::jsonb),
  ('deal_lost','Deal: Closed-Lost',
   'Requires reason, sets probability 0, archives, creates re-engagement task in 90 days.',
   'stage_change','Deal lost','sentiment_dissatisfied','deal',
   'stage.is_closed AND NOT stage.is_won',
   '[{"type":"require_reason"},{"type":"set_probability","value":0},{"type":"archive"},{"type":"create_task","title":"Re-engagement check","due_in_days":90}]'::jsonb,
   'active', true, 'system', true,
   '{"reengagement_due_in_days":90,"probability":0}'::jsonb),
  ('sla_monitor','SLA monitor (hourly)',
   'Flags leads and deals past their stage SLA and notifies owner + manager.',
   'scheduled','Hourly','schedule','system','',
   '[{"type":"flag_overdue"},{"type":"escalate_to_manager"}]'::jsonb,
   'active', true, 'system', true,
   '{"lead_sla_days":3,"escalation_role":"manager"}'::jsonb),
  ('reminder_dispatch','Task reminders',
   'Sends in-app reminder notifications when a task reminder is due.',
   'scheduled','Every 5 minutes','notifications','task','',
   '[{"type":"notify_owner"}]'::jsonb,
   'active', true, 'system', true, '{}'::jsonb),
  ('daily_digest','Daily digest',
   'Sends each user a summary of today''s tasks, overdue items and new leads.',
   'scheduled','Daily 07:00 UTC','today','user','',
   '[{"type":"compute_digest"},{"type":"notify_owner"},{"type":"queue_email"}]'::jsonb,
   'active', true, 'system', true, '{"hour_utc":7}'::jsonb),
  ('reengagement_sweep','Re-engagement sweep',
   'Surfaces disqualified leads past the 90-day cooldown for re-engagement.',
   'scheduled','Daily','autorenew','lead','',
   '[{"type":"surface_for_reengagement"}]'::jsonb,
   'active', true, 'system', true, '{"cooldown_days":90}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  description = EXCLUDED.description,
  config = EXCLUDED.config,
  actions = EXCLUDED.actions,
  trigger_label = EXCLUDED.trigger_label,
  trigger_icon = EXCLUDED.trigger_icon,
  is_default = EXCLUDED.is_default;

-- ---------------------------------------------------------------------------
-- pg_cron schedules
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  PERFORM cron.unschedule('automation_sla_monitor');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$
BEGIN
  PERFORM cron.unschedule('automation_reminder_dispatch');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$
BEGIN
  PERFORM cron.unschedule('automation_daily_digest');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$
BEGIN
  PERFORM cron.unschedule('automation_reengagement_sweep');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule('automation_sla_monitor', '0 * * * *',
       $$SELECT public.cron_sla_monitor();$$);
SELECT cron.schedule('automation_reminder_dispatch', '*/5 * * * *',
       $$SELECT public.cron_reminder_dispatch();$$);
SELECT cron.schedule('automation_daily_digest', '0 7 * * *',
       $$SELECT public.cron_daily_digest();$$);
SELECT cron.schedule('automation_reengagement_sweep', '15 6 * * *',
       $$SELECT public.cron_reengagement_sweep();$$);
