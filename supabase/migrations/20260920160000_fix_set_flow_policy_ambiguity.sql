CREATE OR REPLACE FUNCTION public.set_flow_policy(
  p_flow_id UUID, p_budget_limit NUMERIC, p_daily_budget_limit NUMERIC,
  p_protection_mode TEXT, p_reason TEXT DEFAULT NULL
)
RETURNS TABLE(budget_limit NUMERIC, daily_budget_limit NUMERIC, protection_mode TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE v_flow public.flows%ROWTYPE; v_old JSONB; v_new JSONB;
BEGIN
  IF p_budget_limit IS NOT NULL AND p_budget_limit < 0 THEN RAISE EXCEPTION 'monthly budget cannot be negative' USING ERRCODE = '22023'; END IF;
  IF p_daily_budget_limit IS NOT NULL AND p_daily_budget_limit < 0 THEN RAISE EXCEPTION 'daily budget cannot be negative' USING ERRCODE = '22023'; END IF;
  IF p_protection_mode NOT IN ('Guard connected', 'Monitor only') THEN RAISE EXCEPTION 'invalid protection mode' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_flow FROM public.flows f WHERE f.id = p_flow_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'flow not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.is_workspace_admin(v_flow.workspace_id) THEN RAISE EXCEPTION 'admin permission required' USING ERRCODE = '42501'; END IF;
  v_old := jsonb_build_object('budget_limit',v_flow.budget_limit,'daily_budget_limit',v_flow.daily_budget_limit,'protection_mode',v_flow.protection_mode);
  UPDATE public.flows f SET budget_limit=p_budget_limit,daily_budget_limit=p_daily_budget_limit,protection_mode=p_protection_mode WHERE f.id=p_flow_id;
  SELECT jsonb_build_object('budget_limit',f.budget_limit,'daily_budget_limit',f.daily_budget_limit,'protection_mode',f.protection_mode) INTO v_new FROM public.flows f WHERE f.id=p_flow_id;
  INSERT INTO public.audit_log(workspace_id,actor_user_id,entity_type,entity_id,action,reason,old_values,new_values)
  VALUES(v_flow.workspace_id,auth.uid(),'flow',p_flow_id,'policy_update',p_reason,v_old,v_new);
  RETURN QUERY SELECT (v_new->>'budget_limit')::NUMERIC,(v_new->>'daily_budget_limit')::NUMERIC,v_new->>'protection_mode';
END;
$$;
