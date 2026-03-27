import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const flowId = pathParts[pathParts.length - 1];

    if (!flowId) {
      return new Response(JSON.stringify({ error: "Missing flowId in path" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { status, duration_ms, token_count, cost_usd, error_message } = body;

    if (!status || !["success", "error"].includes(status)) {
      return new Response(JSON.stringify({ error: "Invalid status. Must be 'success' or 'error'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof duration_ms !== "number" || typeof token_count !== "number" || typeof cost_usd !== "number") {
      return new Response(JSON.stringify({ error: "duration_ms, token_count, and cost_usd must be numbers" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch the flow with enabled, budget, and owner info
    const { data: flow, error: flowError } = await supabase
      .from("flows")
      .select("id, flow_enabled, budget_limit, user_id, name")
      .eq("id", flowId)
      .single();

    if (flowError || !flow) {
      return new Response(JSON.stringify({ error: "Flow not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if flow is paused
    if (!flow.flow_enabled) {
      return new Response(JSON.stringify({ ok: false, reason: "paused" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check budget limit
    if (flow.budget_limit !== null) {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const { data: monthRuns } = await supabase
        .from("runs")
        .select("cost_usd")
        .eq("flow_id", flowId)
        .gte("created_at", monthStart.toISOString());

      const monthlySpend = (monthRuns || []).reduce((sum: number, r: { cost_usd: number }) => sum + Number(r.cost_usd), 0);

      if (monthlySpend + cost_usd > flow.budget_limit) {
        // Auto-pause the flow
        await supabase
          .from("flows")
          .update({ flow_enabled: false })
          .eq("id", flowId);

        return new Response(JSON.stringify({ ok: false, reason: "budget_exceeded" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Insert the run
    const { data: run, error: insertError } = await supabase
      .from("runs")
      .insert({
        flow_id: flowId,
        status,
        duration_ms,
        token_count,
        cost_usd,
        error_message: error_message || null,
      })
      .select("id")
      .single();

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, run_id: run.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
