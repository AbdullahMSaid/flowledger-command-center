#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const adminEmail = process.env.FLOWLEDGER_ADMIN_EMAIL;
const adminPassword = process.env.FLOWLEDGER_ADMIN_PASSWORD;
const memberEmail = process.env.FLOWLEDGER_MEMBER_EMAIL;
const memberPassword = process.env.FLOWLEDGER_MEMBER_PASSWORD;
const outsiderEmail = process.env.FLOWLEDGER_OUTSIDER_EMAIL;
const outsiderPassword = process.env.FLOWLEDGER_OUTSIDER_PASSWORD;

if (!url || !anonKey || !adminEmail || !adminPassword || !memberEmail || !memberPassword) {
  console.error("Set Supabase URL/anon key plus FLOWLEDGER_ADMIN_* and FLOWLEDGER_MEMBER_* credentials.");
  process.exit(1);
}

const createSessionClient = async (email, password) => {
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw error || new Error(`Unable to sign in ${email}`);
  return { client, user: data.user };
};

const adminSession = await createSessionClient(adminEmail, adminPassword);
const memberSession = await createSessionClient(memberEmail, memberPassword);

const { data: adminMembership, error: membershipError } = await adminSession.client
  .from("workspace_members")
  .select("workspace_id, role")
  .eq("user_id", adminSession.user.id)
  .limit(1)
  .single();
if (membershipError || !adminMembership) throw membershipError || new Error("Admin workspace membership missing");
if (adminMembership.role !== "admin") throw new Error("Provisioned admin user is not an admin");

const { data: flows, error: flowsError } = await adminSession.client
  .from("flows")
  .select("id, workspace_id")
  .eq("workspace_id", adminMembership.workspace_id);
if (flowsError) throw flowsError;

const periodStart = new Date();
periodStart.setUTCDate(1);
periodStart.setUTCHours(0, 0, 0, 0);
const periodEnd = new Date();

const { error: adminSummaryError } = await adminSession.client.rpc("get_workspace_summary", {
  p_workspace_id: adminMembership.workspace_id,
  p_period_start: periodStart.toISOString(),
  p_period_end: periodEnd.toISOString(),
});
if (adminSummaryError) throw new Error(`Admin summary failed: ${adminSummaryError.message}`);

const { data: memberFlows, error: memberFlowsError } = await memberSession.client
  .from("flows")
  .select("id, workspace_id")
  .eq("workspace_id", adminMembership.workspace_id);
if (memberFlowsError) throw memberFlowsError;
if ((memberFlows ?? []).length !== (flows ?? []).length) throw new Error("Workspace member could not read the shared workspace inventory");

if (flows?.[0]) {
  const { error: memberPolicyError } = await memberSession.client.rpc("set_flow_policy", {
    p_flow_id: flows[0].id,
    p_budget_limit: null,
    p_daily_budget_limit: null,
    p_protection_mode: "Monitor only",
    p_reason: "permission smoke test",
  });
  if (!memberPolicyError) throw new Error("Member unexpectedly changed an admin-only policy");
}

const result = {
  workspaceId: adminMembership.workspace_id,
  adminCanAggregate: true,
  adminFlowCount: flows?.length ?? 0,
  memberCanReadSharedInventory: true,
  memberPolicyMutationDenied: true,
  outsiderIsolation: "skipped",
};

if (outsiderEmail && outsiderPassword) {
  const outsider = await createSessionClient(outsiderEmail, outsiderPassword);
  const { data: outsiderFlows, error: outsiderError } = await outsider.client
    .from("flows")
    .select("id")
    .eq("workspace_id", adminMembership.workspace_id);
  if (outsiderError) throw outsiderError;
  if ((outsiderFlows ?? []).length !== 0) throw new Error("Unrelated workspace could read another workspace's flows");
  result.outsiderIsolation = "passed";
}

console.log(JSON.stringify(result, null, 2));
