import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json, requireUser } from "../_shared/auth.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function hashSecret(secret: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const { user, error: authError } = await requireUser(req);
  if (!user) return json({ error: authError || "Unauthorized" }, 401);

  try {
    const body = await req.json();
    if (typeof body.flow_id !== "string" || !UUID_RE.test(body.flow_id)) return json({ error: "Invalid flow_id" }, 400);
    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: flow } = await service.from("flows").select("id, user_id, workspace_id").eq("id", body.flow_id).single();
    if (!flow) return json({ error: "Flow not found" }, 404);

    const { data: membership } = await service
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", flow.workspace_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (flow.user_id !== user.id && membership?.role !== "admin") return json({ error: "Admin or flow owner required" }, 403);

    const secret = `fl_${crypto.randomUUID()}_${crypto.randomUUID().replaceAll("-", "")}`;
    const secretHash = await hashSecret(secret);
    await service.from("flow_credentials").update({ revoked_at: new Date().toISOString() }).eq("flow_id", flow.id).is("revoked_at", null);
    const { error } = await service.from("flow_credentials").insert({ flow_id: flow.id, secret_hash: secretHash, created_by: user.id });
    if (error) return json({ error: "Unable to create flow credential" }, 500);
    return json({ credential: secret, warning: "Copy this credential now. It will not be shown again." });
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }
});
