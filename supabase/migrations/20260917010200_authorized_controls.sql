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
