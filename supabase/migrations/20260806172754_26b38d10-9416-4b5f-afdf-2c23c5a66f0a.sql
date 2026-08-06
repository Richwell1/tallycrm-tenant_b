CREATE TABLE IF NOT EXISTS public.sync_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('cloud', 'branch')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.sync_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_node_id UUID NOT NULL REFERENCES public.sync_nodes(id) ON DELETE CASCADE,
  remote_node_id UUID NOT NULL REFERENCES public.sync_nodes(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  last_pushed_at TIMESTAMPTZ,
  last_pulled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (local_node_id, remote_node_id, table_name)
);

CREATE TABLE IF NOT EXISTS public.sync_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  row_pk TEXT NOT NULL,
  local_node_id UUID REFERENCES public.sync_nodes(id) ON DELETE SET NULL,
  remote_node_id UUID REFERENCES public.sync_nodes(id) ON DELETE SET NULL,
  conflict_type TEXT NOT NULL,
  local_payload JSONB,
  remote_payload JSONB,
  resolution TEXT NOT NULL,
  resolved_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_node_id UUID REFERENCES public.sync_nodes(id) ON DELETE SET NULL,
  remote_node_id UUID REFERENCES public.sync_nodes(id) ON DELETE SET NULL,
  direction TEXT NOT NULL CHECK (direction IN ('push', 'pull', 'bidirectional')),
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  tables_processed TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  rows_processed INTEGER NOT NULL DEFAULT 0,
  rows_changed INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);

ALTER TABLE public.sync_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_runs ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.sync_nodes TO authenticated;
GRANT SELECT ON public.sync_checkpoints TO authenticated;
GRANT SELECT, INSERT ON public.sync_conflicts TO authenticated;
GRANT SELECT ON public.sync_runs TO authenticated;
GRANT ALL ON public.sync_nodes TO service_role;
GRANT ALL ON public.sync_checkpoints TO service_role;
GRANT ALL ON public.sync_conflicts TO service_role;
GRANT ALL ON public.sync_runs TO service_role;

DROP POLICY IF EXISTS "sync_nodes_admin_manager_read" ON public.sync_nodes;
CREATE POLICY "sync_nodes_admin_manager_read"
  ON public.sync_nodes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "sync_checkpoints_admin_manager_read" ON public.sync_checkpoints;
CREATE POLICY "sync_checkpoints_admin_manager_read"
  ON public.sync_checkpoints FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "sync_conflicts_admin_manager_read" ON public.sync_conflicts;
CREATE POLICY "sync_conflicts_admin_manager_read"
  ON public.sync_conflicts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "sync_conflicts_admin_insert" ON public.sync_conflicts;
CREATE POLICY "sync_conflicts_admin_insert"
  ON public.sync_conflicts FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "sync_runs_admin_manager_read" ON public.sync_runs;
CREATE POLICY "sync_runs_admin_manager_read"
  ON public.sync_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

DROP TRIGGER IF EXISTS set_updated_at_sync_checkpoints ON public.sync_checkpoints;
CREATE TRIGGER set_updated_at_sync_checkpoints
  BEFORE UPDATE ON public.sync_checkpoints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE IF EXISTS public.companies
  ADD COLUMN IF NOT EXISTS origin_node_id UUID REFERENCES public.sync_nodes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_modified_by UUID;

ALTER TABLE IF EXISTS public.contacts
  ADD COLUMN IF NOT EXISTS origin_node_id UUID REFERENCES public.sync_nodes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_modified_by UUID;

ALTER TABLE IF EXISTS public.leads
  ADD COLUMN IF NOT EXISTS origin_node_id UUID REFERENCES public.sync_nodes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_modified_by UUID;

ALTER TABLE IF EXISTS public.deals
  ADD COLUMN IF NOT EXISTS origin_node_id UUID REFERENCES public.sync_nodes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_modified_by UUID;

ALTER TABLE IF EXISTS public.activities
  ADD COLUMN IF NOT EXISTS origin_node_id UUID REFERENCES public.sync_nodes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_modified_by UUID;

ALTER TABLE IF EXISTS public.tasks
  ADD COLUMN IF NOT EXISTS origin_node_id UUID REFERENCES public.sync_nodes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_modified_by UUID;

ALTER TABLE IF EXISTS public.notifications
  ADD COLUMN IF NOT EXISTS origin_node_id UUID REFERENCES public.sync_nodes(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.audit_log
  ADD COLUMN IF NOT EXISTS origin_node_id UUID REFERENCES public.sync_nodes(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.email_queue
  ADD COLUMN IF NOT EXISTS origin_node_id UUID REFERENCES public.sync_nodes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS email_queue_idempotency_key_unique
  ON public.email_queue (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS companies_sync_updated_at_idx ON public.companies (updated_at);
CREATE INDEX IF NOT EXISTS contacts_sync_updated_at_idx ON public.contacts (updated_at);
CREATE INDEX IF NOT EXISTS leads_sync_updated_at_idx ON public.leads (updated_at);
CREATE INDEX IF NOT EXISTS deals_sync_updated_at_idx ON public.deals (updated_at);
CREATE INDEX IF NOT EXISTS activities_sync_updated_at_idx ON public.activities (updated_at);
CREATE INDEX IF NOT EXISTS tasks_sync_updated_at_idx ON public.tasks (updated_at);
CREATE INDEX IF NOT EXISTS notifications_sync_created_at_idx ON public.notifications (created_at);
CREATE INDEX IF NOT EXISTS deal_stage_history_sync_changed_at_idx ON public.deal_stage_history (changed_at);
CREATE INDEX IF NOT EXISTS deal_value_history_sync_changed_at_idx ON public.deal_value_history (changed_at);
CREATE INDEX IF NOT EXISTS lead_status_history_sync_changed_at_idx ON public.lead_status_history (changed_at);
CREATE INDEX IF NOT EXISTS automation_runs_sync_created_at_idx ON public.automation_runs (created_at);
CREATE INDEX IF NOT EXISTS audit_log_sync_created_at_idx ON public.audit_log (created_at);