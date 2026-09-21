-- FlowLedger SQL Editor update bundle
-- Generated from repository migrations on 2026-09-20.
-- Candidate set: 20260327020859 plus 202609 migrations (20 files).
-- Apply only after confirming the project migration list matches the reviewed dry run.
-- Run this whole file once in Supabase Dashboard SQL Editor.
-- BEGIN/COMMIT makes the database changes one transaction.
-- After success, record these exact versions with supabase migration repair.

BEGIN;

-- ===== BEGIN 20260327020859_c83fd50d-fe5a-4fb6-8be2-fd075828af51.sql =====

ALTER PUBLICATION supabase_realtime ADD TABLE public.alert_history;

-- ===== END 20260327020859_c83fd50d-fe5a-4fb6-8be2-fd075828af51.sql =====


-- ===== BEGIN 20260917010000_guard_governance_foundation.sql =====

-- FlowLedger Phase 2: workspace isolation, trustworthy telemetry metadata,
-- and the transactional primitives used by the guard protocol.

CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

ALTER TABLE public.flows
  ADD COLUMN IF NOT EXISTS workspace_id UUID,
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS business_purpose TEXT,
  ADD COLUMN IF NOT EXISTS accountable_owner_member_id UUID,
  ADD COLUMN IF NOT EXISTS budget_owner_member_id UUID,
  ADD COLUMN IF NOT EXISTS team_label TEXT,
  ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'experiment',
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reviewed_by UUID,
  ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS next_review_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS protection_mode TEXT NOT NULL DEFAULT 'Monitor only',
  ADD COLUMN IF NOT EXISTS control_state TEXT NOT NULL DEFAULT 'running',
  ADD COLUMN IF NOT EXISTS daily_budget_limit NUMERIC,
  ADD COLUMN IF NOT EXISTS emergency_stop_reason TEXT,
  ADD COLUMN IF NOT EXISTS emergency_stopped_by UUID,
  ADD COLUMN IF NOT EXISTS emergency_stopped_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS expected_outcome TEXT,
  ADD COLUMN IF NOT EXISTS target_quantity NUMERIC,
  ADD COLUMN IF NOT EXISTS value_per_unit_usd NUMERIC,
  ADD COLUMN IF NOT EXISTS expected_monthly_value_usd NUMERIC,
  ADD COLUMN IF NOT EXISTS value_currency TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS value_source TEXT,
  ADD COLUMN IF NOT EXISTS value_assumptions TEXT,
  ADD COLUMN IF NOT EXISTS experiment_started_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS experiment_ended_at TIMESTAMP WITH TIME ZONE;

-- Give every existing user a private workspace; never merge by email domain.
INSERT INTO public.workspaces (owner_user_id, name)
SELECT id, 'Private workspace'
FROM auth.users
ON CONFLICT (owner_user_id) DO NOTHING;

INSERT INTO public.workspace_members (workspace_id, user_id, role)
SELECT w.id, w.owner_user_id, 'admin'
FROM public.workspaces w
ON CONFLICT (workspace_id, user_id) DO NOTHING;

UPDATE public.flows f
SET workspace_id = w.id,
    created_by = COALESCE(f.created_by, f.user_id)
FROM public.workspaces w
WHERE w.owner_user_id = f.user_id
  AND f.workspace_id IS NULL;

ALTER TABLE public.flows ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.flows ALTER COLUMN created_by SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'flows_workspace_id_fkey') THEN
    ALTER TABLE public.flows ADD CONSTRAINT flows_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'flows_created_by_fkey') THEN
    ALTER TABLE public.flows ADD CONSTRAINT flows_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'flows_accountable_owner_member_fkey') THEN
    ALTER TABLE public.flows ADD CONSTRAINT flows_accountable_owner_member_fkey
      FOREIGN KEY (accountable_owner_member_id) REFERENCES public.workspace_members(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'flows_budget_owner_member_fkey') THEN
    ALTER TABLE public.flows ADD CONSTRAINT flows_budget_owner_member_fkey
      FOREIGN KEY (budget_owner_member_id) REFERENCES public.workspace_members(id);
  END IF;
END $$;

ALTER TABLE public.flows DROP CONSTRAINT IF EXISTS flows_environment_check;
ALTER TABLE public.flows ADD CONSTRAINT flows_environment_check
  CHECK (environment IN ('experiment', 'staging', 'production'));
ALTER TABLE public.flows DROP CONSTRAINT IF EXISTS flows_approval_status_check;
ALTER TABLE public.flows ADD CONSTRAINT flows_approval_status_check
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));
ALTER TABLE public.flows DROP CONSTRAINT IF EXISTS flows_protection_mode_check;
ALTER TABLE public.flows ADD CONSTRAINT flows_protection_mode_check
  CHECK (protection_mode IN ('Guard connected', 'Monitor only'));
ALTER TABLE public.flows DROP CONSTRAINT IF EXISTS flows_control_state_check;
ALTER TABLE public.flows ADD CONSTRAINT flows_control_state_check
  CHECK (control_state IN ('running', 'paused', 'emergency_stopped'));
ALTER TABLE public.flows ADD CONSTRAINT flows_daily_budget_nonnegative
  CHECK (daily_budget_limit IS NULL OR daily_budget_limit >= 0);

ALTER TABLE public.runs
  ADD COLUMN IF NOT EXISTS event_id TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'live',
  ADD COLUMN IF NOT EXISTS reservation_id UUID,
  ADD COLUMN IF NOT EXISTS bound_violation BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.runs DROP CONSTRAINT IF EXISTS runs_source_check;
ALTER TABLE public.runs ADD CONSTRAINT runs_source_check
  CHECK (source IN ('live', 'guarded', 'monitor', 'synthetic_seed', 'synthetic_demo'));
CREATE UNIQUE INDEX IF NOT EXISTS runs_flow_event_unique
  ON public.runs (flow_id, event_id) WHERE event_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS runs_reservation_unique
  ON public.runs (reservation_id) WHERE reservation_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.guard_reservations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flow_id UUID NOT NULL REFERENCES public.flows(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL CHECK (char_length(request_id) BETWEEN 1 AND 160),
  max_cost_usd NUMERIC NOT NULL CHECK (max_cost_usd >= 0),
  actual_cost_usd NUMERIC CHECK (actual_cost_usd IS NULL OR actual_cost_usd >= 0),
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'settled', 'unknown', 'denied')),
  allowed BOOLEAN NOT NULL,
  reason TEXT NOT NULL,
  bound_violation BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  settled_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (flow_id, request_id)
);

CREATE TABLE IF NOT EXISTS public.incidents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  flow_id UUID REFERENCES public.flows(id) ON DELETE SET NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  reason TEXT NOT NULL,
  baseline_rate NUMERIC,
  current_rate NUMERIC,
  threshold NUMERIC,
  observed_cost_usd NUMERIC NOT NULL DEFAULT 0,
  blocked_request_count INTEGER NOT NULL DEFAULT 0 CHECK (blocked_request_count >= 0),
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_note TEXT,
  resolved_by UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  actor_user_id UUID NOT NULL REFERENCES auth.users(id),
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  reason TEXT,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flows_workspace ON public.flows(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_flow_created_source ON public.runs(flow_id, created_at DESC, source);
CREATE INDEX IF NOT EXISTS idx_incidents_workspace_status ON public.incidents(workspace_id, status, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_workspace_created ON public.audit_log(workspace_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_admin(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = auth.uid() AND role = 'admin'
  );
$$;

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guard_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own flows" ON public.flows;
DROP POLICY IF EXISTS "Users can create their own flows" ON public.flows;
DROP POLICY IF EXISTS "Users can update their own flows" ON public.flows;
DROP POLICY IF EXISTS "Users can delete their own flows" ON public.flows;

CREATE POLICY "Workspace members can view flows" ON public.flows
  FOR SELECT USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Members can create their own flows" ON public.flows
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND auth.uid() = created_by AND public.is_workspace_member(workspace_id)
  );
CREATE POLICY "Admins or assigned members can update flows" ON public.flows
  FOR UPDATE USING (
    public.is_workspace_admin(workspace_id)
    OR EXISTS (
      SELECT 1 FROM public.workspace_members m
      WHERE m.id = accountable_owner_member_id AND m.user_id = auth.uid()
    )
  );
CREATE POLICY "Admins or creators can delete flows" ON public.flows
  FOR DELETE USING (public.is_workspace_admin(workspace_id) OR auth.uid() = created_by);

CREATE POLICY "Members can view their workspaces" ON public.workspaces
  FOR SELECT USING (public.is_workspace_member(id));
CREATE POLICY "Admins can update workspaces" ON public.workspaces
  FOR UPDATE USING (public.is_workspace_admin(id));
CREATE POLICY "Members can view workspace membership" ON public.workspace_members
  FOR SELECT USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Users can view runs of their own flows" ON public.runs;
CREATE POLICY "Workspace members can view runs" ON public.runs
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.flows f
    WHERE f.id = runs.flow_id AND public.is_workspace_member(f.workspace_id)
  ));

CREATE POLICY "Workspace members can view incidents" ON public.incidents
  FOR SELECT USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Workspace members can view audit log" ON public.audit_log
  FOR SELECT USING (public.is_workspace_member(workspace_id));
-- Reservation writes and reads are server-only; clients cannot mint or inspect funds.

