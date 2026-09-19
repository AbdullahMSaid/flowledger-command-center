import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import AppShell from "@/components/app/AppShell";
import OperationsDashboard, { type OperationsFlow } from "@/components/dashboard/OperationsDashboard";
import AddFlowModal from "@/components/dashboard/AddFlowModal";

type InventoryRow = Database["public"]["Functions"]["get_workspace_inventory"]["Returns"][number];
type Summary = { spend_usd?: number; run_count?: number; active_workflow_count?: number; open_incident_count?: number; over_budget_count?: number };

const startUtcDaysAgo = (days: number) => { const now = new Date(); return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days + 1)); };
const statusFor = (flow: Database["public"]["Tables"]["flows"]["Row"], inventory?: InventoryRow) => {
  if (flow.archived_at) return "Archived";
  if (flow.control_state === "emergency_stopped") return "Emergency stopped";
  if (!flow.flow_enabled || flow.control_state === "paused") return "Paused";
  if (!inventory?.last_run_at) return "No data";
  return "Live";
};

export default function Dashboard() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [flows, setFlows] = useState<OperationsFlow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [chartData, setChartData] = useState<{ label: string; cost: number }[]>([]);
  const [workspaceLabel, setWorkspaceLabel] = useState("My workspace");
  const [showAddFlow, setShowAddFlow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const fetchData = useCallback(async () => {
    if (!user) return;
    setError(null);
    const start = startUtcDaysAgo(7);
    const end = new Date();
    const membershipResponse = await supabase.from("workspace_members").select("workspace_id, workspaces(name)").eq("user_id", user.id).limit(1).maybeSingle();
    if (membershipResponse.error || !membershipResponse.data?.workspace_id) {
      setFlows([]); setSummary(null); setChartData([]); setLoading(false);
      setError(membershipResponse.error?.message ?? "No workspace membership is available for this account.");
      return;
    }
    const workspaceId = membershipResponse.data.workspace_id;
    const workspace = membershipResponse.data.workspaces as { name?: string } | null;
    if (workspace?.name) setWorkspaceLabel(workspace.name);
    const [flowsResponse, inventoryResponse, summaryResponse] = await Promise.all([
      supabase.from("flows").select("*").eq("workspace_id", workspaceId).is("archived_at", null).order("created_at", { ascending: false }),
      supabase.rpc("get_workspace_inventory", { p_workspace_id: workspaceId, p_period_start: start.toISOString(), p_period_end: end.toISOString(), p_limit: 200, p_offset: 0 }),
      supabase.rpc("get_workspace_summary", { p_workspace_id: workspaceId, p_period_start: start.toISOString(), p_period_end: end.toISOString() }),
    ]);
    if (flowsResponse.error || inventoryResponse.error || summaryResponse.error) {
      setFlows([]); setSummary(null); setChartData([]); setLoading(false);
      setError(flowsResponse.error?.message ?? inventoryResponse.error?.message ?? summaryResponse.error?.message ?? "Unknown workspace error");
      return;
    }
    const inventory = new Map((inventoryResponse.data ?? []).map(row => [row.flow_id, row as InventoryRow]));
    const sourceFlows = flowsResponse.data ?? [];
    setFlows(sourceFlows.map(flow => {
      const row = inventory.get(flow.id);
      return { id: flow.id, name: flow.name, owner: flow.accountable_owner_member_id ? "Assigned member" : "Unassigned", team: flow.team_label ?? undefined, platform: flow.platform, model: flow.model || "Unknown", status: statusFor(flow, row), spend: row ? Number(row.period_cost_usd) : null, budget: flow.budget_limit === null ? null : Number(flow.budget_limit), protection: flow.protection_mode === "guard_connected" ? "Guard connected" : "Monitor only", lastRun: row?.last_run_at ?? undefined };
    }));
    setSummary(summaryResponse.data as Summary);
    const flowIds = sourceFlows.map(flow => flow.id);
    if (flowIds.length === 0) setChartData([]);
    else {
      const runResponse = await supabase.from("runs").select("cost_usd, created_at, source").in("flow_id", flowIds).gte("created_at", start.toISOString()).not("source", "in", "(synthetic_demo,synthetic_seed)").order("created_at", { ascending: true });
      if (runResponse.error) setChartData([]);
      else {
        const days = Array.from({ length: 7 }, (_, index) => { const d = new Date(start); d.setUTCDate(d.getUTCDate() + index); return d; });
        setChartData(days.map(day => ({ label: new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(day), cost: (runResponse.data ?? []).filter(run => new Date(run.created_at).toISOString().slice(0, 10) === day.toISOString().slice(0, 10)).reduce((total, run) => total + Number(run.cost_usd), 0) })));
      }
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchRef.current = fetchData; }, [fetchData]);
  useEffect(() => { void fetchData(); }, [fetchData]);
  useEffect(() => { if (!user) return; const channel = supabase.channel("dashboard-runs").on("postgres_changes", { event: "INSERT", schema: "public", table: "runs" }, () => void fetchRef.current()).subscribe(); return () => { void supabase.removeChannel(channel); }; }, [user]);

  if (authLoading || loading) return <div className="min-h-screen bg-[#f7f8fa] p-8"><div className="mx-auto max-w-[1380px] animate-pulse space-y-5"><div className="h-10 rounded bg-slate-200"/><div className="h-28 rounded bg-white"/><div className="h-96 rounded bg-white"/></div></div>;
  const issues = summary ? Number(summary.open_incident_count ?? 0) + Number(summary.over_budget_count ?? 0) : flows.filter(flow => !["Live", "No data"].includes(flow.status)).length;
  return <AppShell userLabel={user?.email} workspaceLabel={workspaceLabel} onSignOut={signOut}><OperationsDashboard scopeLabel={workspaceLabel} periodLabel="Last 7 days" spend={summary?.spend_usd === undefined ? null : Number(summary.spend_usd)} activeFlows={Number(summary?.active_workflow_count ?? flows.length)} runCount={summary?.run_count === undefined ? null : Number(summary.run_count)} issueCount={issues} flows={flows} chartData={chartData} onAddFlow={() => setShowAddFlow(true)} onSelectFlow={id => navigate(`/flows/${id}`)} error={error}/>{showAddFlow ? <AddFlowModal onClose={() => setShowAddFlow(false)} onCreated={() => { setShowAddFlow(false); void fetchData(); }} /> : null}</AppShell>;
}
