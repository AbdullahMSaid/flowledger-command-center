import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateFlowRequest, corsHeaders, json } from "../_shared/auth.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const body = await req.json();
    if (!UUID_RE.test(body.reservation_id) || !["success", "error"].includes(body.status) ||
        !Number.isInteger(body.duration_ms) || body.duration_ms < 0 ||
        !Number.isInteger(body.token_count) || body.token_count < 0 ||
        typeof body.actual_cost_usd !== "number" || !Number.isFinite(body.actual_cost_usd) || body.actual_cost_usd < 0) {
      return json({ error: "Invalid settlement payload" }, 400);
    }
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: reservation } = await supabase.from("guard_reservations").select("id, flow_id").eq("id", body.reservation_id).single();
    if (!reservation) return json({ error: "Reservation not found" }, 404);
    const { userId, isFlowCredential, error: authError } = await authenticateFlowRequest(req, reservation.flow_id);
    if (!userId) return json({ error: authError || "Unauthorized" }, 401);
    const { data: flow } = await supabase.from("flows").select("user_id, workspace_id").eq("id", reservation.flow_id).single();
    if (!flow) return json({ error: "You do not have access to this reservation" }, 403);
    if (flow.user_id !== userId && !isFlowCredential) {
      const { data: membership } = await supabase.from("workspace_members").select("role").eq("workspace_id", flow.workspace_id).eq("user_id", userId).maybeSingle();
      if (membership?.role !== "admin") return json({ error: "You do not have access to this reservation" }, 403);
    } else if (flow.user_id !== userId) {
      return json({ error: "You do not have access to this reservation" }, 403);
    }

    const { data: result, error } = await supabase.rpc("settle_guard_request", {
      p_reservation_id: body.reservation_id,
      p_status: body.status,
      p_duration_ms: body.duration_ms,
      p_token_count: body.token_count,
      p_actual_cost_usd: body.actual_cost_usd,
      p_error_message: body.error_message ?? null,
    }).single();
    if (error) return json({ error: error.code === "23505" ? "reservation already settled with a different payload" : "Unable to settle request" }, error.code === "23505" ? 409 : 500);
    return json(result);
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }
});
