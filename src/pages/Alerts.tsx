import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import CreateAlertRuleModal from "@/components/alerts/CreateAlertRuleModal";
import { formatDistanceToNow } from "date-fns";
import { Bell, BellOff, Plus, ArrowLeft } from "lucide-react";

type AlertRule = {
  id: string;
  name: string;
  condition_type: string;
  threshold: number;
  scope: string;
  flow_id: string | null;
  notify_email: boolean;
  slack_webhook_url: string | null;
  enabled: boolean;
  created_at: string;
  flow_name?: string;
};

type AlertEvent = {
  id: string;
  rule_name: string;
  condition_type: string;
  flow_id: string | null;
  flow_name: string | null;
  status: string;
  created_at: string;
};

const conditionLabels: Record<string, string> = {
  error_rate: "Error rate",
  spend_limit: "Spend limit",
  budget_exceeded: "Budget exceeded",
  token_spike: "Token spike",
};

const statusStyles: Record<string, string> = {
  triggered: "bg-[hsl(0,80%,95%)] text-[hsl(0,50%,40%)]",
  resolved: "bg-[hsl(160,60%,95%)] text-[hsl(160,80%,28%)]",
  acknowledged: "bg-[hsl(40,100%,93%)] text-[hsl(40,80%,30%)]",
};

const Alerts = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [history, setHistory] = useState<AlertEvent[]>([]);
  const [flows, setFlows] = useState<{ id: string; name: string }[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) return;

    const [{ data: rulesData }, { data: historyData }, { data: flowsData }] = await Promise.all([
      supabase.from("alert_rules").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("alert_history").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("flows").select("id, name").eq("user_id", user.id),
    ]);

    const flowMap = new Map((flowsData || []).map((f) => [f.id, f.name]));
    setFlows(flowsData || []);

    setRules(
      (rulesData || []).map((r) => ({
        ...r,
        flow_name: r.flow_id ? flowMap.get(r.flow_id) || "Unknown" : undefined,
      }))
    );

    setHistory(
      (historyData || []).map((h) => ({
        ...h,
        flow_name: h.flow_name || (h.flow_id ? flowMap.get(h.flow_id) || "Unknown" : null),
      }))
    );

    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("alert-history-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "alert_history" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchData]);

  const toggleRule = async (ruleId: string, currentEnabled: boolean) => {
    await supabase.from("alert_rules").update({ enabled: !currentEnabled }).eq("id", ruleId);
    fetchData();
  };

  const deleteRule = async (ruleId: string) => {
    await supabase.from("alert_rules").delete().eq("id", ruleId);
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
      <nav className="sticky top-0 z-50 flex items-center justify-between px-8 py-4 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="font-display text-[22px] tracking-tight">
          Flow<span className="text-primary">Ledger</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{user?.email}</span>
          <button onClick={signOut} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Sign out
          </button>
        </div>
      </nav>

      <div className="max-w-[1100px] mx-auto px-8 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/dashboard")}
              className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft size={18} />
            </button>
            <h1 className="font-display text-3xl tracking-tight">Alerts</h1>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-medium tracking-tight hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <Plus size={16} />
            Create alert rule
          </button>
        </div>

        {/* Active Alert Rules */}
        <section className="mb-10">
          <h2 className="font-display text-xl tracking-tight mb-4">Active Alert Rules</h2>
          <div className="border border-border rounded-xl bg-card overflow-hidden">
            {rules.length === 0 ? (
              <div className="px-5 py-8 text-center text-muted-foreground text-sm">
                No alert rules yet. Click "Create alert rule" to get started.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {rules.map((rule) => (
                  <div key={rule.id} className="flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-medium text-foreground text-sm">{rule.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                          {conditionLabels[rule.condition_type] || rule.condition_type}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>Threshold: {rule.threshold}</span>
                        <span>·</span>
                        <span>{rule.scope === "all" ? "All flows" : rule.flow_name}</span>
                        <span>·</span>
                        <span>
                          {[rule.notify_email && "Email", rule.slack_webhook_url && "Slack"].filter(Boolean).join(", ") || "No notifications"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => toggleRule(rule.id, rule.enabled)}
                        title={rule.enabled ? "Disable rule" : "Enable rule"}
                        className={`p-2 rounded-lg transition-colors ${
                          rule.enabled
                            ? "text-accent hover:bg-accent/10"
                            : "text-muted-foreground hover:bg-secondary"
                        }`}
                      >
                        {rule.enabled ? <Bell size={16} /> : <BellOff size={16} />}
                      </button>
                      <button
                        onClick={() => deleteRule(rule.id)}
                        className="text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Alert History */}
        <section>
          <h2 className="font-display text-xl tracking-tight mb-4">Alert History</h2>
          <div className="border border-border rounded-xl bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-5 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Timestamp</th>
                  <th className="px-5 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Rule</th>
                  <th className="px-5 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Condition</th>
                  <th className="px-5 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Flow</th>
                  <th className="px-5 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                      No alerts triggered yet.
                    </td>
                  </tr>
                ) : (
                  history.map((event) => (
                    <tr key={event.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3.5 text-muted-foreground">
                        {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-foreground">{event.rule_name}</td>
                      <td className="px-5 py-3.5 text-muted-foreground">
                        {conditionLabels[event.condition_type] || event.condition_type}
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">{event.flow_name || "—"}</td>
                      <td className="px-5 py-3.5">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusStyles[event.status] || "bg-secondary text-muted-foreground"}`}>
                          {event.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {showCreate && (
        <CreateAlertRuleModal
          flows={flows}
          userId={user!.id}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchData(); }}
        />
      )}
    </div>
  );
};

export default Alerts;
