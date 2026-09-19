import { createClient, type User } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function requireUser(req: Request): Promise<{ user: User | null; error?: string }> {
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return { user: null, error: "Missing Authorization header" };

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return { user: null, error: "Auth configuration unavailable" };

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await authClient.auth.getUser();
  return error || !data.user ? { user: null, error: "Invalid authentication token" } : { user: data.user };
}

export async function authenticateFlowRequest(req: Request, flowId: string): Promise<{ userId: string | null; isFlowCredential: boolean; error?: string }> {
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return { userId: null, isFlowCredential: false, error: "Missing Authorization header" };

  const token = authorization.slice("Bearer ".length).trim();
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return { userId: null, isFlowCredential: false, error: "Auth configuration unavailable" };

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await authClient.auth.getUser();
  if (data.user) return { userId: data.user.id, isFlowCredential: false };

  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const secretHash = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: credential } = await serviceClient
    .from("flow_credentials")
    .select("flow_id, revoked_at, flows!inner(user_id)")
    .eq("flow_id", flowId)
    .eq("secret_hash", secretHash)
    .is("revoked_at", null)
    .maybeSingle();
  if (!credential) return { userId: null, isFlowCredential: true, error: "Invalid flow credential" };
  return { userId: (credential.flows as { user_id: string }).user_id, isFlowCredential: true };
}
