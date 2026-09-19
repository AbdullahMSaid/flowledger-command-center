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
