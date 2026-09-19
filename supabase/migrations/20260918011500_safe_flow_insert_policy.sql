-- Prevent members from bypassing review by supplying privileged governance fields on INSERT.
DROP POLICY IF EXISTS "Members can create their own flows" ON public.flows;

CREATE POLICY "Members create safe experiments" ON public.flows
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND auth.uid() = created_by
    AND public.is_workspace_member(workspace_id)
    AND (
      public.is_workspace_admin(workspace_id)
      OR (
        environment = 'experiment'
        AND approval_status = 'pending'
        AND protection_mode = 'monitor_only'
        AND control_state = 'running'
        AND archived_at IS NULL
        AND reviewed_by IS NULL
        AND last_reviewed_at IS NULL
        AND accountable_owner_member_id IS NULL
        AND budget_owner_member_id IS NULL
        AND budget_limit IS NULL
        AND daily_budget_limit IS NULL
        AND emergency_stopped_by IS NULL
        AND emergency_stopped_at IS NULL
      )
    )
  );

COMMENT ON POLICY "Members create safe experiments" ON public.flows IS
  'Members may register only pending monitor-only experiments. Admins retain reviewed creation authority.';
