CREATE OR REPLACE FUNCTION public.archive_flow(p_flow_id UUID,p_reason TEXT DEFAULT NULL)
RETURNS TABLE(archived_at TIMESTAMPTZ,flow_enabled BOOLEAN,control_state TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
#variable_conflict use_column
DECLARE v_flow public.flows%ROWTYPE;v_archived_at TIMESTAMPTZ;
BEGIN
 SELECT * INTO v_flow FROM public.flows f WHERE f.id=p_flow_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'flow not found' USING ERRCODE='P0002';END IF;
 IF NOT public.is_workspace_admin(v_flow.workspace_id) THEN RAISE EXCEPTION 'admin permission required' USING ERRCODE='42501';END IF;
 IF v_flow.archived_at IS NULL THEN
  v_archived_at:=now();
  UPDATE public.flows f SET archived_at=v_archived_at,flow_enabled=false,control_state=CASE WHEN f.control_state='emergency_stopped' THEN f.control_state ELSE 'paused' END WHERE f.id=p_flow_id;
  INSERT INTO public.audit_log(workspace_id,actor_user_id,entity_type,entity_id,action,reason,old_values,new_values)
  VALUES(v_flow.workspace_id,auth.uid(),'flow',p_flow_id,'archive',p_reason,jsonb_build_object('archived_at',v_flow.archived_at,'flow_enabled',v_flow.flow_enabled,'control_state',v_flow.control_state),jsonb_build_object('archived_at',v_archived_at,'flow_enabled',false,'control_state',CASE WHEN v_flow.control_state='emergency_stopped' THEN v_flow.control_state ELSE 'paused' END));
 ELSE v_archived_at:=v_flow.archived_at;END IF;
 RETURN QUERY SELECT f.archived_at,f.flow_enabled,f.control_state FROM public.flows f WHERE f.id=p_flow_id;
END;
$$;
