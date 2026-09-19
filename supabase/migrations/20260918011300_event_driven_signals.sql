-- Event-driven, explainable signals for live telemetry. This is intentionally
-- deterministic and runs on recorded events; it is not a polling monitor or an
-- LLM diagnosis engine.

CREATE OR REPLACE FUNCTION public.evaluate_run_alert_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flow RECORD;
  v_rule RECORD;
  v_monthly_spend NUMERIC;
  v_error_count BIGINT;
  v_sample_count BIGINT;
  v_triggered BOOLEAN;
BEGIN
  IF NEW.source = 'synthetic_demo' THEN
    RETURN NEW;
  END IF;

  SELECT id, name, workspace_id, budget_limit
  INTO v_flow
  FROM public.flows
  WHERE id = NEW.flow_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT COALESCE(SUM(r.cost_usd), 0)
  INTO v_monthly_spend
  FROM public.runs r
  WHERE r.flow_id = NEW.flow_id
    AND r.created_at >= date_trunc('month', timezone('UTC', now())) AT TIME ZONE 'UTC'
    AND r.source <> 'synthetic_demo';

  FOR v_rule IN
    SELECT *
    FROM public.alert_rules
    WHERE workspace_id = v_flow.workspace_id
      AND enabled
      AND (scope = 'all' OR flow_id = NEW.flow_id)
  LOOP
    v_triggered := CASE v_rule.condition_type
      WHEN 'spend_limit' THEN v_monthly_spend >= v_rule.threshold
      WHEN 'budget_exceeded' THEN v_flow.budget_limit IS NOT NULL AND v_monthly_spend >= v_flow.budget_limit
      WHEN 'token_spike' THEN NEW.token_count >= v_rule.threshold
      WHEN 'error_rate' THEN (
        SELECT COUNT(*) FILTER (WHERE r.status = 'error')::NUMERIC / NULLIF(COUNT(*), 0) * 100 >= v_rule.threshold
        FROM (
          SELECT status FROM public.runs
          WHERE flow_id = NEW.flow_id AND source <> 'synthetic_demo'
          ORDER BY created_at DESC LIMIT 10
        ) r
        HAVING COUNT(*) >= 5
      )
      ELSE false
    END;

    IF v_triggered AND NOT EXISTS (
      SELECT 1
      FROM public.alert_history h
      WHERE h.workspace_id = v_flow.workspace_id
        AND h.rule_id = v_rule.id
        AND h.flow_id = NEW.flow_id
        AND h.status = 'triggered'
        AND h.created_at >= now() - interval '15 minutes'
    ) THEN
      INSERT INTO public.alert_history(
        user_id, workspace_id, rule_id, rule_name, condition_type, flow_id, flow_name, status
      )
      VALUES (
        v_rule.user_id, v_flow.workspace_id, v_rule.id, v_rule.name,
        v_rule.condition_type, NEW.flow_id, v_flow.name, 'triggered'
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.detect_spend_incident()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flow RECORD;
  v_baseline_spend NUMERIC;
  v_current_spend NUMERIC;
  v_baseline_count BIGINT;
  v_current_rate NUMERIC;
  v_baseline_rate NUMERIC;
  v_existing_id UUID;
  v_ratio NUMERIC;
  v_floor CONSTANT NUMERIC := 0.05;
BEGIN
  IF NEW.source = 'synthetic_demo' THEN RETURN NEW; END IF;

  SELECT id, name, workspace_id, protection_mode
  INTO v_flow
  FROM public.flows
  WHERE id = NEW.flow_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT COALESCE(SUM(cost_usd), 0), COUNT(*)
  INTO v_baseline_spend, v_baseline_count
  FROM public.runs
  WHERE flow_id = NEW.flow_id
    AND source <> 'synthetic_demo'
    AND created_at >= now() - interval '35 minutes'
    AND created_at < now() - interval '5 minutes';

  SELECT COALESCE(SUM(cost_usd), 0)
  INTO v_current_spend
  FROM public.runs
  WHERE flow_id = NEW.flow_id
    AND source <> 'synthetic_demo'
    AND created_at >= now() - interval '5 minutes';

  IF v_baseline_count < 5 OR v_current_spend < v_floor THEN RETURN NEW; END IF;

  v_baseline_rate := v_baseline_spend / 30;
  v_current_rate := v_current_spend / 5;
  v_ratio := CASE WHEN v_baseline_rate = 0 THEN NULL ELSE v_current_rate / v_baseline_rate END;

  IF NOT ((v_baseline_rate = 0 AND v_current_spend >= v_floor) OR (v_baseline_rate > 0 AND v_current_rate >= v_baseline_rate * 3)) THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_existing_id
  FROM public.incidents
  WHERE flow_id = NEW.flow_id AND status = 'open'
  ORDER BY detected_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_existing_id IS NULL THEN
    INSERT INTO public.incidents(
      workspace_id, flow_id, severity, status, reason, baseline_rate, current_rate,
      threshold, observed_cost_usd, evidence
    )
    VALUES (
      v_flow.workspace_id, NEW.flow_id,
      CASE WHEN COALESCE(v_ratio, 99) >= 6 THEN 'critical' ELSE 'warning' END,
      'open', 'Five-minute spend rate exceeded the prior thirty-minute baseline',
      v_baseline_rate, v_current_rate, 3, v_current_spend,
      jsonb_build_object(
        'rule', 'current five-minute spend per minute >= 3x prior thirty-minute spend per minute',
        'absolute_floor_usd', v_floor,
        'baseline_sample_count', v_baseline_count,
        'baseline_window_minutes', 30,
        'current_window_minutes', 5,
        'ratio', v_ratio,
        'protection_mode', v_flow.protection_mode
      )
    );
  ELSE
    UPDATE public.incidents
    SET observed_cost_usd = v_current_spend,
        baseline_rate = v_baseline_rate,
        current_rate = v_current_rate,
        evidence = evidence || jsonb_build_object('last_observed_at', now(), 'last_ratio', v_ratio)
    WHERE id = v_existing_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_guard_block_signal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flow_id UUID;
BEGIN
  IF NEW.allowed THEN RETURN NEW; END IF;
  v_flow_id := NEW.flow_id;
  UPDATE public.incidents
  SET blocked_request_count = blocked_request_count + 1,
      evidence = evidence || jsonb_build_object(
        'last_blocked_at', now(),
        'last_block_reason', NEW.reason
      )
  WHERE flow_id = v_flow_id AND status = 'open';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS evaluate_run_alert_rules_trigger ON public.runs;
CREATE TRIGGER evaluate_run_alert_rules_trigger
  AFTER INSERT ON public.runs
  FOR EACH ROW EXECUTE FUNCTION public.evaluate_run_alert_rules();

DROP TRIGGER IF EXISTS detect_spend_incident_trigger ON public.runs;
CREATE TRIGGER detect_spend_incident_trigger
  AFTER INSERT ON public.runs
  FOR EACH ROW EXECUTE FUNCTION public.detect_spend_incident();

DROP TRIGGER IF EXISTS record_guard_block_signal_trigger ON public.guard_reservations;
CREATE TRIGGER record_guard_block_signal_trigger
  AFTER INSERT ON public.guard_reservations
  FOR EACH ROW EXECUTE FUNCTION public.record_guard_block_signal();
