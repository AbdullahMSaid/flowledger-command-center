-- New accounts must receive a private workspace before Auth confirms signup.
-- Recreate the FlowLedger trigger so stale trigger definitions cannot leave
-- email or Google users with a partial account.

DROP TRIGGER IF EXISTS on_auth_user_created_seed ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_provision_workspace ON auth.users;

CREATE OR REPLACE FUNCTION public.provision_user_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_workspace_id UUID;
BEGIN
  INSERT INTO public.workspaces (owner_user_id, name)
  VALUES (NEW.id, 'Private workspace')
  ON CONFLICT (owner_user_id) DO UPDATE
    SET name = public.workspaces.name
  RETURNING id INTO v_workspace_id;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_workspace_id, NEW.id, 'admin')
  ON CONFLICT (workspace_id, user_id) DO UPDATE
    SET role = 'admin';

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_provision_workspace
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.provision_user_workspace();
