-- Keep owner references inside the flow's workspace and expose an audited
-- admin path for governance ownership/purpose changes.

CREATE OR REPLACE FUNCTION public.validate_flow_workspace_members()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.accountable_owner_member_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE id = NEW.accountable_owner_member_id AND workspace_id = NEW.workspace_id
  ) THEN
    RAISE EXCEPTION 'accountable owner must belong to the flow workspace' USING ERRCODE = '22023';
  END IF;
  IF NEW.budget_owner_member_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE id = NEW.budget_owner_member_id AND workspace_id = NEW.workspace_id
  ) THEN
    RAISE EXCEPTION 'budget owner must belong to the flow workspace' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_flow_workspace_members_trigger ON public.flows;
CREATE TRIGGER validate_flow_workspace_members_trigger
  BEFORE INSERT OR UPDATE OF workspace_id, accountable_owner_member_id, budget_owner_member_id ON public.flows
  FOR EACH ROW EXECUTE FUNCTION public.validate_flow_workspace_members();

CREATE OR REPLACE FUNCTION public.set_flow_governance(
  p_flow_id UUID,
  p_accountable_owner_member_id UUID,
  p_budget_owner_member_id UUID,
  p_team_label TEXT,
  p_business_purpose TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS TABLE(accountable_owner_member_id UUID, budget_owner_member_id UUID, team_label TEXT, business_purpose TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flow public.flows%ROWTYPE;
  v_old JSONB;
  v_new JSONB;
BEGIN
  SELECT * INTO v_flow FROM public.flows WHERE id = p_flow_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'flow not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.is_workspace_admin(v_flow.workspace_id) THEN RAISE EXCEPTION 'admin permission required' USING ERRCODE = '42501'; END IF;
  IF p_accountable_owner_member_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.workspace_members WHERE id = p_accountable_owner_member_id AND workspace_id = v_flow.workspace_id) THEN RAISE EXCEPTION 'accountable owner must belong to the flow workspace' USING ERRCODE = '22023'; END IF;
  IF p_budget_owner_member_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.workspace_members WHERE id = p_budget_owner_member_id AND workspace_id = v_flow.workspace_id) THEN RAISE EXCEPTION 'budget owner must belong to the flow workspace' USING ERRCODE = '22023'; END IF;

  v_old := jsonb_build_object('accountable_owner_member_id', v_flow.accountable_owner_member_id, 'budget_owner_member_id', v_flow.budget_owner_member_id, 'team_label', v_flow.team_label, 'business_purpose', v_flow.business_purpose);
  UPDATE public.flows
  SET accountable_owner_member_id = p_accountable_owner_member_id,
      budget_owner_member_id = p_budget_owner_member_id,
      team_label = NULLIF(trim(p_team_label), ''),
      business_purpose = NULLIF(trim(p_business_purpose), '')
  WHERE id = p_flow_id;
  SELECT jsonb_build_object('accountable_owner_member_id', accountable_owner_member_id, 'budget_owner_member_id', budget_owner_member_id, 'team_label', team_label, 'business_purpose', business_purpose) INTO v_new FROM public.flows WHERE id = p_flow_id;
  INSERT INTO public.audit_log(workspace_id, actor_user_id, entity_type, entity_id, action, reason, old_values, new_values)
  VALUES (v_flow.workspace_id, auth.uid(), 'flow', p_flow_id, 'governance_update', p_reason, v_old, v_new);
  RETURN QUERY SELECT (v_new->>'accountable_owner_member_id')::UUID, (v_new->>'budget_owner_member_id')::UUID, v_new->>'team_label', v_new->>'business_purpose';
END;
$$;

REVOKE ALL ON FUNCTION public.set_flow_governance(UUID, UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_flow_governance(UUID, UUID, UUID, TEXT, TEXT, TEXT) TO authenticated;
