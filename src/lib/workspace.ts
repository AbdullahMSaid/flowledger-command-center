import { supabase } from "@/integrations/supabase/client";

export type WorkspaceMembership = {
  workspace_id: string;
  role: string;
  workspaces: { name?: string } | null;
};

const membershipRequests = new Map<string, Promise<WorkspaceMembership | null>>();

export const getWorkspaceMembership = (userId: string) => {
  const existing = membershipRequests.get(userId);
  if (existing) return existing;

  const request = Promise.resolve(supabase
    .from("workspace_members")
    .select("workspace_id, role, workspaces(name)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle())
    .then(({ data, error }) => {
      if (error) throw error;
      return data as WorkspaceMembership | null;
    })
    .catch((error) => {
      membershipRequests.delete(userId);
      throw error;
    });

  membershipRequests.set(userId, request);
  return request;
};
