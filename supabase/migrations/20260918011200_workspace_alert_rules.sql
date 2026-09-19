-- Move the legacy alert tables into the existing workspace boundary. Delivery
-- remains in-app only; email and outbound webhook integrations are not enabled.

ALTER TABLE public.alert_rules
  ADD COLUMN IF NOT EXISTS workspace_id UUID;
ALTER TABLE public.alert_history
  ADD COLUMN IF NOT EXISTS workspace_id UUID;

UPDATE public.alert_rules ar
SET workspace_id = COALESCE(
  (SELECT f.workspace_id FROM public.flows f WHERE f.id = ar.flow_id),
  (SELECT w.id FROM public.workspaces w WHERE w.owner_user_id = ar.user_id)
)
WHERE ar.workspace_id IS NULL;

UPDATE public.alert_history ah
SET workspace_id = COALESCE(
  (SELECT ar.workspace_id FROM public.alert_rules ar WHERE ar.id = ah.rule_id),
  (SELECT f.workspace_id FROM public.flows f WHERE f.id = ah.flow_id),
  (SELECT w.id FROM public.workspaces w WHERE w.owner_user_id = ah.user_id)
)
WHERE ah.workspace_id IS NULL;

ALTER TABLE public.alert_rules ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.alert_history ALTER COLUMN workspace_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alert_rules_workspace_id_fkey') THEN
    ALTER TABLE public.alert_rules ADD CONSTRAINT alert_rules_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alert_history_workspace_id_fkey') THEN
    ALTER TABLE public.alert_history ADD CONSTRAINT alert_history_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can view own alert rules" ON public.alert_rules;
DROP POLICY IF EXISTS "Users can create own alert rules" ON public.alert_rules;
DROP POLICY IF EXISTS "Users can update own alert rules" ON public.alert_rules;
DROP POLICY IF EXISTS "Users can delete own alert rules" ON public.alert_rules;
CREATE POLICY "Workspace members can view alert rules" ON public.alert_rules
  FOR SELECT USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Workspace admins can create alert rules" ON public.alert_rules
  FOR INSERT WITH CHECK (public.is_workspace_admin(workspace_id) AND auth.uid() = user_id);
CREATE POLICY "Workspace admins can update alert rules" ON public.alert_rules
  FOR UPDATE USING (public.is_workspace_admin(workspace_id));
CREATE POLICY "Workspace admins can delete alert rules" ON public.alert_rules
  FOR DELETE USING (public.is_workspace_admin(workspace_id));

DROP POLICY IF EXISTS "Users can view own alert history" ON public.alert_history;
DROP POLICY IF EXISTS "Service can insert alert history" ON public.alert_history;
DROP POLICY IF EXISTS "Authenticated can insert alert history" ON public.alert_history;
CREATE POLICY "Workspace members can view alert history" ON public.alert_history
  FOR SELECT USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Service can insert workspace alert history" ON public.alert_history
  FOR INSERT TO service_role WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_alert_rules_workspace ON public.alert_rules(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_history_workspace ON public.alert_history(workspace_id, created_at DESC);
