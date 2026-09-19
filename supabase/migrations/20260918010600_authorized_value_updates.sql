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
