import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateFlowRequest, corsHeaders, json } from "../_shared/auth.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SOURCES = ["live", "monitor", "guarded"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const flowId = pathParts[pathParts.length - 1];
    if (!flowId || !UUID_RE.test(flowId)) return json({ error: "Invalid flowId" }, 400);
    const { userId, isFlowCredential, error: authError } = await authenticateFlowRequest(req, flowId);
    if (!userId) return json({ error: authError || "Unauthorized" }, 401);

    const body = await req.json();
    const { event_id, status, duration_ms, token_count, cost_usd, error_message, source = "live" } = body;
    if (typeof event_id !== "string" || event_id.length < 1 || event_id.length > 160) {
      return json({ error: "event_id is required and must be 1–160 characters" }, 400);
    }
    if (!(typeof status === "string" && ["success", "error"].includes(status))) {
      return json({ error: "Invalid status. Must be 'success' or 'error'" }, 400);
    }
    if (!Number.isInteger(duration_ms) || duration_ms < 0 || !Number.isInteger(token_count) || token_count < 0 ||
        typeof cost_usd !== "number" || !Number.isFinite(cost_usd) || cost_usd < 0) {
      return json({ error: "duration_ms and token_count must be nonnegative integers; cost_usd must be finite and nonnegative" }, 400);
    }
    if (error_message !== undefined && error_message !== null && (typeof error_message !== "string" || error_message.length > 2000)) {
      return json({ error: "error_message must be at most 2000 characters" }, 400);
    }
    if (typeof source !== "string" || !SOURCES.includes(source)) return json({ error: "Invalid telemetry source" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: flow, error: flowError } = await supabase
      .from("flows")
      .select("id, user_id, workspace_id")
      .eq("id", flowId)
      .single();
    if (flowError || !flow) return json({ error: "Flow not found" }, 404);
    if (flow.user_id !== userId && !isFlowCredential) {
      const { data: membership } = await supabase.from("workspace_members").select("role").eq("workspace_id", flow.workspace_id).eq("user_id", userId).maybeSingle();
      if (membership?.role !== "admin") return json({ error: "You do not have access to this flow" }, 403);
    } else if (flow.user_id !== userId) {
      return json({ error: "You do not have access to this flow" }, 403);
    }

    const { data: result, error: recordError } = await supabase.rpc("record_ingest_run", {
      p_flow_id: flowId,
      p_event_id: event_id,
      p_status: status,
      p_duration_ms: duration_ms,
      p_token_count: token_count,
      p_cost_usd: cost_usd,
      p_error_message: error_message ?? null,
      p_source: source,
    }).single();

    if (recordError) {
      const statusCode = recordError.code === "22023" ? 400 : recordError.code === "P0002" ? 404 : recordError.code === "23505" ? 409 : 500;
      return json({ error: statusCode === 500 ? "Unable to record telemetry" : recordError.message }, statusCode);
    }

    return json({
      recorded: result.recorded,
      run_id: result.run_id,
      duplicate: result.duplicate,
      control: { allow_next: result.control_allow_next, reason: result.control_reason },
    });
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }
});
