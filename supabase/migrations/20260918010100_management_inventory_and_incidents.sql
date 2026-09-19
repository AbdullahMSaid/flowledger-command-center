-- Server-backed management inventory and audited incident resolution.
-- These functions keep period totals and workflow rows workspace-scoped.

CREATE OR REPLACE FUNCTION public.get_workspace_inventory(
  p_workspace_id UUID,
  p_period_start TIMESTAMP WITH TIME ZONE,
  p_period_end TIMESTAMP WITH TIME ZONE,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  flow_id UUID,
  name TEXT,
  description TEXT,
  business_purpose TEXT,
  expected_outcome TEXT,
  target_quantity NUMERIC,
  value_per_unit_usd NUMERIC,
  value_assumptions TEXT,
  platform TEXT,
  model TEXT,
  team_label TEXT,
  environment TEXT,
  approval_status TEXT,
  protection_mode TEXT,
  control_state TEXT,
  flow_enabled BOOLEAN,
  accountable_owner_member_id UUID,
  expected_monthly_value_usd NUMERIC,
  value_currency TEXT,
  value_source TEXT,
  today_cost_usd NUMERIC,
  period_cost_usd NUMERIC,
  period_run_count BIGINT,
  period_token_count BIGINT,
  last_run_at TIMESTAMP WITH TIME ZONE,
  archived_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.id,
    f.name,
    f.description,
    f.business_purpose,
    f.expected_outcome,
    f.target_quantity,
    f.value_per_unit_usd,
    f.value_assumptions,
    f.platform,
    f.model,
    f.team_label,
    f.environment,
    f.approval_status,
    f.protection_mode,
    f.control_state,
    f.flow_enabled,
    f.accountable_owner_member_id,
    f.expected_monthly_value_usd,
    f.value_currency,
    f.value_source,
    COALESCE(SUM(CASE
      WHEN r.created_at >= date_trunc('day', timezone('UTC', now()))
       AND r.source <> 'synthetic_demo' THEN r.cost_usd
      ELSE 0
    END), 0),
    COALESCE(SUM(CASE
      WHEN r.created_at >= p_period_start
       AND r.created_at < p_period_end
       AND r.source <> 'synthetic_demo' THEN r.cost_usd
      ELSE 0
    END), 0),
    COUNT(r.id) FILTER (
      WHERE r.created_at >= p_period_start
        AND r.created_at < p_period_end
        AND r.source <> 'synthetic_demo'
    ),
    COALESCE(SUM(r.token_count) FILTER (
      WHERE r.created_at >= p_period_start
        AND r.created_at < p_period_end
        AND r.source <> 'synthetic_demo'
    ), 0),
    MAX(r.created_at),
    f.archived_at
  FROM public.flows f
  LEFT JOIN public.runs r ON r.flow_id = f.id
  WHERE f.workspace_id = p_workspace_id
    AND public.is_workspace_member(p_workspace_id)
  GROUP BY f.id
  ORDER BY f.archived_at NULLS FIRST, f.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 200)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

CREATE OR REPLACE FUNCTION public.resolve_incident(
  p_incident_id UUID,
  p_resolution_note TEXT
)
RETURNS TABLE(status TEXT, resolved_at TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_incident public.incidents%ROWTYPE;
BEGIN
  IF p_resolution_note IS NULL OR char_length(trim(p_resolution_note)) < 3 OR char_length(p_resolution_note) > 1000 THEN
    RAISE EXCEPTION 'resolution note must be between 3 and 1000 characters' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_incident
  FROM public.incidents
  WHERE id = p_incident_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'incident not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.is_workspace_admin(v_incident.workspace_id) THEN
    RAISE EXCEPTION 'admin permission required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.incidents
  SET status = 'resolved',
      resolved_at = now(),
      resolution_note = trim(p_resolution_note),
      resolved_by = auth.uid()
  WHERE id = p_incident_id;

  INSERT INTO public.audit_log(workspace_id, actor_user_id, entity_type, entity_id, action, reason, old_values, new_values)
  VALUES (
    v_incident.workspace_id,
    auth.uid(),
    'incident',
    p_incident_id,
    'resolve',
    trim(p_resolution_note),
    jsonb_build_object('status', v_incident.status),
    jsonb_build_object('status', 'resolved')
  );

  RETURN QUERY SELECT 'resolved'::TEXT, now();
END;
$$;

REVOKE ALL ON FUNCTION public.get_workspace_inventory(UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_workspace_inventory(UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, INTEGER, INTEGER) TO authenticated;
REVOKE ALL ON FUNCTION public.resolve_incident(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_incident(UUID, TEXT) TO authenticated;
