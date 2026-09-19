import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateFlowRequest, corsHeaders, json } from "../_shared/auth.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const parts = new URL(req.url).pathname.split("/").filter(Boolean);
    const flowId = parts[parts.length - 1];
    if (!flowId || !UUID_RE.test(flowId)) return json({ error: "Invalid flowId" }, 400);
    const { userId, isFlowCredential, error: authError } = await authenticateFlowRequest(req, flowId);
    if (!userId) return json({ error: authError || "Unauthorized" }, 401);
    const body = await req.json();
    if (typeof body.request_id !== "string" || body.request_id.length < 1 || body.request_id.length > 160 ||
        typeof body.max_cost_usd !== "number" || !Number.isFinite(body.max_cost_usd) || body.max_cost_usd < 0) {
      return json({ error: "request_id and a finite nonnegative max_cost_usd are required" }, 400);
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: flow } = await supabase.from("flows").select("id, user_id, workspace_id").eq("id", flowId).single();
    if (!flow) return json({ error: "Flow not found" }, 404);
    if (flow.user_id !== userId && !isFlowCredential) {
      const { data: membership } = await supabase.from("workspace_members").select("role").eq("workspace_id", flow.workspace_id).eq("user_id", userId).maybeSingle();
      if (membership?.role !== "admin") return json({ error: "You do not have access to this flow" }, 403);
    } else if (flow.user_id !== userId) {
      return json({ error: "You do not have access to this flow" }, 403);
    }

    const { data: decision, error } = await supabase.rpc("authorize_guard_request", {
      p_flow_id: flowId,
      p_request_id: body.request_id,
      p_max_cost_usd: body.max_cost_usd,
    }).single();
    if (error) return json({ error: error.code === "23505" ? "request_id already used with a different payload" : "Unable to authorize request" }, error.code === "23505" ? 409 : 500);
    return json(decision);
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }
});