CREATE OR REPLACE FUNCTION public.record_ingest_run(
  p_flow_id UUID,
  p_event_id TEXT,
  p_status TEXT,
  p_duration_ms INTEGER,
  p_token_count INTEGER,
  p_cost_usd NUMERIC,
  p_error_message TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'live'
)
RETURNS TABLE(recorded BOOLEAN, run_id UUID, duplicate BOOLEAN, control_allow_next BOOLEAN, control_reason TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flow public.flows%ROWTYPE;
  v_existing public.runs%ROWTYPE;
  v_run_id UUID;
  v_monthly_spend NUMERIC;
  v_daily_spend NUMERIC;
  v_allow_next BOOLEAN;
  v_reason TEXT;
BEGIN
  IF p_event_id IS NULL OR char_length(p_event_id) NOT BETWEEN 1 AND 160
     OR p_status NOT IN ('success', 'error')
     OR p_duration_ms IS NULL OR p_duration_ms < 0
     OR p_token_count IS NULL OR p_token_count < 0
     OR p_cost_usd IS NULL OR p_cost_usd < 0
     OR p_source NOT IN ('live', 'guarded', 'monitor', 'synthetic_seed', 'synthetic_demo') THEN
    RAISE EXCEPTION 'invalid telemetry payload' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_flow FROM public.flows WHERE id = p_flow_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'flow not found' USING ERRCODE = 'P0002'; END IF;

  SELECT * INTO v_existing FROM public.runs WHERE flow_id = p_flow_id AND event_id = p_event_id;
  IF FOUND THEN
    RETURN QUERY SELECT true, v_existing.id, true,
      v_flow.flow_enabled AND v_flow.control_state = 'running',
      CASE WHEN NOT v_flow.flow_enabled THEN 'paused' ELSE 'duplicate_event' END;
    RETURN;
  END IF;

  INSERT INTO public.runs (flow_id, event_id, source, status, duration_ms, token_count, cost_usd, error_message)
  VALUES (p_flow_id, p_event_id, p_source, p_status, p_duration_ms, p_token_count, p_cost_usd, NULLIF(p_error_message, ''))
  RETURNING id INTO v_run_id;

  SELECT COALESCE(SUM(cost_usd), 0) INTO v_monthly_spend
  FROM public.runs
  WHERE flow_id = p_flow_id AND created_at >= date_trunc('month', timezone('UTC', now()))
    AND source <> 'synthetic_demo';
  SELECT COALESCE(SUM(cost_usd), 0) INTO v_daily_spend
  FROM public.runs
  WHERE flow_id = p_flow_id AND created_at >= date_trunc('day', timezone('UTC', now()))
    AND source <> 'synthetic_demo';

  v_allow_next := v_flow.flow_enabled AND v_flow.control_state = 'running';
  v_reason := CASE
    WHEN v_flow.control_state = 'emergency_stopped' THEN 'emergency_stopped'
    WHEN NOT v_flow.flow_enabled THEN 'paused'
    WHEN v_flow.budget_limit IS NOT NULL AND v_monthly_spend > v_flow.budget_limit THEN 'budget_exceeded'
    WHEN v_flow.daily_budget_limit IS NOT NULL AND v_daily_spend > v_flow.daily_budget_limit THEN 'daily_budget_exceeded'
    ELSE 'ok'
  END;
  IF v_reason IN ('budget_exceeded', 'daily_budget_exceeded') THEN
    v_allow_next := false;
    UPDATE public.flows SET flow_enabled = false, control_state = 'paused' WHERE id = p_flow_id;
  END IF;

  RETURN QUERY SELECT true, v_run_id, false, v_allow_next, v_reason;
END;
$$;

CREATE OR REPLACE FUNCTION public.authorize_guard_request(
  p_flow_id UUID,
  p_request_id TEXT,
  p_max_cost_usd NUMERIC
)
RETURNS TABLE(allowed BOOLEAN, reason TEXT, reservation_id UUID, remaining_budget_usd NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flow public.flows%ROWTYPE;
  v_existing public.guard_reservations%ROWTYPE;
  v_monthly_spend NUMERIC;
  v_daily_spend NUMERIC;
  v_reserved NUMERIC;
  v_remaining NUMERIC;
  v_reason TEXT := 'approved';
  v_allowed BOOLEAN := true;
  v_reservation_id UUID;
BEGIN
  IF p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 160
     OR p_max_cost_usd IS NULL OR p_max_cost_usd < 0 THEN
    RAISE EXCEPTION 'invalid guard request' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_flow FROM public.flows WHERE id = p_flow_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'flow not found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO v_existing FROM public.guard_reservations WHERE flow_id = p_flow_id AND request_id = p_request_id;
  IF FOUND THEN
    RETURN QUERY SELECT v_existing.allowed, 'duplicate_request', v_existing.id,
      COALESCE(v_flow.budget_limit, v_flow.daily_budget_limit);
    RETURN;
  END IF;

  SELECT COALESCE(SUM(cost_usd), 0) INTO v_monthly_spend FROM public.runs
  WHERE flow_id = p_flow_id AND created_at >= date_trunc('month', timezone('UTC', now())) AND source <> 'synthetic_demo';
  SELECT COALESCE(SUM(cost_usd), 0) INTO v_daily_spend FROM public.runs
  WHERE flow_id = p_flow_id AND created_at >= date_trunc('day', timezone('UTC', now())) AND source <> 'synthetic_demo';
  SELECT COALESCE(SUM(max_cost_usd), 0) INTO v_reserved FROM public.guard_reservations
  WHERE flow_id = p_flow_id AND status IN ('reserved', 'unknown');

  IF v_flow.control_state = 'emergency_stopped' THEN v_allowed := false; v_reason := 'emergency_stopped';
  ELSIF v_flow.archived_at IS NOT NULL THEN v_allowed := false; v_reason := 'archived';
  ELSIF NOT v_flow.flow_enabled OR v_flow.control_state <> 'running' THEN v_allowed := false; v_reason := 'paused';
  ELSIF v_flow.approval_status <> 'approved' AND v_flow.environment = 'production' THEN v_allowed := false; v_reason := 'approval_required';
  ELSIF v_flow.budget_limit IS NOT NULL AND v_monthly_spend + v_reserved + p_max_cost_usd > v_flow.budget_limit THEN v_allowed := false; v_reason := 'budget_exceeded';
  ELSIF v_flow.daily_budget_limit IS NOT NULL AND v_daily_spend + v_reserved + p_max_cost_usd > v_flow.daily_budget_limit THEN v_allowed := false; v_reason := 'daily_budget_exceeded';
  END IF;

  IF v_flow.budget_limit IS NOT NULL THEN v_remaining := v_flow.budget_limit - v_monthly_spend - v_reserved;
  ELSIF v_flow.daily_budget_limit IS NOT NULL THEN v_remaining := v_flow.daily_budget_limit - v_daily_spend - v_reserved;
  ELSE v_remaining := NULL;
  END IF;
  INSERT INTO public.guard_reservations(flow_id, request_id, max_cost_usd, status, allowed, reason)
  VALUES (p_flow_id, p_request_id, p_max_cost_usd, CASE WHEN v_allowed THEN 'reserved' ELSE 'denied' END, v_allowed, v_reason)
  RETURNING id INTO v_reservation_id;
  RETURN QUERY SELECT v_allowed, v_reason, v_reservation_id, GREATEST(v_remaining, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.record_ingest_run(UUID, TEXT, TEXT, INTEGER, INTEGER, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.authorize_guard_request(UUID, TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_ingest_run(UUID, TEXT, TEXT, INTEGER, INTEGER, NUMERIC, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.authorize_guard_request(UUID, TEXT, NUMERIC) TO service_role;


-- ===== END 20260917010000_guard_governance_foundation.sql =====


-- ===== BEGIN 20260917010100_guard_settlement_and_provisioning.sql =====

-- Replace random signup sample data with a private workspace provisioner.
DROP TRIGGER IF EXISTS on_auth_user_created_seed ON auth.users;

CREATE OR REPLACE FUNCTION public.provision_user_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  workspace_id UUID;
BEGIN
  INSERT INTO public.workspaces (owner_user_id, name)
  VALUES (NEW.id, 'Private workspace')
  ON CONFLICT (owner_user_id) DO NOTHING;

  SELECT id INTO workspace_id FROM public.workspaces WHERE owner_user_id = NEW.id;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (workspace_id, NEW.id, 'admin')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_provision_workspace
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.provision_user_workspace();

CREATE TABLE IF NOT EXISTS public.flow_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flow_id UUID NOT NULL REFERENCES public.flows(id) ON DELETE CASCADE,
  secret_hash TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  revoked_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_flow_credentials_active ON public.flow_credentials(flow_id) WHERE revoked_at IS NULL;
ALTER TABLE public.flow_credentials ENABLE ROW LEVEL SECURITY;
-- Plain credentials are returned only once by the server endpoint; hashes are never client-readable.

CREATE OR REPLACE FUNCTION public.populate_flow_workspace_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NULL THEN NEW.created_by := NEW.user_id; END IF;
  IF NEW.workspace_id IS NULL THEN
    SELECT workspace_id INTO NEW.workspace_id
    FROM public.workspace_members
    WHERE user_id = NEW.user_id
    ORDER BY created_at
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_flow_insert_defaults ON public.flows;
CREATE TRIGGER on_flow_insert_defaults
  BEFORE INSERT ON public.flows
  FOR EACH ROW
  EXECUTE FUNCTION public.populate_flow_workspace_defaults();

CREATE OR REPLACE FUNCTION public.settle_guard_request(
  p_reservation_id UUID,
  p_status TEXT,
  p_duration_ms INTEGER,
  p_token_count INTEGER,
  p_actual_cost_usd NUMERIC,
  p_error_message TEXT DEFAULT NULL
)
RETURNS TABLE(settled BOOLEAN, run_id UUID, actual_cost_usd NUMERIC, bound_violation BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation public.guard_reservations%ROWTYPE;
  v_existing_run public.runs%ROWTYPE;
  v_run_id UUID;
  v_bound_violation BOOLEAN;
BEGIN
  IF p_reservation_id IS NULL
     OR p_status NOT IN ('success', 'error')
     OR p_duration_ms IS NULL OR p_duration_ms < 0
     OR p_token_count IS NULL OR p_token_count < 0
     OR p_actual_cost_usd IS NULL OR p_actual_cost_usd < 0 THEN
    RAISE EXCEPTION 'invalid settlement payload' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_reservation
  FROM public.guard_reservations
  WHERE id = p_reservation_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'reservation not found' USING ERRCODE = 'P0002'; END IF;

  SELECT * INTO v_existing_run FROM public.runs WHERE reservation_id = p_reservation_id;
  IF FOUND THEN
    RETURN QUERY SELECT true, v_existing_run.id, v_existing_run.cost_usd, v_existing_run.bound_violation;
    RETURN;
  END IF;
  IF v_reservation.status = 'denied' THEN RAISE EXCEPTION 'reservation was denied' USING ERRCODE = '42501'; END IF;

  v_bound_violation := p_actual_cost_usd > v_reservation.max_cost_usd;
  INSERT INTO public.runs (flow_id, event_id, reservation_id, source, status, duration_ms, token_count, cost_usd, error_message, bound_violation)
  VALUES (v_reservation.flow_id, v_reservation.request_id, p_reservation_id, 'guarded', p_status, p_duration_ms, p_token_count, p_actual_cost_usd, NULLIF(p_error_message, ''), v_bound_violation)
  RETURNING id INTO v_run_id;

  UPDATE public.guard_reservations
  SET status = 'settled', actual_cost_usd = p_actual_cost_usd, bound_violation = v_bound_violation, settled_at = now()
  WHERE id = p_reservation_id;

  IF v_bound_violation THEN
    UPDATE public.flows SET flow_enabled = false, control_state = 'paused' WHERE id = v_reservation.flow_id;
  END IF;
  RETURN QUERY SELECT true, v_run_id, p_actual_cost_usd, v_bound_violation;
END;
$$;

REVOKE ALL ON FUNCTION public.settle_guard_request(UUID, TEXT, INTEGER, INTEGER, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_guard_request(UUID, TEXT, INTEGER, INTEGER, NUMERIC, TEXT) TO service_role;


-- ===== END 20260917010100_guard_settlement_and_provisioning.sql =====


-- ===== BEGIN 20260917010200_authorized_controls.sql =====

-- Authorized control changes are transactional and append-only audited.
CREATE OR REPLACE FUNCTION public.set_flow_control(
  p_flow_id UUID,
  p_action TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS TABLE(flow_enabled BOOLEAN, control_state TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flow public.flows%ROWTYPE;
  v_is_admin BOOLEAN;
  v_is_owner BOOLEAN;
  v_old JSONB;
  v_new JSONB;
BEGIN
  IF p_action NOT IN ('pause', 'resume', 'emergency_stop', 'clear_emergency_stop') THEN
    RAISE EXCEPTION 'invalid control action' USING ERRCODE = '22023';
  END IF;
  IF p_reason IS NOT NULL AND char_length(p_reason) > 1000 THEN
    RAISE EXCEPTION 'control reason is too long' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_flow FROM public.flows WHERE id = p_flow_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'flow not found' USING ERRCODE = 'P0002'; END IF;
  SELECT public.is_workspace_admin(v_flow.workspace_id) INTO v_is_admin;
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members m
    WHERE m.id = v_flow.accountable_owner_member_id AND m.user_id = auth.uid()
  ) OR auth.uid() = v_flow.created_by INTO v_is_owner;
  IF NOT v_is_admin AND NOT v_is_owner THEN RAISE EXCEPTION 'control permission denied' USING ERRCODE = '42501'; END IF;
  IF p_action IN ('emergency_stop', 'clear_emergency_stop') AND NOT v_is_admin THEN
    RAISE EXCEPTION 'admin permission required' USING ERRCODE = '42501';
  END IF;

  v_old := jsonb_build_object('flow_enabled', v_flow.flow_enabled, 'control_state', v_flow.control_state);
  IF p_action = 'pause' THEN
    IF v_flow.control_state <> 'emergency_stopped' THEN
      UPDATE public.flows SET flow_enabled = false, control_state = 'paused' WHERE id = p_flow_id;
    END IF;
  ELSIF p_action = 'emergency_stop' THEN
    UPDATE public.flows SET flow_enabled = false, control_state = 'emergency_stopped', emergency_stop_reason = COALESCE(p_reason, 'Administrative emergency stop'), emergency_stopped_by = auth.uid(), emergency_stopped_at = now() WHERE id = p_flow_id;
  ELSIF p_action = 'clear_emergency_stop' THEN
    IF v_flow.control_state <> 'emergency_stopped' THEN RAISE EXCEPTION 'flow is not emergency stopped' USING ERRCODE = '22023'; END IF;
    UPDATE public.flows SET control_state = 'paused', flow_enabled = false, emergency_stop_reason = NULL, emergency_stopped_by = NULL, emergency_stopped_at = NULL WHERE id = p_flow_id;
  ELSIF p_action = 'resume' THEN
    IF v_flow.control_state = 'emergency_stopped' THEN RAISE EXCEPTION 'clear emergency stop explicitly before resume' USING ERRCODE = '42501'; END IF;
    IF v_flow.archived_at IS NOT NULL THEN RAISE EXCEPTION 'archived flows cannot resume' USING ERRCODE = '42501'; END IF;
    IF v_flow.environment = 'production' AND v_flow.approval_status <> 'approved' THEN RAISE EXCEPTION 'production approval required' USING ERRCODE = '42501'; END IF;
    UPDATE public.flows SET flow_enabled = true, control_state = 'running' WHERE id = p_flow_id;
  END IF;

  SELECT jsonb_build_object('flow_enabled', flow_enabled, 'control_state', control_state) INTO v_new FROM public.flows WHERE id = p_flow_id;
  INSERT INTO public.audit_log(workspace_id, actor_user_id, entity_type, entity_id, action, reason, old_values, new_values)
  VALUES (v_flow.workspace_id, auth.uid(), 'flow', p_flow_id, p_action, p_reason, v_old, v_new);
  RETURN QUERY SELECT (v_new->>'flow_enabled')::BOOLEAN, v_new->>'control_state';
END;
$$;

REVOKE ALL ON FUNCTION public.set_flow_control(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_flow_control(UUID, TEXT, TEXT) TO authenticated;


-- ===== END 20260917010200_authorized_controls.sql =====


-- ===== BEGIN 20260918010000_management_aggregates_and_reviews.sql =====

-- Management Command Center primitives: explicit period-scoped aggregates and
-- admin-only review/promotion writes. Synthetic demo rows are excluded.

CREATE OR REPLACE FUNCTION public.get_workspace_summary(
  p_workspace_id UUID,
  p_period_start TIMESTAMP WITH TIME ZONE,
  p_period_end TIMESTAMP WITH TIME ZONE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_summary JSONB;
BEGIN
  IF NOT public.is_workspace_member(p_workspace_id) THEN
    RAISE EXCEPTION 'workspace access denied' USING ERRCODE = '42501';
  END IF;
  IF p_period_start IS NULL OR p_period_end IS NULL OR p_period_end <= p_period_start THEN
    RAISE EXCEPTION 'invalid reporting period' USING ERRCODE = '22023';
  END IF;

  SELECT jsonb_build_object(
    'workspace_id', p_workspace_id,
    'period_start', p_period_start,
    'period_end', p_period_end,
    'spend_usd', COALESCE((SELECT SUM(r.cost_usd) FROM public.runs r JOIN public.flows f ON f.id = r.flow_id WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND r.created_at >= p_period_start AND r.created_at < p_period_end AND r.source <> 'synthetic_demo'), 0),
    'run_count', COALESCE((SELECT COUNT(*) FROM public.runs r JOIN public.flows f ON f.id = r.flow_id WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND r.created_at >= p_period_start AND r.created_at < p_period_end AND r.source <> 'synthetic_demo'), 0),
    'token_count', COALESCE((SELECT SUM(r.token_count) FROM public.runs r JOIN public.flows f ON f.id = r.flow_id WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND r.created_at >= p_period_start AND r.created_at < p_period_end AND r.source <> 'synthetic_demo'), 0),
    'active_workflow_count', (SELECT COUNT(*) FROM public.flows f WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND f.flow_enabled),
    'open_incident_count', (SELECT COUNT(*) FROM public.incidents i WHERE i.workspace_id = p_workspace_id AND i.status = 'open'),
    'production_count', (SELECT COUNT(*) FROM public.flows f WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND f.environment = 'production'),
    'approved_count', (SELECT COUNT(*) FROM public.flows f WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND f.approval_status = 'approved'),
    'pending_review_count', (SELECT COUNT(*) FROM public.flows f WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND f.approval_status = 'pending'),
    'missing_owner_count', (SELECT COUNT(*) FROM public.flows f WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND f.accountable_owner_member_id IS NULL),
    'missing_purpose_count', (SELECT COUNT(*) FROM public.flows f WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND NULLIF(trim(f.business_purpose), '') IS NULL),
    'overdue_review_count', (SELECT COUNT(*) FROM public.flows f WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND f.next_review_at IS NOT NULL AND f.next_review_at < now()),
    'value_coverage_count', (SELECT COUNT(*) FROM public.flows f WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND f.expected_monthly_value_usd IS NOT NULL)
  ) INTO v_summary;
  RETURN v_summary;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_flow(
  p_flow_id UUID,
  p_approval_status TEXT,
  p_environment TEXT,
  p_next_review_at TIMESTAMP WITH TIME ZONE,
  p_reason TEXT DEFAULT NULL
)
RETURNS TABLE(approval_status TEXT, environment TEXT, last_reviewed_at TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flow public.flows%ROWTYPE;
  v_old JSONB;
  v_new JSONB;
BEGIN
  IF p_approval_status NOT IN ('pending', 'approved', 'rejected') OR p_environment NOT IN ('experiment', 'staging', 'production') THEN
    RAISE EXCEPTION 'invalid review decision' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_flow FROM public.flows WHERE id = p_flow_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'flow not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.is_workspace_admin(v_flow.workspace_id) THEN RAISE EXCEPTION 'admin permission required' USING ERRCODE = '42501'; END IF;
  IF p_environment = 'production' AND p_approval_status = 'approved' AND (v_flow.accountable_owner_member_id IS NULL OR NULLIF(trim(v_flow.business_purpose), '') IS NULL OR p_next_review_at IS NULL) THEN
    RAISE EXCEPTION 'production approval requires owner, purpose, and review date' USING ERRCODE = '22023';
  END IF;
  v_old := jsonb_build_object('approval_status', v_flow.approval_status, 'environment', v_flow.environment, 'next_review_at', v_flow.next_review_at);
  UPDATE public.flows
  SET approval_status = p_approval_status,
      environment = p_environment,
      next_review_at = p_next_review_at,
      reviewed_by = auth.uid(),
      last_reviewed_at = now()
  WHERE id = p_flow_id;
  SELECT jsonb_build_object('approval_status', approval_status, 'environment', environment, 'next_review_at', next_review_at, 'last_reviewed_at', last_reviewed_at) INTO v_new FROM public.flows WHERE id = p_flow_id;
  INSERT INTO public.audit_log(workspace_id, actor_user_id, entity_type, entity_id, action, reason, old_values, new_values)
  VALUES (v_flow.workspace_id, auth.uid(), 'flow', p_flow_id, 'review', p_reason, v_old, v_new);
  RETURN QUERY SELECT (v_new->>'approval_status'), (v_new->>'environment'), (v_new->>'last_reviewed_at')::TIMESTAMP WITH TIME ZONE;
END;
$$;

REVOKE ALL ON FUNCTION public.get_workspace_summary(UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_workspace_summary(UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) TO authenticated;
REVOKE ALL ON FUNCTION public.review_flow(UUID, TEXT, TEXT, TIMESTAMP WITH TIME ZONE, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_flow(UUID, TEXT, TEXT, TIMESTAMP WITH TIME ZONE, TEXT) TO authenticated;


-- ===== END 20260918010000_management_aggregates_and_reviews.sql =====


-- ===== BEGIN 20260918010100_management_inventory_and_incidents.sql =====

-- Server-backed management inventory and audited incident resolution.
-- These functions keep period totals and workflow rows workspace-scoped.

CREATE OR REPLACE FUNCTION public.get_workspace_inventory(
  p_workspace_id UUID,
  p_period_start TIMESTAMP WITH TIME ZONE,
  p_period_end TIMESTAMP WITH TIME ZONE,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  flow_id UUID,
  name TEXT,
  description TEXT,
  business_purpose TEXT,
  expected_outcome TEXT,
  target_quantity NUMERIC,
  value_per_unit_usd NUMERIC,
  value_assumptions TEXT,
  platform TEXT,
  model TEXT,
  team_label TEXT,
  environment TEXT,
  approval_status TEXT,
  protection_mode TEXT,
  control_state TEXT,
  flow_enabled BOOLEAN,
  accountable_owner_member_id UUID,
  expected_monthly_value_usd NUMERIC,
  value_currency TEXT,
  value_source TEXT,
  today_cost_usd NUMERIC,
  period_cost_usd NUMERIC,
  period_run_count BIGINT,
  period_token_count BIGINT,
  last_run_at TIMESTAMP WITH TIME ZONE,
  archived_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.id,
    f.name,
    f.description,
    f.business_purpose,
    f.expected_outcome,
    f.target_quantity,
    f.value_per_unit_usd,
    f.value_assumptions,
    f.platform,
    f.model,
    f.team_label,
    f.environment,
    f.approval_status,
    f.protection_mode,
    f.control_state,
    f.flow_enabled,
    f.accountable_owner_member_id,
    f.expected_monthly_value_usd,
    f.value_currency,
    f.value_source,
    COALESCE(SUM(CASE
      WHEN r.created_at >= date_trunc('day', timezone('UTC', now()))
       AND r.source <> 'synthetic_demo' THEN r.cost_usd
      ELSE 0
    END), 0),
    COALESCE(SUM(CASE
      WHEN r.created_at >= p_period_start
       AND r.created_at < p_period_end
       AND r.source <> 'synthetic_demo' THEN r.cost_usd
      ELSE 0
    END), 0),
    COUNT(r.id) FILTER (
      WHERE r.created_at >= p_period_start
        AND r.created_at < p_period_end
        AND r.source <> 'synthetic_demo'
    ),
    COALESCE(SUM(r.token_count) FILTER (
      WHERE r.created_at >= p_period_start
        AND r.created_at < p_period_end
        AND r.source <> 'synthetic_demo'
    ), 0),
    MAX(r.created_at),
    f.archived_at
  FROM public.flows f
  LEFT JOIN public.runs r ON r.flow_id = f.id
  WHERE f.workspace_id = p_workspace_id
    AND public.is_workspace_member(p_workspace_id)
  GROUP BY f.id
  ORDER BY f.archived_at NULLS FIRST, f.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 200)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

CREATE OR REPLACE FUNCTION public.resolve_incident(
  p_incident_id UUID,
  p_resolution_note TEXT
)
RETURNS TABLE(status TEXT, resolved_at TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_incident public.incidents%ROWTYPE;
BEGIN
  IF p_resolution_note IS NULL OR char_length(trim(p_resolution_note)) < 3 OR char_length(p_resolution_note) > 1000 THEN
    RAISE EXCEPTION 'resolution note must be between 3 and 1000 characters' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_incident
  FROM public.incidents
  WHERE id = p_incident_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'incident not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.is_workspace_admin(v_incident.workspace_id) THEN
    RAISE EXCEPTION 'admin permission required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.incidents
  SET status = 'resolved',
      resolved_at = now(),
      resolution_note = trim(p_resolution_note),
      resolved_by = auth.uid()
  WHERE id = p_incident_id;

  INSERT INTO public.audit_log(workspace_id, actor_user_id, entity_type, entity_id, action, reason, old_values, new_values)
  VALUES (
    v_incident.workspace_id,
    auth.uid(),
    'incident',
    p_incident_id,
    'resolve',
    trim(p_resolution_note),
    jsonb_build_object('status', v_incident.status),
    jsonb_build_object('status', 'resolved')
  );

  RETURN QUERY SELECT 'resolved'::TEXT, now();
END;
$$;

REVOKE ALL ON FUNCTION public.get_workspace_inventory(UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_workspace_inventory(UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, INTEGER, INTEGER) TO authenticated;
REVOKE ALL ON FUNCTION public.resolve_incident(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_incident(UUID, TEXT) TO authenticated;


-- ===== END 20260918010100_management_inventory_and_incidents.sql =====


-- ===== BEGIN 20260918010200_authorized_policy_updates.sql =====

-- Budget and protection policy changes are admin-only and append-only audited.

CREATE OR REPLACE FUNCTION public.set_flow_policy(
  p_flow_id UUID,
  p_budget_limit NUMERIC,
  p_daily_budget_limit NUMERIC,
  p_protection_mode TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS TABLE(budget_limit NUMERIC, daily_budget_limit NUMERIC, protection_mode TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flow public.flows%ROWTYPE;
  v_old JSONB;
  v_new JSONB;
BEGIN
  IF p_budget_limit IS NOT NULL AND p_budget_limit < 0 THEN
    RAISE EXCEPTION 'monthly budget cannot be negative' USING ERRCODE = '22023';
  END IF;
  IF p_daily_budget_limit IS NOT NULL AND p_daily_budget_limit < 0 THEN
    RAISE EXCEPTION 'daily budget cannot be negative' USING ERRCODE = '22023';
  END IF;
  IF p_protection_mode NOT IN ('Guard connected', 'Monitor only') THEN
    RAISE EXCEPTION 'invalid protection mode' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_flow FROM public.flows WHERE id = p_flow_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'flow not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.is_workspace_admin(v_flow.workspace_id) THEN
    RAISE EXCEPTION 'admin permission required' USING ERRCODE = '42501';
  END IF;

  v_old := jsonb_build_object(
    'budget_limit', v_flow.budget_limit,
    'daily_budget_limit', v_flow.daily_budget_limit,
    'protection_mode', v_flow.protection_mode
  );
  UPDATE public.flows
  SET budget_limit = p_budget_limit,
      daily_budget_limit = p_daily_budget_limit,
      protection_mode = p_protection_mode
  WHERE id = p_flow_id;
  SELECT jsonb_build_object(
    'budget_limit', budget_limit,
    'daily_budget_limit', daily_budget_limit,
    'protection_mode', protection_mode
  ) INTO v_new FROM public.flows WHERE id = p_flow_id;

  INSERT INTO public.audit_log(workspace_id, actor_user_id, entity_type, entity_id, action, reason, old_values, new_values)
  VALUES (v_flow.workspace_id, auth.uid(), 'flow', p_flow_id, 'policy_update', p_reason, v_old, v_new);

  RETURN QUERY SELECT
    (v_new->>'budget_limit')::NUMERIC,
    (v_new->>'daily_budget_limit')::NUMERIC,
    v_new->>'protection_mode';
END;
$$;

REVOKE ALL ON FUNCTION public.set_flow_policy(UUID, NUMERIC, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_flow_policy(UUID, NUMERIC, NUMERIC, TEXT, TEXT) TO authenticated;


-- ===== END 20260918010200_authorized_policy_updates.sql =====


-- ===== BEGIN 20260918010300_workspace_summary_details.sql =====

-- Extend the management summary with matched-period supporting metrics.

CREATE OR REPLACE FUNCTION public.get_workspace_summary(
  p_workspace_id UUID,
  p_period_start TIMESTAMP WITH TIME ZONE,
  p_period_end TIMESTAMP WITH TIME ZONE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_summary JSONB;
  v_period_length INTERVAL;
BEGIN
  IF NOT public.is_workspace_member(p_workspace_id) THEN
    RAISE EXCEPTION 'workspace access denied' USING ERRCODE = '42501';
  END IF;
  IF p_period_start IS NULL OR p_period_end IS NULL OR p_period_end <= p_period_start THEN
    RAISE EXCEPTION 'invalid reporting period' USING ERRCODE = '22023';
  END IF;
  v_period_length := p_period_end - p_period_start;

  SELECT jsonb_build_object(
    'workspace_id', p_workspace_id,
    'period_start', p_period_start,
    'period_end', p_period_end,
    'spend_today_usd', COALESCE((SELECT SUM(r.cost_usd) FROM public.runs r JOIN public.flows f ON f.id = r.flow_id WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND r.created_at >= date_trunc('day', timezone('UTC', now())) AND r.source <> 'synthetic_demo'), 0),
    'spend_usd', COALESCE((SELECT SUM(r.cost_usd) FROM public.runs r JOIN public.flows f ON f.id = r.flow_id WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND r.created_at >= p_period_start AND r.created_at < p_period_end AND r.source <> 'synthetic_demo'), 0),
    'prior_period_spend_usd', COALESCE((SELECT SUM(r.cost_usd) FROM public.runs r JOIN public.flows f ON f.id = r.flow_id WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND r.created_at >= p_period_start - v_period_length AND r.created_at < p_period_start AND r.source <> 'synthetic_demo'), 0),
    'run_count', COALESCE((SELECT COUNT(*) FROM public.runs r JOIN public.flows f ON f.id = r.flow_id WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND r.created_at >= p_period_start AND r.created_at < p_period_end AND r.source <> 'synthetic_demo'), 0),
    'token_count', COALESCE((SELECT SUM(r.token_count) FROM public.runs r JOIN public.flows f ON f.id = r.flow_id WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND r.created_at >= p_period_start AND r.created_at < p_period_end AND r.source <> 'synthetic_demo'), 0),
    'active_workflow_count', (SELECT COUNT(*) FROM public.flows f WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND f.flow_enabled),
    'open_incident_count', (SELECT COUNT(*) FROM public.incidents i WHERE i.workspace_id = p_workspace_id AND i.status = 'open'),
    'production_count', (SELECT COUNT(*) FROM public.flows f WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND f.environment = 'production'),
    'approved_count', (SELECT COUNT(*) FROM public.flows f WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND f.approval_status = 'approved'),
    'pending_review_count', (SELECT COUNT(*) FROM public.flows f WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND f.approval_status = 'pending'),
    'missing_owner_count', (SELECT COUNT(*) FROM public.flows f WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND f.accountable_owner_member_id IS NULL),
    'missing_purpose_count', (SELECT COUNT(*) FROM public.flows f WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND NULLIF(trim(f.business_purpose), '') IS NULL),
    'overdue_review_count', (SELECT COUNT(*) FROM public.flows f WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND f.next_review_at IS NOT NULL AND f.next_review_at < now()),
    'value_coverage_count', (SELECT COUNT(*) FROM public.flows f WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND f.expected_monthly_value_usd IS NOT NULL),
    'value_estimate_usd', COALESCE((SELECT SUM(f.expected_monthly_value_usd) FROM public.flows f WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND f.expected_monthly_value_usd IS NOT NULL), 0),
    'covered_cost_usd', COALESCE((SELECT SUM(r.cost_usd) FROM public.runs r JOIN public.flows f ON f.id = r.flow_id WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND f.expected_monthly_value_usd IS NOT NULL AND r.created_at >= p_period_start AND r.created_at < p_period_end AND r.source <> 'synthetic_demo'), 0),
    'over_budget_count', (SELECT COUNT(*) FROM public.flows f WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND f.budget_limit IS NOT NULL AND COALESCE((SELECT SUM(r.cost_usd) FROM public.runs r WHERE r.flow_id = f.id AND r.created_at >= date_trunc('month', timezone('UTC', now())) AND r.source <> 'synthetic_demo'), 0) > f.budget_limit)
  ) INTO v_summary;

  v_summary := v_summary || jsonb_build_object(
    'average_cost_per_run_usd', CASE
      WHEN (v_summary->>'run_count')::NUMERIC = 0 THEN NULL
      ELSE (v_summary->>'spend_usd')::NUMERIC / (v_summary->>'run_count')::NUMERIC
    END
  );
  RETURN v_summary;
END;
$$;

REVOKE ALL ON FUNCTION public.get_workspace_summary(UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_workspace_summary(UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) TO authenticated;


-- ===== END 20260918010300_workspace_summary_details.sql =====


-- ===== BEGIN 20260918010400_restrict_flow_client_updates.sql =====

-- Members may rename or describe assigned flows, but budgets, ownership,
-- lifecycle, approval, and protection changes must go through audited RPCs.

REVOKE UPDATE ON public.flows FROM authenticated;
GRANT UPDATE (name, description, business_purpose, team_label, platform, model) ON public.flows TO authenticated;


-- ===== END 20260918010400_restrict_flow_client_updates.sql =====


-- ===== BEGIN 20260918010500_flow_detail_summary.sql =====

-- Authoritative flow detail totals, avoiding browser-side sums over a limited page.

CREATE OR REPLACE FUNCTION public.get_flow_detail_summary(p_flow_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id UUID;
  v_summary JSONB;
BEGIN
  SELECT workspace_id INTO v_workspace_id FROM public.flows WHERE id = p_flow_id;
  IF v_workspace_id IS NULL THEN RAISE EXCEPTION 'flow not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.is_workspace_member(v_workspace_id) THEN RAISE EXCEPTION 'workspace access denied' USING ERRCODE = '42501'; END IF;

  SELECT jsonb_build_object(
    'total_runs', COUNT(*) FILTER (WHERE r.source <> 'synthetic_demo'),
    'total_cost_usd', COALESCE(SUM(r.cost_usd) FILTER (WHERE r.source <> 'synthetic_demo'), 0),
    'success_rate', CASE
      WHEN COUNT(*) FILTER (WHERE r.source <> 'synthetic_demo') = 0 THEN NULL
      ELSE (COUNT(*) FILTER (WHERE r.source <> 'synthetic_demo' AND r.status = 'success')::NUMERIC / COUNT(*) FILTER (WHERE r.source <> 'synthetic_demo')) * 100
    END,
    'today_runs', COUNT(*) FILTER (WHERE r.source <> 'synthetic_demo' AND r.created_at >= date_trunc('day', timezone('UTC', now()))),
    'today_cost_usd', COALESCE(SUM(r.cost_usd) FILTER (WHERE r.source <> 'synthetic_demo' AND r.created_at >= date_trunc('day', timezone('UTC', now()))), 0),
    'week_runs', COUNT(*) FILTER (WHERE r.source <> 'synthetic_demo' AND r.created_at >= date_trunc('week', timezone('UTC', now()))),
    'week_cost_usd', COALESCE(SUM(r.cost_usd) FILTER (WHERE r.source <> 'synthetic_demo' AND r.created_at >= date_trunc('week', timezone('UTC', now()))), 0),
    'month_runs', COUNT(*) FILTER (WHERE r.source <> 'synthetic_demo' AND r.created_at >= date_trunc('month', timezone('UTC', now()))),
    'month_cost_usd', COALESCE(SUM(r.cost_usd) FILTER (WHERE r.source <> 'synthetic_demo' AND r.created_at >= date_trunc('month', timezone('UTC', now()))), 0)
  ) INTO v_summary
  FROM public.runs r
  WHERE r.flow_id = p_flow_id;
  RETURN v_summary;
END;
$$;

REVOKE ALL ON FUNCTION public.get_flow_detail_summary(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_flow_detail_summary(UUID) TO authenticated;


-- ===== END 20260918010500_flow_detail_summary.sql =====


-- ===== BEGIN 20260918010600_authorized_value_updates.sql =====

-- User-entered value estimates are optional, explicit, and audited.

CREATE OR REPLACE FUNCTION public.set_flow_value(
  p_flow_id UUID,
  p_expected_outcome TEXT,
  p_target_quantity NUMERIC,
  p_value_per_unit_usd NUMERIC,
  p_expected_monthly_value_usd NUMERIC,
  p_value_source TEXT,
  p_value_assumptions TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS TABLE(expected_monthly_value_usd NUMERIC, value_source TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flow public.flows%ROWTYPE;
  v_old JSONB;
  v_new JSONB;
BEGIN
  IF p_target_quantity IS NOT NULL AND p_target_quantity < 0 THEN
    RAISE EXCEPTION 'target quantity cannot be negative' USING ERRCODE = '22023';
  END IF;
  IF p_value_per_unit_usd IS NOT NULL AND p_value_per_unit_usd < 0 THEN
    RAISE EXCEPTION 'value per unit cannot be negative' USING ERRCODE = '22023';
  END IF;
  IF p_expected_monthly_value_usd IS NOT NULL AND p_expected_monthly_value_usd < 0 THEN
    RAISE EXCEPTION 'expected monthly value cannot be negative' USING ERRCODE = '22023';
  END IF;
  IF p_value_source IS NOT NULL AND p_value_source NOT IN ('user estimate', 'manual reported outcome', 'instrumented outcome') THEN
    RAISE EXCEPTION 'invalid value source' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_flow FROM public.flows WHERE id = p_flow_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'flow not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.is_workspace_admin(v_flow.workspace_id) THEN
    RAISE EXCEPTION 'admin permission required' USING ERRCODE = '42501';
  END IF;

  v_old := jsonb_build_object('expected_outcome', v_flow.expected_outcome, 'target_quantity', v_flow.target_quantity, 'value_per_unit_usd', v_flow.value_per_unit_usd, 'expected_monthly_value_usd', v_flow.expected_monthly_value_usd, 'value_source', v_flow.value_source, 'value_assumptions', v_flow.value_assumptions);
  UPDATE public.flows
  SET expected_outcome = NULLIF(trim(p_expected_outcome), ''),
      target_quantity = p_target_quantity,
      value_per_unit_usd = p_value_per_unit_usd,
      expected_monthly_value_usd = p_expected_monthly_value_usd,
      value_source = NULLIF(trim(p_value_source), ''),
      value_assumptions = NULLIF(trim(p_value_assumptions), '')
  WHERE id = p_flow_id;
  SELECT jsonb_build_object('expected_monthly_value_usd', expected_monthly_value_usd, 'value_source', value_source) INTO v_new FROM public.flows WHERE id = p_flow_id;

  INSERT INTO public.audit_log(workspace_id, actor_user_id, entity_type, entity_id, action, reason, old_values, new_values)
  VALUES (v_flow.workspace_id, auth.uid(), 'flow', p_flow_id, 'value_update', p_reason, v_old, v_new);

  RETURN QUERY SELECT (v_new->>'expected_monthly_value_usd')::NUMERIC, v_new->>'value_source';
END;
$$;

REVOKE ALL ON FUNCTION public.set_flow_value(UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_flow_value(UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT) TO authenticated;


-- ===== END 20260918010600_authorized_value_updates.sql =====


-- ===== BEGIN 20260918010700_workspace_safe_governance_updates.sql =====

-- Keep owner references inside the flow's workspace and expose an audited
-- admin path for governance ownership/purpose changes.

CREATE OR REPLACE FUNCTION public.validate_flow_workspace_members()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.accountable_owner_member_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE id = NEW.accountable_owner_member_id AND workspace_id = NEW.workspace_id
  ) THEN
    RAISE EXCEPTION 'accountable owner must belong to the flow workspace' USING ERRCODE = '22023';
  END IF;
  IF NEW.budget_owner_member_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE id = NEW.budget_owner_member_id AND workspace_id = NEW.workspace_id
  ) THEN
    RAISE EXCEPTION 'budget owner must belong to the flow workspace' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_flow_workspace_members_trigger ON public.flows;
CREATE TRIGGER validate_flow_workspace_members_trigger
  BEFORE INSERT OR UPDATE OF workspace_id, accountable_owner_member_id, budget_owner_member_id ON public.flows
  FOR EACH ROW EXECUTE FUNCTION public.validate_flow_workspace_members();

CREATE OR REPLACE FUNCTION public.set_flow_governance(
  p_flow_id UUID,
  p_accountable_owner_member_id UUID,
  p_budget_owner_member_id UUID,
  p_team_label TEXT,
  p_business_purpose TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS TABLE(accountable_owner_member_id UUID, budget_owner_member_id UUID, team_label TEXT, business_purpose TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flow public.flows%ROWTYPE;
  v_old JSONB;
  v_new JSONB;
BEGIN
  SELECT * INTO v_flow FROM public.flows WHERE id = p_flow_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'flow not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.is_workspace_admin(v_flow.workspace_id) THEN RAISE EXCEPTION 'admin permission required' USING ERRCODE = '42501'; END IF;
  IF p_accountable_owner_member_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.workspace_members WHERE id = p_accountable_owner_member_id AND workspace_id = v_flow.workspace_id) THEN RAISE EXCEPTION 'accountable owner must belong to the flow workspace' USING ERRCODE = '22023'; END IF;
  IF p_budget_owner_member_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.workspace_members WHERE id = p_budget_owner_member_id AND workspace_id = v_flow.workspace_id) THEN RAISE EXCEPTION 'budget owner must belong to the flow workspace' USING ERRCODE = '22023'; END IF;

  v_old := jsonb_build_object('accountable_owner_member_id', v_flow.accountable_owner_member_id, 'budget_owner_member_id', v_flow.budget_owner_member_id, 'team_label', v_flow.team_label, 'business_purpose', v_flow.business_purpose);
  UPDATE public.flows
  SET accountable_owner_member_id = p_accountable_owner_member_id,
      budget_owner_member_id = p_budget_owner_member_id,
      team_label = NULLIF(trim(p_team_label), ''),
      business_purpose = NULLIF(trim(p_business_purpose), '')
  WHERE id = p_flow_id;
  SELECT jsonb_build_object('accountable_owner_member_id', accountable_owner_member_id, 'budget_owner_member_id', budget_owner_member_id, 'team_label', team_label, 'business_purpose', business_purpose) INTO v_new FROM public.flows WHERE id = p_flow_id;
  INSERT INTO public.audit_log(workspace_id, actor_user_id, entity_type, entity_id, action, reason, old_values, new_values)
  VALUES (v_flow.workspace_id, auth.uid(), 'flow', p_flow_id, 'governance_update', p_reason, v_old, v_new);
  RETURN QUERY SELECT (v_new->>'accountable_owner_member_id')::UUID, (v_new->>'budget_owner_member_id')::UUID, v_new->>'team_label', v_new->>'business_purpose';
END;
$$;

REVOKE ALL ON FUNCTION public.set_flow_governance(UUID, UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_flow_governance(UUID, UUID, UUID, TEXT, TEXT, TEXT) TO authenticated;


-- ===== END 20260918010700_workspace_safe_governance_updates.sql =====


-- ===== BEGIN 20260918010800_authorized_archival.sql =====

-- Preserve the accounting trail: lifecycle removal is an audited archive, not a
-- hard delete. Archived flows keep their runs, costs, incidents, and evidence.

CREATE OR REPLACE FUNCTION public.archive_flow(
  p_flow_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS TABLE(archived_at TIMESTAMPTZ, flow_enabled BOOLEAN, control_state TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flow public.flows%ROWTYPE;
  v_archived_at TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_flow
  FROM public.flows
  WHERE id = p_flow_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'flow not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.is_workspace_admin(v_flow.workspace_id) THEN
    RAISE EXCEPTION 'admin permission required' USING ERRCODE = '42501';
  END IF;

  IF v_flow.archived_at IS NULL THEN
    v_archived_at := now();
    UPDATE public.flows
    SET archived_at = v_archived_at,
        flow_enabled = false,
        control_state = CASE
          WHEN control_state = 'emergency_stopped' THEN control_state
          ELSE 'paused'
        END
    WHERE id = p_flow_id;

    INSERT INTO public.audit_log(
      workspace_id, actor_user_id, entity_type, entity_id, action, reason,
      old_values, new_values
    )
    VALUES (
      v_flow.workspace_id, auth.uid(), 'flow', p_flow_id, 'archive', p_reason,
      jsonb_build_object(
        'archived_at', v_flow.archived_at,
        'flow_enabled', v_flow.flow_enabled,
        'control_state', v_flow.control_state
      ),
      jsonb_build_object(
        'archived_at', v_archived_at,
        'flow_enabled', false,
        'control_state', CASE
          WHEN v_flow.control_state = 'emergency_stopped' THEN v_flow.control_state
          ELSE 'paused'
        END
      )
    );
  ELSE
    v_archived_at := v_flow.archived_at;
  END IF;

  RETURN QUERY
  SELECT f.archived_at, f.flow_enabled, f.control_state
  FROM public.flows AS f
  WHERE f.id = p_flow_id;
END;
$$;

REVOKE DELETE ON public.flows FROM authenticated, anon;
REVOKE ALL ON FUNCTION public.archive_flow(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_flow(UUID, TEXT) TO authenticated;


-- ===== END 20260918010800_authorized_archival.sql =====


-- ===== BEGIN 20260918010900_inventory_telemetry_fix.sql =====

-- Keep synthetic preview telemetry out of the live inventory's last-seen signal.

CREATE OR REPLACE FUNCTION public.get_workspace_inventory(
  p_workspace_id UUID,
  p_period_start TIMESTAMP WITH TIME ZONE,
  p_period_end TIMESTAMP WITH TIME ZONE,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  flow_id UUID,
  name TEXT,
  description TEXT,
  business_purpose TEXT,
  expected_outcome TEXT,
  target_quantity NUMERIC,
  value_per_unit_usd NUMERIC,
  value_assumptions TEXT,
  platform TEXT,
  model TEXT,
  team_label TEXT,
  environment TEXT,
  approval_status TEXT,
  protection_mode TEXT,
  control_state TEXT,
  flow_enabled BOOLEAN,
  accountable_owner_member_id UUID,
  expected_monthly_value_usd NUMERIC,
  value_currency TEXT,
  value_source TEXT,
  today_cost_usd NUMERIC,
  period_cost_usd NUMERIC,
  period_run_count BIGINT,
  period_token_count BIGINT,
  last_run_at TIMESTAMP WITH TIME ZONE,
  archived_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.id,
    f.name,
    f.description,
    f.business_purpose,
    f.expected_outcome,
    f.target_quantity,
    f.value_per_unit_usd,
    f.value_assumptions,
    f.platform,
    f.model,
    f.team_label,
    f.environment,
    f.approval_status,
    f.protection_mode,
    f.control_state,
    f.flow_enabled,
    f.accountable_owner_member_id,
    f.expected_monthly_value_usd,
    f.value_currency,
    f.value_source,
    COALESCE(SUM(CASE
      WHEN r.created_at >= date_trunc('day', timezone('UTC', now()))
       AND r.source <> 'synthetic_demo' THEN r.cost_usd
      ELSE 0
    END), 0),
    COALESCE(SUM(CASE
      WHEN r.created_at >= p_period_start
       AND r.created_at < p_period_end
       AND r.source <> 'synthetic_demo' THEN r.cost_usd
      ELSE 0
    END), 0),
    COUNT(r.id) FILTER (
      WHERE r.created_at >= p_period_start
        AND r.created_at < p_period_end
        AND r.source <> 'synthetic_demo'
    ),
    COALESCE(SUM(r.token_count) FILTER (
      WHERE r.created_at >= p_period_start
        AND r.created_at < p_period_end
        AND r.source <> 'synthetic_demo'
    ), 0),
    MAX(r.created_at) FILTER (WHERE r.source <> 'synthetic_demo'),
    f.archived_at
  FROM public.flows f
  LEFT JOIN public.runs r ON r.flow_id = f.id
  WHERE f.workspace_id = p_workspace_id
    AND public.is_workspace_member(p_workspace_id)
  GROUP BY f.id
  ORDER BY f.archived_at NULLS FIRST, f.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 200)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

REVOKE ALL ON FUNCTION public.get_workspace_inventory(UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_workspace_inventory(UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, INTEGER, INTEGER) TO authenticated;


-- ===== END 20260918010900_inventory_telemetry_fix.sql =====


-- ===== BEGIN 20260918011000_summary_period_semantics.sql =====

-- Keep the selected reporting period separate from the always-visible month-to-date
-- spend card and expose the supporting management metrics from one server query.

CREATE OR REPLACE FUNCTION public.get_workspace_summary(
  p_workspace_id UUID,
  p_period_start TIMESTAMP WITH TIME ZONE,
  p_period_end TIMESTAMP WITH TIME ZONE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_summary JSONB;
  v_period_length INTERVAL;
  v_today_start TIMESTAMP WITH TIME ZONE := date_trunc('day', timezone('UTC', now())) AT TIME ZONE 'UTC';
  v_month_start TIMESTAMP WITH TIME ZONE := date_trunc('month', timezone('UTC', now())) AT TIME ZONE 'UTC';
BEGIN
  IF NOT public.is_workspace_member(p_workspace_id) THEN
    RAISE EXCEPTION 'workspace access denied' USING ERRCODE = '42501';
  END IF;
  IF p_period_start IS NULL OR p_period_end IS NULL OR p_period_end <= p_period_start THEN
    RAISE EXCEPTION 'invalid reporting period' USING ERRCODE = '22023';
  END IF;
  v_period_length := p_period_end - p_period_start;

  SELECT jsonb_build_object(
    'workspace_id', p_workspace_id,
    'period_start', p_period_start,
    'period_end', p_period_end,
    'spend_today_usd', COALESCE((SELECT SUM(r.cost_usd) FROM public.runs r JOIN public.flows f ON f.id = r.flow_id WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND r.created_at >= v_today_start AND r.source <> 'synthetic_demo'), 0),
    'today_run_count', COALESCE((SELECT COUNT(*) FROM public.runs r JOIN public.flows f ON f.id = r.flow_id WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND r.created_at >= v_today_start AND r.source <> 'synthetic_demo'), 0),
    'spend_usd', COALESCE((SELECT SUM(r.cost_usd) FROM public.runs r JOIN public.flows f ON f.id = r.flow_id WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND r.created_at >= p_period_start AND r.created_at < p_period_end AND r.source <> 'synthetic_demo'), 0),
    'prior_period_spend_usd', COALESCE((SELECT SUM(r.cost_usd) FROM public.runs r JOIN public.flows f ON f.id = r.flow_id WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND r.created_at >= p_period_start - v_period_length AND r.created_at < p_period_start AND r.source <> 'synthetic_demo'), 0),
    'month_to_date_spend_usd', COALESCE((SELECT SUM(r.cost_usd) FROM public.runs r JOIN public.flows f ON f.id = r.flow_id WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND r.created_at >= v_month_start AND r.source <> 'synthetic_demo'), 0),
    'run_count', COALESCE((SELECT COUNT(*) FROM public.runs r JOIN public.flows f ON f.id = r.flow_id WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND r.created_at >= p_period_start AND r.created_at < p_period_end AND r.source <> 'synthetic_demo'), 0),
    'token_count', COALESCE((SELECT SUM(r.token_count) FROM public.runs r JOIN public.flows f ON f.id = r.flow_id WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND r.created_at >= p_period_start AND r.created_at < p_period_end AND r.source <> 'synthetic_demo'), 0),
    'month_to_date_run_count', COALESCE((SELECT COUNT(*) FROM public.runs r JOIN public.flows f ON f.id = r.flow_id WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND r.created_at >= v_month_start AND r.source <> 'synthetic_demo'), 0),
    'month_to_date_token_count', COALESCE((SELECT SUM(r.token_count) FROM public.runs r JOIN public.flows f ON f.id = r.flow_id WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND r.created_at >= v_month_start AND r.source <> 'synthetic_demo'), 0),
    'active_workflow_count', (SELECT COUNT(*) FROM public.flows f WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND f.flow_enabled),
    'open_incident_count', (SELECT COUNT(*) FROM public.incidents i WHERE i.workspace_id = p_workspace_id AND i.status = 'open'),
    'production_count', (SELECT COUNT(*) FROM public.flows f WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND f.environment = 'production'),
    'approved_count', (SELECT COUNT(*) FROM public.flows f WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND f.approval_status = 'approved'),
    'pending_review_count', (SELECT COUNT(*) FROM public.flows f WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND f.approval_status = 'pending'),
    'missing_owner_count', (SELECT COUNT(*) FROM public.flows f WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND f.accountable_owner_member_id IS NULL),
    'missing_purpose_count', (SELECT COUNT(*) FROM public.flows f WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND NULLIF(trim(f.business_purpose), '') IS NULL),
    'overdue_review_count', (SELECT COUNT(*) FROM public.flows f WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND f.next_review_at IS NOT NULL AND f.next_review_at < now()),
    'value_coverage_count', (SELECT COUNT(*) FROM public.flows f WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND f.expected_monthly_value_usd IS NOT NULL),
    'value_estimate_usd', COALESCE((SELECT SUM(f.expected_monthly_value_usd) FROM public.flows f WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND f.expected_monthly_value_usd IS NOT NULL), 0),
    'covered_cost_usd', COALESCE((SELECT SUM(r.cost_usd) FROM public.runs r JOIN public.flows f ON f.id = r.flow_id WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND f.expected_monthly_value_usd IS NOT NULL AND r.created_at >= p_period_start AND r.created_at < p_period_end AND r.source <> 'synthetic_demo'), 0),
    'over_budget_count', (SELECT COUNT(*) FROM public.flows f WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND f.budget_limit IS NOT NULL AND COALESCE((SELECT SUM(r.cost_usd) FROM public.runs r WHERE r.flow_id = f.id AND r.created_at >= v_month_start AND r.source <> 'synthetic_demo'), 0) > f.budget_limit),
    'experiment_count', (SELECT COUNT(*) FROM public.flows f WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND f.environment = 'experiment'),
    'experiment_spend_usd', COALESCE((SELECT SUM(r.cost_usd) FROM public.runs r JOIN public.flows f ON f.id = r.flow_id WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND f.environment = 'experiment' AND r.created_at >= p_period_start AND r.created_at < p_period_end AND r.source <> 'synthetic_demo'), 0),
    'missing_value_target_count', (SELECT COUNT(*) FROM public.flows f WHERE f.workspace_id = p_workspace_id AND f.archived_at IS NULL AND f.environment = 'experiment' AND f.expected_monthly_value_usd IS NULL)
  ) INTO v_summary;

  v_summary := v_summary || jsonb_build_object(
    'average_cost_per_run_usd', CASE
      WHEN (v_summary->>'run_count')::NUMERIC = 0 THEN NULL
      ELSE (v_summary->>'spend_usd')::NUMERIC / (v_summary->>'run_count')::NUMERIC
    END
  );
  RETURN v_summary;
END;
$$;

REVOKE ALL ON FUNCTION public.get_workspace_summary(UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_workspace_summary(UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) TO authenticated;


-- ===== END 20260918011000_summary_period_semantics.sql =====


-- ===== BEGIN 20260918011100_workspace_members_read_rpc.sql =====

-- Expose only workspace membership identifiers/roles for safe ownership forms.
-- Email/profile data remains outside this prototype's schema.

CREATE OR REPLACE FUNCTION public.get_workspace_members(p_workspace_id UUID)
RETURNS TABLE(member_id UUID, user_id UUID, role TEXT)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.user_id, m.role
  FROM public.workspace_members AS m
  WHERE m.workspace_id = p_workspace_id
    AND public.is_workspace_member(p_workspace_id)
  ORDER BY m.role DESC, m.created_at ASC;
$$;

REVOKE ALL ON FUNCTION public.get_workspace_members(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_workspace_members(UUID) TO authenticated;


-- ===== END 20260918011100_workspace_members_read_rpc.sql =====


-- ===== BEGIN 20260918011200_workspace_alert_rules.sql =====

-- Move the legacy alert tables into the existing workspace boundary. Delivery
-- remains in-app only; email and outbound webhook integrations are not enabled.

ALTER TABLE public.alert_rules
  ADD COLUMN IF NOT EXISTS workspace_id UUID;
ALTER TABLE public.alert_history
  ADD COLUMN IF NOT EXISTS workspace_id UUID;

UPDATE public.alert_rules ar
SET workspace_id = COALESCE(
  (SELECT f.workspace_id FROM public.flows f WHERE f.id = ar.flow_id),
  (SELECT w.id FROM public.workspaces w WHERE w.owner_user_id = ar.user_id)
)
WHERE ar.workspace_id IS NULL;

UPDATE public.alert_history ah
SET workspace_id = COALESCE(
  (SELECT ar.workspace_id FROM public.alert_rules ar WHERE ar.id = ah.rule_id),
  (SELECT f.workspace_id FROM public.flows f WHERE f.id = ah.flow_id),
  (SELECT w.id FROM public.workspaces w WHERE w.owner_user_id = ah.user_id)
)
WHERE ah.workspace_id IS NULL;

ALTER TABLE public.alert_rules ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.alert_history ALTER COLUMN workspace_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alert_rules_workspace_id_fkey') THEN
    ALTER TABLE public.alert_rules ADD CONSTRAINT alert_rules_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alert_history_workspace_id_fkey') THEN
    ALTER TABLE public.alert_history ADD CONSTRAINT alert_history_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can view own alert rules" ON public.alert_rules;
DROP POLICY IF EXISTS "Users can create own alert rules" ON public.alert_rules;
DROP POLICY IF EXISTS "Users can update own alert rules" ON public.alert_rules;
DROP POLICY IF EXISTS "Users can delete own alert rules" ON public.alert_rules;
CREATE POLICY "Workspace members can view alert rules" ON public.alert_rules
  FOR SELECT USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Workspace admins can create alert rules" ON public.alert_rules
  FOR INSERT WITH CHECK (public.is_workspace_admin(workspace_id) AND auth.uid() = user_id);
CREATE POLICY "Workspace admins can update alert rules" ON public.alert_rules
  FOR UPDATE USING (public.is_workspace_admin(workspace_id));
CREATE POLICY "Workspace admins can delete alert rules" ON public.alert_rules
  FOR DELETE USING (public.is_workspace_admin(workspace_id));

DROP POLICY IF EXISTS "Users can view own alert history" ON public.alert_history;
DROP POLICY IF EXISTS "Service can insert alert history" ON public.alert_history;
DROP POLICY IF EXISTS "Authenticated can insert alert history" ON public.alert_history;
CREATE POLICY "Workspace members can view alert history" ON public.alert_history
  FOR SELECT USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Service can insert workspace alert history" ON public.alert_history
  FOR INSERT TO service_role WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_alert_rules_workspace ON public.alert_rules(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_history_workspace ON public.alert_history(workspace_id, created_at DESC);


-- ===== END 20260918011200_workspace_alert_rules.sql =====


-- ===== BEGIN 20260918011300_event_driven_signals.sql =====

-- Event-driven, explainable signals for live telemetry. This is intentionally
-- deterministic and runs on recorded events; it is not a polling monitor or an
-- LLM diagnosis engine.

CREATE OR REPLACE FUNCTION public.evaluate_run_alert_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flow RECORD;
  v_rule RECORD;
  v_monthly_spend NUMERIC;
  v_error_count BIGINT;
  v_sample_count BIGINT;
  v_triggered BOOLEAN;
BEGIN
  IF NEW.source = 'synthetic_demo' THEN
    RETURN NEW;
  END IF;

  SELECT id, name, workspace_id, budget_limit
  INTO v_flow
  FROM public.flows
  WHERE id = NEW.flow_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT COALESCE(SUM(r.cost_usd), 0)
  INTO v_monthly_spend
  FROM public.runs r
  WHERE r.flow_id = NEW.flow_id
    AND r.created_at >= date_trunc('month', timezone('UTC', now())) AT TIME ZONE 'UTC'
    AND r.source <> 'synthetic_demo';

  FOR v_rule IN
    SELECT *
    FROM public.alert_rules
    WHERE workspace_id = v_flow.workspace_id
      AND enabled
      AND (scope = 'all' OR flow_id = NEW.flow_id)
  LOOP
    v_triggered := CASE v_rule.condition_type
      WHEN 'spend_limit' THEN v_monthly_spend >= v_rule.threshold
      WHEN 'budget_exceeded' THEN v_flow.budget_limit IS NOT NULL AND v_monthly_spend >= v_flow.budget_limit
      WHEN 'token_spike' THEN NEW.token_count >= v_rule.threshold
      WHEN 'error_rate' THEN (
        SELECT COUNT(*) FILTER (WHERE r.status = 'error')::NUMERIC / NULLIF(COUNT(*), 0) * 100 >= v_rule.threshold
        FROM (
          SELECT status FROM public.runs
          WHERE flow_id = NEW.flow_id AND source <> 'synthetic_demo'
          ORDER BY created_at DESC LIMIT 10
        ) r
        HAVING COUNT(*) >= 5
      )
      ELSE false
    END;

    IF v_triggered AND NOT EXISTS (
      SELECT 1
      FROM public.alert_history h
      WHERE h.workspace_id = v_flow.workspace_id
        AND h.rule_id = v_rule.id
        AND h.flow_id = NEW.flow_id
        AND h.status = 'triggered'
        AND h.created_at >= now() - interval '15 minutes'
    ) THEN
      INSERT INTO public.alert_history(
        user_id, workspace_id, rule_id, rule_name, condition_type, flow_id, flow_name, status
      )
      VALUES (
        v_rule.user_id, v_flow.workspace_id, v_rule.id, v_rule.name,
        v_rule.condition_type, NEW.flow_id, v_flow.name, 'triggered'
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.detect_spend_incident()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flow RECORD;
  v_baseline_spend NUMERIC;
  v_current_spend NUMERIC;
  v_baseline_count BIGINT;
  v_current_rate NUMERIC;
  v_baseline_rate NUMERIC;
  v_existing_id UUID;
  v_ratio NUMERIC;
  v_floor CONSTANT NUMERIC := 0.05;
BEGIN
  IF NEW.source = 'synthetic_demo' THEN RETURN NEW; END IF;

  SELECT id, name, workspace_id, protection_mode
  INTO v_flow
  FROM public.flows
  WHERE id = NEW.flow_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT COALESCE(SUM(cost_usd), 0), COUNT(*)
  INTO v_baseline_spend, v_baseline_count
  FROM public.runs
  WHERE flow_id = NEW.flow_id
    AND source <> 'synthetic_demo'
    AND created_at >= now() - interval '35 minutes'
    AND created_at < now() - interval '5 minutes';

  SELECT COALESCE(SUM(cost_usd), 0)
  INTO v_current_spend
  FROM public.runs
  WHERE flow_id = NEW.flow_id
    AND source <> 'synthetic_demo'
    AND created_at >= now() - interval '5 minutes';

  IF v_baseline_count < 5 OR v_current_spend < v_floor THEN RETURN NEW; END IF;

  v_baseline_rate := v_baseline_spend / 30;
  v_current_rate := v_current_spend / 5;
  v_ratio := CASE WHEN v_baseline_rate = 0 THEN NULL ELSE v_current_rate / v_baseline_rate END;

  IF NOT ((v_baseline_rate = 0 AND v_current_spend >= v_floor) OR (v_baseline_rate > 0 AND v_current_rate >= v_baseline_rate * 3)) THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_existing_id
  FROM public.incidents
  WHERE flow_id = NEW.flow_id AND status = 'open'
  ORDER BY detected_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_existing_id IS NULL THEN
    INSERT INTO public.incidents(
      workspace_id, flow_id, severity, status, reason, baseline_rate, current_rate,
      threshold, observed_cost_usd, evidence
    )
    VALUES (
      v_flow.workspace_id, NEW.flow_id,
      CASE WHEN COALESCE(v_ratio, 99) >= 6 THEN 'critical' ELSE 'warning' END,
      'open', 'Five-minute spend rate exceeded the prior thirty-minute baseline',
      v_baseline_rate, v_current_rate, 3, v_current_spend,
      jsonb_build_object(
        'rule', 'current five-minute spend per minute >= 3x prior thirty-minute spend per minute',
        'absolute_floor_usd', v_floor,
        'baseline_sample_count', v_baseline_count,
        'baseline_window_minutes', 30,
        'current_window_minutes', 5,
        'ratio', v_ratio,
        'protection_mode', v_flow.protection_mode
      )
    );
  ELSE
    UPDATE public.incidents
    SET observed_cost_usd = v_current_spend,
        baseline_rate = v_baseline_rate,
        current_rate = v_current_rate,
        evidence = evidence || jsonb_build_object('last_observed_at', now(), 'last_ratio', v_ratio)
    WHERE id = v_existing_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_guard_block_signal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flow_id UUID;
BEGIN
  IF NEW.allowed THEN RETURN NEW; END IF;
  v_flow_id := NEW.flow_id;
  UPDATE public.incidents
  SET blocked_request_count = blocked_request_count + 1,
      evidence = evidence || jsonb_build_object(
        'last_blocked_at', now(),
        'last_block_reason', NEW.reason
      )
  WHERE flow_id = v_flow_id AND status = 'open';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS evaluate_run_alert_rules_trigger ON public.runs;
CREATE TRIGGER evaluate_run_alert_rules_trigger
  AFTER INSERT ON public.runs
  FOR EACH ROW EXECUTE FUNCTION public.evaluate_run_alert_rules();

DROP TRIGGER IF EXISTS detect_spend_incident_trigger ON public.runs;
CREATE TRIGGER detect_spend_incident_trigger
  AFTER INSERT ON public.runs
  FOR EACH ROW EXECUTE FUNCTION public.detect_spend_incident();

DROP TRIGGER IF EXISTS record_guard_block_signal_trigger ON public.guard_reservations;
CREATE TRIGGER record_guard_block_signal_trigger
  AFTER INSERT ON public.guard_reservations
  FOR EACH ROW EXECUTE FUNCTION public.record_guard_block_signal();


-- ===== END 20260918011300_event_driven_signals.sql =====


-- ===== BEGIN 20260918011400_replay_conflict_guards.sql =====

-- Idempotency keys are immutable payload identities. A retry with the same
-- payload is safe; a conflicting payload is a client conflict, never a replay.

CREATE OR REPLACE FUNCTION public.record_ingest_run(
  p_flow_id UUID,
  p_event_id TEXT,
  p_status TEXT,
  p_duration_ms INTEGER,
  p_token_count INTEGER,
  p_cost_usd NUMERIC,
  p_error_message TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'live'
)
RETURNS TABLE(recorded BOOLEAN, run_id UUID, duplicate BOOLEAN, control_allow_next BOOLEAN, control_reason TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flow public.flows%ROWTYPE;
  v_existing public.runs%ROWTYPE;
  v_run_id UUID;
  v_monthly_spend NUMERIC;
  v_daily_spend NUMERIC;
  v_allow_next BOOLEAN;
  v_reason TEXT;
  v_error_message TEXT := NULLIF(p_error_message, '');
BEGIN
  IF p_event_id IS NULL OR char_length(p_event_id) NOT BETWEEN 1 AND 160
     OR p_status NOT IN ('success', 'error')
     OR p_duration_ms IS NULL OR p_duration_ms < 0
     OR p_token_count IS NULL OR p_token_count < 0
     OR p_cost_usd IS NULL OR p_cost_usd < 0
     OR p_source NOT IN ('live', 'guarded', 'monitor', 'synthetic_seed', 'synthetic_demo') THEN
    RAISE EXCEPTION 'invalid telemetry payload' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_flow FROM public.flows WHERE id = p_flow_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'flow not found' USING ERRCODE = 'P0002'; END IF;

  SELECT * INTO v_existing FROM public.runs WHERE flow_id = p_flow_id AND event_id = p_event_id;
  IF FOUND THEN
    IF v_existing.status <> p_status
       OR v_existing.duration_ms <> p_duration_ms
       OR v_existing.token_count <> p_token_count
       OR v_existing.cost_usd <> p_cost_usd
       OR v_existing.source <> p_source
       OR COALESCE(v_existing.error_message, '') <> COALESCE(v_error_message, '') THEN
      RAISE EXCEPTION 'event_id already used with a different payload' USING ERRCODE = '23505';
    END IF;
    RETURN QUERY SELECT true, v_existing.id, true,
      v_flow.flow_enabled AND v_flow.control_state = 'running',
      CASE WHEN v_flow.control_state = 'emergency_stopped' THEN 'emergency_stopped' WHEN NOT v_flow.flow_enabled THEN 'paused' ELSE 'duplicate_event' END;
    RETURN;
  END IF;

  INSERT INTO public.runs (flow_id, event_id, source, status, duration_ms, token_count, cost_usd, error_message)
  VALUES (p_flow_id, p_event_id, p_source, p_status, p_duration_ms, p_token_count, p_cost_usd, v_error_message)
  RETURNING id INTO v_run_id;

  SELECT COALESCE(SUM(cost_usd), 0) INTO v_monthly_spend
  FROM public.runs WHERE flow_id = p_flow_id AND created_at >= date_trunc('month', timezone('UTC', now())) AT TIME ZONE 'UTC' AND source <> 'synthetic_demo';
  SELECT COALESCE(SUM(cost_usd), 0) INTO v_daily_spend
  FROM public.runs WHERE flow_id = p_flow_id AND created_at >= date_trunc('day', timezone('UTC', now())) AT TIME ZONE 'UTC' AND source <> 'synthetic_demo';

  v_allow_next := v_flow.flow_enabled AND v_flow.control_state = 'running';
  v_reason := CASE
    WHEN v_flow.control_state = 'emergency_stopped' THEN 'emergency_stopped'
    WHEN v_flow.archived_at IS NOT NULL THEN 'archived'
    WHEN NOT v_flow.flow_enabled THEN 'paused'
    WHEN v_flow.budget_limit IS NOT NULL AND v_monthly_spend > v_flow.budget_limit THEN 'budget_exceeded'
    WHEN v_flow.daily_budget_limit IS NOT NULL AND v_daily_spend > v_flow.daily_budget_limit THEN 'daily_budget_exceeded'
    ELSE 'ok'
  END;
  IF v_reason IN ('budget_exceeded', 'daily_budget_exceeded') THEN
    v_allow_next := false;
    UPDATE public.flows SET flow_enabled = false, control_state = 'paused' WHERE id = p_flow_id;
  END IF;
  RETURN QUERY SELECT true, v_run_id, false, v_allow_next, v_reason;
END;
$$;

CREATE OR REPLACE FUNCTION public.authorize_guard_request(
  p_flow_id UUID,
  p_request_id TEXT,
  p_max_cost_usd NUMERIC
)
RETURNS TABLE(allowed BOOLEAN, reason TEXT, reservation_id UUID, remaining_budget_usd NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flow public.flows%ROWTYPE;
  v_existing public.guard_reservations%ROWTYPE;
  v_monthly_spend NUMERIC;
  v_daily_spend NUMERIC;
  v_reserved NUMERIC;
  v_remaining NUMERIC;
  v_reason TEXT := 'approved';
  v_allowed BOOLEAN := true;
  v_reservation_id UUID;
BEGIN
  IF p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 160 OR p_max_cost_usd IS NULL OR p_max_cost_usd < 0 THEN
    RAISE EXCEPTION 'invalid guard request' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_flow FROM public.flows WHERE id = p_flow_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'flow not found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO v_existing FROM public.guard_reservations WHERE flow_id = p_flow_id AND request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.max_cost_usd <> p_max_cost_usd THEN
      RAISE EXCEPTION 'request_id already used with a different maximum cost' USING ERRCODE = '23505';
    END IF;
    RETURN QUERY SELECT v_existing.allowed, 'duplicate_request', v_existing.id, NULL::NUMERIC;
    RETURN;
  END IF;

  SELECT COALESCE(SUM(cost_usd), 0) INTO v_monthly_spend FROM public.runs
  WHERE flow_id = p_flow_id AND created_at >= date_trunc('month', timezone('UTC', now())) AT TIME ZONE 'UTC' AND source <> 'synthetic_demo';
  SELECT COALESCE(SUM(cost_usd), 0) INTO v_daily_spend FROM public.runs
  WHERE flow_id = p_flow_id AND created_at >= date_trunc('day', timezone('UTC', now())) AT TIME ZONE 'UTC' AND source <> 'synthetic_demo';
  SELECT COALESCE(SUM(max_cost_usd), 0) INTO v_reserved FROM public.guard_reservations
  WHERE flow_id = p_flow_id AND status IN ('reserved', 'unknown');

  IF v_flow.control_state = 'emergency_stopped' THEN v_allowed := false; v_reason := 'emergency_stopped';
  ELSIF v_flow.archived_at IS NOT NULL THEN v_allowed := false; v_reason := 'archived';
  ELSIF NOT v_flow.flow_enabled OR v_flow.control_state <> 'running' THEN v_allowed := false; v_reason := 'paused';
  ELSIF v_flow.approval_status <> 'approved' AND v_flow.environment = 'production' THEN v_allowed := false; v_reason := 'approval_required';
  ELSIF v_flow.budget_limit IS NOT NULL AND v_monthly_spend + v_reserved + p_max_cost_usd > v_flow.budget_limit THEN v_allowed := false; v_reason := 'budget_exceeded';
  ELSIF v_flow.daily_budget_limit IS NOT NULL AND v_daily_spend + v_reserved + p_max_cost_usd > v_flow.daily_budget_limit THEN v_allowed := false; v_reason := 'daily_budget_exceeded';
  END IF;

  IF v_flow.budget_limit IS NOT NULL THEN v_remaining := v_flow.budget_limit - v_monthly_spend - v_reserved;
  ELSIF v_flow.daily_budget_limit IS NOT NULL THEN v_remaining := v_flow.daily_budget_limit - v_daily_spend - v_reserved;
  ELSE v_remaining := NULL;
  END IF;
  INSERT INTO public.guard_reservations(flow_id, request_id, max_cost_usd, status, allowed, reason)
  VALUES (p_flow_id, p_request_id, p_max_cost_usd, CASE WHEN v_allowed THEN 'reserved' ELSE 'denied' END, v_allowed, v_reason)
  RETURNING id INTO v_reservation_id;
  RETURN QUERY SELECT v_allowed, v_reason, v_reservation_id, GREATEST(v_remaining, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.settle_guard_request(
  p_reservation_id UUID,
  p_status TEXT,
  p_duration_ms INTEGER,
  p_token_count INTEGER,
  p_actual_cost_usd NUMERIC,
  p_error_message TEXT DEFAULT NULL
)
RETURNS TABLE(settled BOOLEAN, run_id UUID, actual_cost_usd NUMERIC, bound_violation BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation public.guard_reservations%ROWTYPE;
  v_existing_run public.runs%ROWTYPE;
  v_run_id UUID;
  v_bound_violation BOOLEAN;
  v_error_message TEXT := NULLIF(p_error_message, '');
BEGIN
  IF p_reservation_id IS NULL OR p_status NOT IN ('success', 'error') OR p_duration_ms IS NULL OR p_duration_ms < 0 OR p_token_count IS NULL OR p_token_count < 0 OR p_actual_cost_usd IS NULL OR p_actual_cost_usd < 0 THEN
    RAISE EXCEPTION 'invalid settlement payload' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_reservation FROM public.guard_reservations WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'reservation not found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO v_existing_run FROM public.runs WHERE reservation_id = p_reservation_id;
  IF FOUND THEN
    IF v_existing_run.status <> p_status OR v_existing_run.duration_ms <> p_duration_ms OR v_existing_run.token_count <> p_token_count OR v_existing_run.cost_usd <> p_actual_cost_usd OR COALESCE(v_existing_run.error_message, '') <> COALESCE(v_error_message, '') THEN
      RAISE EXCEPTION 'reservation already settled with a different payload' USING ERRCODE = '23505';
    END IF;
    RETURN QUERY SELECT true, v_existing_run.id, v_existing_run.cost_usd, v_existing_run.bound_violation;
    RETURN;
  END IF;
  IF v_reservation.status = 'denied' THEN RAISE EXCEPTION 'reservation was denied' USING ERRCODE = '42501'; END IF;
  v_bound_violation := p_actual_cost_usd > v_reservation.max_cost_usd;
  INSERT INTO public.runs (flow_id, event_id, reservation_id, source, status, duration_ms, token_count, cost_usd, error_message, bound_violation)
  VALUES (v_reservation.flow_id, v_reservation.request_id, p_reservation_id, 'guarded', p_status, p_duration_ms, p_token_count, p_actual_cost_usd, v_error_message, v_bound_violation)
  RETURNING id INTO v_run_id;
  UPDATE public.guard_reservations SET status = 'settled', actual_cost_usd = p_actual_cost_usd, bound_violation = v_bound_violation, settled_at = now() WHERE id = p_reservation_id;
  IF v_bound_violation THEN UPDATE public.flows SET flow_enabled = false, control_state = 'paused' WHERE id = v_reservation.flow_id; END IF;
  RETURN QUERY SELECT true, v_run_id, p_actual_cost_usd, v_bound_violation;
END;
$$;

REVOKE ALL ON FUNCTION public.record_ingest_run(UUID, TEXT, TEXT, INTEGER, INTEGER, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_ingest_run(UUID, TEXT, TEXT, INTEGER, INTEGER, NUMERIC, TEXT, TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.authorize_guard_request(UUID, TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.authorize_guard_request(UUID, TEXT, NUMERIC) TO service_role;
REVOKE ALL ON FUNCTION public.settle_guard_request(UUID, TEXT, INTEGER, INTEGER, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_guard_request(UUID, TEXT, INTEGER, INTEGER, NUMERIC, TEXT) TO service_role;


-- ===== END 20260918011400_replay_conflict_guards.sql =====


-- ===== BEGIN 20260918011500_safe_flow_insert_policy.sql =====

-- Prevent members from bypassing review by supplying privileged governance fields on INSERT.
DROP POLICY IF EXISTS "Members can create their own flows" ON public.flows;

CREATE POLICY "Members create safe experiments" ON public.flows
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND auth.uid() = created_by
    AND public.is_workspace_member(workspace_id)
    AND (
      public.is_workspace_admin(workspace_id)
      OR (
        environment = 'experiment'
        AND approval_status = 'pending'
        AND protection_mode = 'monitor_only'
        AND control_state = 'running'
        AND archived_at IS NULL
        AND reviewed_by IS NULL
        AND last_reviewed_at IS NULL
        AND accountable_owner_member_id IS NULL
        AND budget_owner_member_id IS NULL
        AND budget_limit IS NULL
        AND daily_budget_limit IS NULL
        AND emergency_stopped_by IS NULL
        AND emergency_stopped_at IS NULL
      )
    )
  );

COMMENT ON POLICY "Members create safe experiments" ON public.flows IS
  'Members may register only pending monitor-only experiments. Admins retain reviewed creation authority.';


-- ===== END 20260918011500_safe_flow_insert_policy.sql =====

COMMIT;
