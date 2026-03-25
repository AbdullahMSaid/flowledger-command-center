import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AddFlowModal from "@/components/dashboard/AddFlowModal";
import SimulateRunButton from "@/components/dashboard/SimulateRunButton";
import SpendChart from "@/components/dashboard/SpendChart";
import { formatDistanceToNow } from "date-fns";

type FlowWithStats = {
  id: string;
  name: string;
  platform: string;
  model: string;
  status: "Live" | "Degraded" | "Error";
  lastRun: string | null;
  runsToday: number;
  costToday: number;
};

function computeStatus(runs: { status: string }[]): "Live" | "Degraded" | "Error" {
  if (runs.length === 0) return "Live";
  if (runs[0].status === "error") return "Error";
  const errorRate = runs.filter((r) => r.status === "error").length / runs.length;
  if (errorRate > 0.2) return "Degraded";
  return "Live";
}

const statusStyles = {
  Live: "bg-[#E6FBF4] text-[#0A7A57]",
  Degraded: "bg-[#FFF8E6] text-[#8B6000]",
  Error: "bg-[#FFF0F0] text-[#A32D2D]",
};

const Dashboard = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [flows, setFlows] = useState<FlowWithStats[]>([]);
  const [runsToday, setRunsToday] = useState(0);
  const [spendToday, setSpendToday] = useState(0);
  const [showAddFlow, setShowAddFlow] = useState(false);
  const [loading, setLoading] = useState(true);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const fetchData = useCallback(async () => {
    if (!user) return;

    // Fetch flows
    const { data: flowsData } = await supabase
      .from("flows")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!flowsData) return;

    // For each flow, fetch last 10 runs and today's stats
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

        const status = computeStatus(last10 || []);
        const lastRunTime = last10?.[0]?.created_at || null;

        return {
          id: flow.id,
          name: flow.name,
          platform: flow.platform,
          model: flow.model,
          status,
          lastRun: lastRunTime,
          runsToday: todayRuns?.length || 0,
          costToday: todayRuns?.reduce((sum, r) => sum + Number(r.cost_usd), 0) || 0,
        };
      })
    );

    setFlows(enriched);

    // Aggregate today's metrics
    const { data: allTodayRuns } = await supabase
      .from("runs")
      .select("cost_usd, flow_id")
      .gte("created_at", todayStart.toISOString());

    // Filter to only user's flows
    const userFlowIds = new Set(flowsData.map((f) => f.id));
    const userTodayRuns = (allTodayRuns || []).filter((r) => userFlowIds.has(r.flow_id));

    setRunsToday(userTodayRuns.length);
    setSpendToday(userTodayRuns.reduce((sum, r) => sum + Number(r.cost_usd), 0));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("runs-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "runs" },
        () => {
          // Re-fetch all data on any new run
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchData]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-ink2">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-8 py-4 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="font-display text-[22px] tracking-tight">
          Flow<span className="text-primary">Ledger</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-ink3">{user?.email}</span>
          <button
            onClick={signOut}
            className="text-sm text-ink2 hover:text-foreground transition-colors"
          >
            Sign out
          </button>
        </div>
      </nav>

      <div className="max-w-[1100px] mx-auto px-8 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-display text-3xl tracking-tight">Dashboard</h1>
          <button
            onClick={() => setShowAddFlow(true)}
            className="bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-medium tracking-tight hover:opacity-90 transition-opacity"
          >
            Add flow
          </button>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="border border-border rounded-xl px-5 py-4 bg-card">
            <div className="text-xs text-ink3 uppercase tracking-wider mb-1">Active Flows</div>
            <div className="text-2xl font-display">{flows.length}</div>
          </div>
          <div className="border border-border rounded-xl px-5 py-4 bg-card">
            <div className="text-xs text-ink3 uppercase tracking-wider mb-1">Runs Today</div>
            <div className="text-2xl font-display">{runsToday}</div>
          </div>
          <div className="border border-border rounded-xl px-5 py-4 bg-card">
            <div className="text-xs text-ink3 uppercase tracking-wider mb-1">Spend Today</div>
            <div className="text-2xl font-display">${spendToday.toFixed(2)}</div>
          </div>
        </div>

        {/* Flows table */}
        <div className="border border-border rounded-xl bg-card overflow-hidden mb-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-5 py-3 text-xs text-ink3 uppercase tracking-wider font-medium">Name</th>
                <th className="px-5 py-3 text-xs text-ink3 uppercase tracking-wider font-medium">Platform</th>
                <th className="px-5 py-3 text-xs text-ink3 uppercase tracking-wider font-medium">Model</th>
                <th className="px-5 py-3 text-xs text-ink3 uppercase tracking-wider font-medium">Status</th>
                <th className="px-5 py-3 text-xs text-ink3 uppercase tracking-wider font-medium">Last Run</th>
                <th className="px-5 py-3 text-xs text-ink3 uppercase tracking-wider font-medium text-right">Runs Today</th>
                <th className="px-5 py-3 text-xs text-ink3 uppercase tracking-wider font-medium text-right">Cost Today</th>
              </tr>
            </thead>
            <tbody>
              {flows.map((flow) => (
                <tr
                  key={flow.id}
                  onClick={() => navigate(`/flows/${flow.id}`)}
                  className="border-b border-border last:border-0 cursor-pointer hover:bg-muted/30 transition-colors"
                >
                  <td className="px-5 py-3.5 font-medium text-foreground">{flow.name}</td>
                  <td className="px-5 py-3.5 text-ink2">{flow.platform}</td>
                  <td className="px-5 py-3.5 text-ink2">{flow.model}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusStyles[flow.status]}`}>
                      {flow.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-ink3">
                    {flow.lastRun
                      ? formatDistanceToNow(new Date(flow.lastRun), { addSuffix: true })
                      : "Never"}
                  </td>
                  <td className="px-5 py-3.5 text-right text-ink2">{flow.runsToday}</td>
                  <td className="px-5 py-3.5 text-right text-ink2">${flow.costToday.toFixed(2)}</td>
                </tr>
              ))}
              {flows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-ink3">
                    No flows yet. Click "Add flow" to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Spend chart */}
        <SpendChart />
      </div>

      {showAddFlow && (
        <AddFlowModal
          onClose={() => setShowAddFlow(false)}
          onCreated={() => {
            setShowAddFlow(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
};

export default Dashboard;
