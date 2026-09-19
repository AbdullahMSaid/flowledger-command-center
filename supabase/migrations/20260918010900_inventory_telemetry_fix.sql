-- Keep synthetic preview telemetry out of the live inventory's last-seen signal.

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
    MAX(r.created_at) FILTER (WHERE r.source <> 'synthetic_demo'),
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

REVOKE ALL ON FUNCTION public.get_workspace_inventory(UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_workspace_inventory(UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, INTEGER, INTEGER) TO authenticated;
