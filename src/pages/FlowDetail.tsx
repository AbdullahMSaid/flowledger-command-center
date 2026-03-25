import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";

type Flow = {
  id: string;
  name: string;
  platform: string;
  model: string;
};

type Run = {
  id: string;
  status: string;
  duration_ms: number;
  token_count: number;
  cost_usd: number;
  error_message: string | null;
  created_at: string;
};

const statusStyles = {
  Live: "bg-[#E6FBF4] text-[#0A7A57]",
  Degraded: "bg-[#FFF8E6] text-[#8B6000]",
  Error: "bg-[#FFF0F0] text-[#A32D2D]",
};

function computeStatus(runs: { status: string }[]): "Live" | "Degraded" | "Error" {
  if (runs.length === 0) return "Live";
  if (runs[0].status === "error") return "Error";
  const errorRate = runs.filter((r) => r.status === "error").length / runs.length;
  if (errorRate > 0.2) return "Degraded";
  return "Live";
}

const FlowDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [flow, setFlow] = useState<Flow | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [status, setStatus] = useState<"Live" | "Degraded" | "Error">("Live");
  const [totalRuns, setTotalRuns] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  const [successRate, setSuccessRate] = useState(0);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const webhookUrl = `https://${projectId}.supabase.co/functions/v1/ingest/${id}`;

  const fetchData = useCallback(async () => {
    if (!id || !user) return;

    const { data: flowData } = await supabase
      .from("flows")
      .select("*")
      .eq("id", id)
      .single();

    if (!flowData) {
      navigate("/dashboard");
      return;
    }

    setFlow(flowData);

    // Last 10 for status
    const { data: last10 } = await supabase
      .from("runs")
      .select("status")
      .eq("flow_id", id)
      .order("created_at", { ascending: false })
      .limit(10);

    setStatus(computeStatus(last10 || []));

    // Last 20 for table
    const { data: recentRuns } = await supabase
      .from("runs")
      .select("*")
      .eq("flow_id", id)
      .order("created_at", { ascending: false })
      .limit(20);

    setRuns(recentRuns || []);

    // All-time stats
    const { data: allRuns } = await supabase
      .from("runs")
      .select("status, cost_usd")
      .eq("flow_id", id);

    const all = allRuns || [];
    setTotalRuns(all.length);
    setTotalCost(all.reduce((s, r) => s + Number(r.cost_usd), 0));
    setSuccessRate(
      all.length > 0
        ? Math.round((all.filter((r) => r.status === "success").length / all.length) * 100)
        : 0
    );

    setLoading(false);
  }, [id, user, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime
  useEffect(() => {
    if (!id || !user) return;
    const channel = supabase
      .channel(`runs-flow-${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "runs", filter: `flow_id=eq.${id}` },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, user, fetchData]);

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-ink2">Loading...</p>
      </div>
    );
  }

  if (!flow) return null;

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 flex items-center justify-between px-8 py-4 border-b border-border bg-background/95 backdrop-blur-sm">
        <button
          onClick={() => navigate("/dashboard")}
          className="font-display text-[22px] tracking-tight"
        >
          Flow<span className="text-primary">Ledger</span>
        </button>
        <button
          onClick={() => navigate("/dashboard")}
          className="text-sm text-ink2 hover:text-foreground transition-colors"
        >
          ← Back to dashboard
        </button>
      </nav>

      <div className="max-w-[1100px] mx-auto px-8 py-10">
        <div className="flex items-center gap-4 mb-2">
          <h1 className="font-display text-3xl tracking-tight">{flow.name}</h1>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusStyles[status]}`}>
            {status}
          </span>
        </div>
        <p className="text-sm text-ink3 mb-8">
          {flow.platform} · {flow.model}
        </p>

        {/* Webhook URL */}
        <div className="border border-border rounded-xl bg-card p-5 mb-8">
          <div className="text-xs text-ink3 uppercase tracking-wider mb-2">Webhook URL</div>
          <div className="flex items-center gap-3">
            <code className="flex-1 bg-muted rounded-lg px-4 py-2.5 text-sm text-foreground font-mono break-all">
              POST {webhookUrl}
            </code>
            <button
              onClick={copyWebhook}
              className="text-sm text-primary hover:underline whitespace-nowrap"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="border border-border rounded-xl px-5 py-4 bg-card">
            <div className="text-xs text-ink3 uppercase tracking-wider mb-1">Total Runs</div>
            <div className="text-2xl font-display">{totalRuns}</div>
          </div>
          <div className="border border-border rounded-xl px-5 py-4 bg-card">
            <div className="text-xs text-ink3 uppercase tracking-wider mb-1">Total Cost</div>
            <div className="text-2xl font-display">${totalCost.toFixed(2)}</div>
          </div>
          <div className="border border-border rounded-xl px-5 py-4 bg-card">
            <div className="text-xs text-ink3 uppercase tracking-wider mb-1">Success Rate</div>
            <div className="text-2xl font-display">{successRate}%</div>
          </div>
        </div>

        {/* Runs table */}
        <div className="border border-border rounded-xl bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-5 py-3 text-xs text-ink3 uppercase tracking-wider font-medium">Timestamp</th>
                <th className="px-5 py-3 text-xs text-ink3 uppercase tracking-wider font-medium">Status</th>
                <th className="px-5 py-3 text-xs text-ink3 uppercase tracking-wider font-medium text-right">Duration</th>
                <th className="px-5 py-3 text-xs text-ink3 uppercase tracking-wider font-medium text-right">Tokens</th>
                <th className="px-5 py-3 text-xs text-ink3 uppercase tracking-wider font-medium text-right">Cost</th>
                <th className="px-5 py-3 text-xs text-ink3 uppercase tracking-wider font-medium">Error</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-3.5 text-ink3">
                    {formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        run.status === "success"
                          ? "bg-[#E6FBF4] text-[#0A7A57]"
                          : "bg-[#FFF0F0] text-[#A32D2D]"
                      }`}
                    >
                      {run.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right text-ink2">{run.duration_ms}ms</td>
                  <td className="px-5 py-3.5 text-right text-ink2">{run.token_count}</td>
                  <td className="px-5 py-3.5 text-right text-ink2">${Number(run.cost_usd).toFixed(4)}</td>
                  <td className="px-5 py-3.5 text-ink3 max-w-[200px] truncate">
                    {run.error_message || "—"}
                  </td>
                </tr>
              ))}
              {runs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-ink3">
                    No runs yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FlowDetail;
