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
