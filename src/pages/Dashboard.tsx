import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AddFlowModal from "@/components/dashboard/AddFlowModal";
import SetBudgetModal from "@/components/dashboard/SetBudgetModal";
import SimulateRunButton from "@/components/dashboard/SimulateRunButton";
import BulkSimulateButton from "@/components/dashboard/BulkSimulateButton";
import SpendChart from "@/components/dashboard/SpendChart";
import { formatDistanceToNow } from "date-fns";
import { Pause, Play, DollarSign, Bell, BarChart3, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import RenameFlowModal from "@/components/dashboard/RenameFlowModal";
import DeleteFlowModal from "@/components/dashboard/DeleteFlowModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type FlowWithStats = {
  id: string;
  name: string;
  platform: string;
  model: string;
  status: "Live" | "Degraded" | "Error" | "Paused";
  lastRun: string | null;
  runsToday: number;
  costToday: number;
  flow_enabled: boolean;
  budget_limit: number | null;
  monthlySpend: number;
};

function computeStatus(runs: { status: string }[], enabled: boolean): "Live" | "Degraded" | "Error" | "Paused" {
  if (!enabled) return "Paused";
  if (runs.length === 0) return "Live";
  if (runs[0].status === "error") return "Error";
  const errorRate = runs.filter((r) => r.status === "error").length / runs.length;
  if (errorRate > 0.2) return "Degraded";
  return "Live";
}

const statusStyles: Record<string, string> = {
  Live: "bg-[hsl(160,60%,95%)] text-[hsl(160,80%,28%)]",
  Degraded: "bg-[hsl(40,100%,93%)] text-[hsl(40,80%,30%)]",
  Error: "bg-[hsl(0,80%,95%)] text-[hsl(0,50%,40%)]",
  Paused: "bg-secondary text-muted-foreground",
};

