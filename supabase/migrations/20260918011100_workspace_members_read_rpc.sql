-- Expose only workspace membership identifiers/roles for safe ownership forms.
-- Email/profile data remains outside this prototype's schema.

CREATE OR REPLACE FUNCTION public.get_workspace_members(p_workspace_id UUID)
RETURNS TABLE(member_id UUID, user_id UUID, role TEXT)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.user_id, m.role
  FROM public.workspace_members AS m
  WHERE m.workspace_id = p_workspace_id
    AND public.is_workspace_member(p_workspace_id)
  ORDER BY m.role DESC, m.created_at ASC;
$$;

REVOKE ALL ON FUNCTION public.get_workspace_members(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_workspace_members(UUID) TO authenticated;
