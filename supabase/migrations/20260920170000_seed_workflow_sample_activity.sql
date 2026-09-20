CREATE OR REPLACE FUNCTION public.seed_workflow_sample_activity(p_flow_id UUID)
RETURNS TABLE(run_count INTEGER, token_count BIGINT, cost_usd NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_flow public.flows%ROWTYPE;
BEGIN
  SELECT * INTO v_flow FROM public.flows f WHERE f.id=p_flow_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'workflow not found' USING ERRCODE='P0002'; END IF;
  IF NOT public.is_workspace_member(v_flow.workspace_id) THEN RAISE EXCEPTION 'workspace access required' USING ERRCODE='42501'; END IF;
  IF v_flow.archived_at IS NOT NULL THEN RAISE EXCEPTION 'archived workflows cannot receive sample activity' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.runs r WHERE r.flow_id=p_flow_id AND r.source='synthetic_seed') THEN
    INSERT INTO public.runs(flow_id,event_id,source,status,duration_ms,token_count,cost_usd,created_at)
    SELECT p_flow_id,'sample-'||p_flow_id||'-'||n,'synthetic_seed','success',400+(random()*1800)::INTEGER,
      450+(random()*1550)::INTEGER,round((0.002+random()*0.016)::NUMERIC,4),now()-(n||' hours')::INTERVAL
    FROM generate_series(0,23) n;
  END IF;
  RETURN QUERY SELECT count(*)::INTEGER,coalesce(sum(r.token_count),0)::BIGINT,coalesce(sum(r.cost_usd),0)::NUMERIC
    FROM public.runs r WHERE r.flow_id=p_flow_id AND r.source='synthetic_seed';
END;$$;
REVOKE ALL ON FUNCTION public.seed_workflow_sample_activity(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.seed_workflow_sample_activity(UUID) TO authenticated;
