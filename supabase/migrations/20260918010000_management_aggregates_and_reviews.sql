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
