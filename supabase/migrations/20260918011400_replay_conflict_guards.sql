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
