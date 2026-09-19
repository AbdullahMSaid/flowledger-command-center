#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = process.env.FLOWLEDGER_ADMIN_EMAIL;
const adminPassword = process.env.FLOWLEDGER_ADMIN_PASSWORD;
const memberEmail = process.env.FLOWLEDGER_MEMBER_EMAIL;
const memberPassword = process.env.FLOWLEDGER_MEMBER_PASSWORD;

if (!supabaseUrl || !serviceRoleKey || !adminEmail || !adminPassword || !memberEmail || !memberPassword) {
  console.error("Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FLOWLEDGER_ADMIN_EMAIL, FLOWLEDGER_ADMIN_PASSWORD, FLOWLEDGER_MEMBER_EMAIL, and FLOWLEDGER_MEMBER_PASSWORD.");
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

async function findOrCreateUser(email, password) {
  const { data: users, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw listError;
  const existing = users.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
  if (existing) return existing;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error || new Error(`Unable to create ${email}`);
  return data.user;
}

const owner = await findOrCreateUser(adminEmail, adminPassword);
const member = await findOrCreateUser(memberEmail, memberPassword);

const { data: workspace, error: workspaceError } = await admin
  .from("workspaces")
  .select("id, name")
  .eq("owner_user_id", owner.id)
  .single();
if (workspaceError || !workspace) throw workspaceError || new Error("Owner workspace was not provisioned");

const { error: membershipError } = await admin.from("workspace_members").upsert({
  workspace_id: workspace.id,
  user_id: member.id,
  role: "member",
}, { onConflict: "workspace_id,user_id" });
if (membershipError) throw membershipError;

console.log(JSON.stringify({ workspaceId: workspace.id, adminEmail, memberEmail, message: "Workspace users provisioned without printing passwords." }, null, 2));
