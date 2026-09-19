-- Replace random signup sample data with a private workspace provisioner.
DROP TRIGGER IF EXISTS on_auth_user_created_seed ON auth.users;

CREATE OR REPLACE FUNCTION public.provision_user_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  workspace_id UUID;
BEGIN
  INSERT INTO public.workspaces (owner_user_id, name)
  VALUES (NEW.id, 'Private workspace')
  ON CONFLICT (owner_user_id) DO NOTHING;

  SELECT id INTO workspace_id FROM public.workspaces WHERE owner_user_id = NEW.id;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (workspace_id, NEW.id, 'admin')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_provision_workspace
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.provision_user_workspace();

CREATE TABLE IF NOT EXISTS public.flow_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flow_id UUID NOT NULL REFERENCES public.flows(id) ON DELETE CASCADE,
  secret_hash TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  revoked_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_flow_credentials_active ON public.flow_credentials(flow_id) WHERE revoked_at IS NULL;
ALTER TABLE public.flow_credentials ENABLE ROW LEVEL SECURITY;
-- Plain credentials are returned only once by the server endpoint; hashes are never client-readable.

CREATE OR REPLACE FUNCTION public.populate_flow_workspace_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NULL THEN NEW.created_by := NEW.user_id; END IF;
  IF NEW.workspace_id IS NULL THEN
    SELECT workspace_id INTO NEW.workspace_id
    FROM public.workspace_members
    WHERE user_id = NEW.user_id
    ORDER BY created_at
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_flow_insert_defaults ON public.flows;
CREATE TRIGGER on_flow_insert_defaults
  BEFORE INSERT ON public.flows
  FOR EACH ROW
  EXECUTE FUNCTION public.populate_flow_workspace_defaults();

CREATE OR REPLACE FUNCTION public.settle_guard_request(
  p_reservation_id UUID,
  p_status TEXT,
  p_duration_ms INTEGER,
  p_token_count INTEGER,
  p_actual_cost_usd NUMERIC,
  p_error_message TEXT DEFAULT NULL
)
RETURNS TABLE(settled BOOLEAN, run_id UUID, actual_cost_usd NUMERIC, bound_violation BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation public.guard_reservations%ROWTYPE;
  v_existing_run public.runs%ROWTYPE;
  v_run_id UUID;
  v_bound_violation BOOLEAN;
BEGIN
  IF p_reservation_id IS NULL
     OR p_status NOT IN ('success', 'error')
     OR p_duration_ms IS NULL OR p_duration_ms < 0
     OR p_token_count IS NULL OR p_token_count < 0
     OR p_actual_cost_usd IS NULL OR p_actual_cost_usd < 0 THEN
    RAISE EXCEPTION 'invalid settlement payload' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_reservation
  FROM public.guard_reservations
  WHERE id = p_reservation_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'reservation not found' USING ERRCODE = 'P0002'; END IF;

  SELECT * INTO v_existing_run FROM public.runs WHERE reservation_id = p_reservation_id;
  IF FOUND THEN
    RETURN QUERY SELECT true, v_existing_run.id, v_existing_run.cost_usd, v_existing_run.bound_violation;
    RETURN;
  END IF;
  IF v_reservation.status = 'denied' THEN RAISE EXCEPTION 'reservation was denied' USING ERRCODE = '42501'; END IF;

  v_bound_violation := p_actual_cost_usd > v_reservation.max_cost_usd;
  INSERT INTO public.runs (flow_id, event_id, reservation_id, source, status, duration_ms, token_count, cost_usd, error_message, bound_violation)
  VALUES (v_reservation.flow_id, v_reservation.request_id, p_reservation_id, 'guarded', p_status, p_duration_ms, p_token_count, p_actual_cost_usd, NULLIF(p_error_message, ''), v_bound_violation)
  RETURNING id INTO v_run_id;

  UPDATE public.guard_reservations
  SET status = 'settled', actual_cost_usd = p_actual_cost_usd, bound_violation = v_bound_violation, settled_at = now()
  WHERE id = p_reservation_id;

  IF v_bound_violation THEN
    UPDATE public.flows SET flow_enabled = false, control_state = 'paused' WHERE id = v_reservation.flow_id;
  END IF;
  RETURN QUERY SELECT true, v_run_id, p_actual_cost_usd, v_bound_violation;
END;
$$;

REVOKE ALL ON FUNCTION public.settle_guard_request(UUID, TEXT, INTEGER, INTEGER, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_guard_request(UUID, TEXT, INTEGER, INTEGER, NUMERIC, TEXT) TO service_role;
