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