const Dashboard = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [flows, setFlows] = useState<FlowWithStats[]>([]);
  const [runsToday, setRunsToday] = useState(0);
  const [spendToday, setSpendToday] = useState(0);
  const [showAddFlow, setShowAddFlow] = useState(false);
  const [budgetFlow, setBudgetFlow] = useState<FlowWithStats | null>(null);
  const [renameFlow, setRenameFlow] = useState<FlowWithStats | null>(null);
  const [deleteFlow, setDeleteFlow] = useState<FlowWithStats | null>(null);
  const [loading, setLoading] = useState(true);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const fetchData = useCallback(async () => {
    if (!user) return;

    const { data: flowsData } = await supabase
      .from("flows")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!flowsData) return;

    const enriched: FlowWithStats[] = await Promise.all(
      flowsData.map(async (flow) => {
        const { data: last10 } = await supabase
          .from("runs")
          .select("status, created_at")
          .eq("flow_id", flow.id)
          .order("created_at", { ascending: false })
          .limit(10);

        const { data: todayRuns } = await supabase
          .from("runs")
          .select("cost_usd, created_at")
          .eq("flow_id", flow.id)
          .gte("created_at", todayStart.toISOString());

        const { data: monthRuns } = await supabase
          .from("runs")
          .select("cost_usd")
          .eq("flow_id", flow.id)
          .gte("created_at", monthStart.toISOString());

        const status = computeStatus(last10 || [], flow.flow_enabled);
        const lastRunTime = last10?.[0]?.created_at || null;
        const monthlySpend = (monthRuns || []).reduce((sum, r) => sum + Number(r.cost_usd), 0);

        return {
          id: flow.id,
          name: flow.name,
          platform: flow.platform,
          model: flow.model,
          status,
          lastRun: lastRunTime,
          runsToday: todayRuns?.length || 0,
          costToday: todayRuns?.reduce((sum, r) => sum + Number(r.cost_usd), 0) || 0,
          flow_enabled: flow.flow_enabled,
          budget_limit: flow.budget_limit,
          monthlySpend,
        };
      })
    );

    setFlows(enriched);

    const { data: allTodayRuns } = await supabase
      .from("runs")
      .select("cost_usd, flow_id")
      .gte("created_at", todayStart.toISOString());

    const userFlowIds = new Set(flowsData.map((f) => f.id));
    const userTodayRuns = (allTodayRuns || []).filter((r) => userFlowIds.has(r.flow_id));

    setRunsToday(userTodayRuns.length);
    setSpendToday(userTodayRuns.reduce((sum, r) => sum + Number(r.cost_usd), 0));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("runs-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "runs" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchData]);

  const toggleFlowEnabled = async (flowId: string, currentEnabled: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("flows").update({ flow_enabled: !currentEnabled }).eq("id", flowId);
    fetchData();
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-4 sm:px-8 py-4 border-b border-border bg-background/95 backdrop-blur-sm">
        <Link to="/" className="font-display text-[22px] tracking-tight">
          Flow<span className="text-primary">Ledger</span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
          <Link to="/docs" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Docs</Link>
          <Link to="/setup" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Setup Guide</Link>
          <span className="text-sm text-muted-foreground hidden sm:inline">{user?.email}</span>
          <button onClick={signOut} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Sign out
          </button>
        </div>
      </nav>

      <div className="max-w-[1100px] mx-auto px-4 sm:px-8 py-6 sm:py-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <h1 className="font-display text-2xl sm:text-3xl tracking-tight">Dashboard</h1>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <button
              onClick={() => navigate("/analytics")}
              className="border border-border px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex items-center gap-2"
            >
              <BarChart3 size={15} />
              <span className="hidden sm:inline">Analytics</span>
            </button>
            <button
              onClick={() => navigate("/alerts")}
              className="border border-border px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex items-center gap-2"
            >
              <Bell size={15} />
              <span className="hidden sm:inline">Alerts</span>
            </button>
            <BulkSimulateButton flowIds={flows.filter((f) => f.flow_enabled).map((f) => f.id)} onSuccess={fetchData} />
            <button
              onClick={() => setShowAddFlow(true)}
              className="bg-primary text-primary-foreground px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg text-sm font-medium tracking-tight hover:opacity-90 transition-opacity"
            >
              Add flow
            </button>
          </div>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="border border-border rounded-xl px-5 py-4 bg-card">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Active Flows</div>
            <div className="text-2xl font-display">{flows.filter(f => f.flow_enabled).length}</div>
          </div>
          <div className="border border-border rounded-xl px-5 py-4 bg-card">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Runs Today</div>
            <div className="text-2xl font-display">{runsToday}</div>
          </div>
          <div className="border border-border rounded-xl px-5 py-4 bg-card">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Spend Today</div>
            <div className="text-2xl font-display">${spendToday.toFixed(2)}</div>
          </div>
        </div>

        {/* Flows - mobile cards / desktop table */}
        <div className="border border-border rounded-xl bg-card overflow-hidden mb-6 sm:mb-8">
          {/* Desktop table */}
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-5 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium w-8"></th>
                  <th className="px-5 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Name</th>
                  <th className="px-5 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Platform</th>
                  <th className="px-5 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Status</th>
                  <th className="px-5 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Budget</th>
                  <th className="px-5 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Last Run</th>
                  <th className="px-5 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium text-right">Runs Today</th>
                  <th className="px-5 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium text-right">Cost Today</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {flows.map((flow) => {
                  const budgetPct = flow.budget_limit ? Math.min((flow.monthlySpend / flow.budget_limit) * 100, 100) : null;
                  const budgetColor = budgetPct !== null
                    ? budgetPct >= 90 ? "bg-destructive" : budgetPct >= 70 ? "bg-[hsl(40,90%,50%)]" : "bg-accent"
                    : "";

                  return (
                    <tr
                      key={flow.id}
                      onClick={() => navigate(`/flows/${flow.id}`)}
                      className="border-b border-border last:border-0 cursor-pointer hover:bg-muted/30 transition-colors"
                    >
                      <td className="pl-5 py-3.5">
                        <button
                          onClick={(e) => toggleFlowEnabled(flow.id, flow.flow_enabled, e)}
                          title={flow.flow_enabled ? "Pause flow" : "Resume flow"}
                          className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                        >
                          {flow.flow_enabled ? <Pause size={14} /> : <Play size={14} />}
                        </button>
                      </td>
                      <td className="px-5 py-3.5 font-medium text-foreground">{flow.name}</td>
                      <td className="px-5 py-3.5 text-muted-foreground">{flow.platform}</td>
                      <td className="px-5 py-3.5">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusStyles[flow.status]}`}>
                          {flow.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {flow.budget_limit !== null ? (
                          <div className="flex flex-col gap-1 min-w-[100px]">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>${flow.monthlySpend.toFixed(2)}</span>
                              <span>${flow.budget_limit.toFixed(2)}</span>
                            </div>
                            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${budgetColor}`}
                                style={{ width: `${budgetPct}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); setBudgetFlow(flow); }}
                            className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                          >
                            <DollarSign size={12} />
                            Set budget
                          </button>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">
                        {flow.lastRun
                          ? formatDistanceToNow(new Date(flow.lastRun), { addSuffix: true })
                          : "Never"}
                      </td>
                      <td className="px-5 py-3.5 text-right text-muted-foreground">{flow.runsToday}</td>
                      <td className="px-5 py-3.5 text-right text-muted-foreground">${flow.costToday.toFixed(2)}</td>
                      <td className="px-5 py-3.5 text-right flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setBudgetFlow(flow); }}
                          title="Set budget"
                          className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                        >
                          <DollarSign size={14} />
                        </button>
                        <SimulateRunButton flowId={flow.id} onSuccess={fetchData} />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              onClick={(e) => e.stopPropagation()}
                              className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                              title="More options"
                            >
                              <MoreHorizontal size={14} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-36">
                            <DropdownMenuItem
                              onClick={(e) => { e.stopPropagation(); setRenameFlow(flow); }}
                              className="flex items-center gap-2 cursor-pointer"
                            >
                              <Pencil size={13} />
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => { e.stopPropagation(); setDeleteFlow(flow); }}
                              className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
                            >
                              <Trash2 size={13} />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
                {flows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-5 py-8 text-center text-muted-foreground">
                      No flows yet. Click "Add flow" to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden divide-y divide-border">
            {flows.map((flow) => {
              const budgetPct = flow.budget_limit ? Math.min((flow.monthlySpend / flow.budget_limit) * 100, 100) : null;
              const budgetColor = budgetPct !== null
                ? budgetPct >= 90 ? "bg-destructive" : budgetPct >= 70 ? "bg-[hsl(40,90%,50%)]" : "bg-accent"
                : "";

              return (
                <div
                  key={flow.id}
                  onClick={() => navigate(`/flows/${flow.id}`)}
                  className="p-4 cursor-pointer active:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => toggleFlowEnabled(flow.id, flow.flow_enabled, e)}
                        className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground"
                      >
                        {flow.flow_enabled ? <Pause size={14} /> : <Play size={14} />}
                      </button>
                      <span className="font-medium text-foreground text-sm">{flow.name}</span>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusStyles[flow.status]}`}>
                      {flow.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                    <span>{flow.platform}</span>
                    <span>·</span>
                    <span>{flow.lastRun ? formatDistanceToNow(new Date(flow.lastRun), { addSuffix: true }) : "Never"}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-4">
                      <span className="text-muted-foreground">{flow.runsToday} runs</span>
                      <span className="text-foreground font-medium">${flow.costToday.toFixed(2)} today</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); setBudgetFlow(flow); }}
                        className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground"
                      >
                        <DollarSign size={14} />
                      </button>
                      <SimulateRunButton flowId={flow.id} onSuccess={fetchData} />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground"
                          >
                            <MoreHorizontal size={14} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36">
                          <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); setRenameFlow(flow); }}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <Pencil size={13} />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); setDeleteFlow(flow); }}
                            className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
                          >
                            <Trash2 size={13} />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  {flow.budget_limit !== null && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>${flow.monthlySpend.toFixed(2)}</span>
                        <span>${flow.budget_limit.toFixed(2)}</span>
                      </div>
                      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${budgetColor}`}
                          style={{ width: `${budgetPct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {flows.length === 0 && (
              <div className="p-6 text-center text-muted-foreground text-sm">
                No flows yet. Click "Add flow" to get started.
              </div>
            )}
          </div>
        </div>

        {/* Spend chart */}
        <SpendChart />
      </div>

      {showAddFlow && (
        <AddFlowModal
          onClose={() => setShowAddFlow(false)}
          onCreated={() => { setShowAddFlow(false); fetchData(); }}
        />
      )}

      {budgetFlow && (
        <SetBudgetModal
          flowId={budgetFlow.id}
          flowName={budgetFlow.name}
          currentBudget={budgetFlow.budget_limit}
          onClose={() => setBudgetFlow(null)}
          onSaved={() => { setBudgetFlow(null); fetchData(); }}
        />
      )}

      {renameFlow && (
        <RenameFlowModal
          flowId={renameFlow.id}
          currentName={renameFlow.name}
          onClose={() => setRenameFlow(null)}
          onSaved={() => { setRenameFlow(null); fetchData(); }}
        />
      )}

      {deleteFlow && (
        <DeleteFlowModal
          flowId={deleteFlow.id}
          flowName={deleteFlow.name}
          onClose={() => setDeleteFlow(null)}
          onDeleted={() => { setDeleteFlow(null); fetchData(); }}
        />
      )}
    </div>
  );
};

export default Dashboard;
