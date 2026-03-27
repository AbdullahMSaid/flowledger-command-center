import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Flow = { id: string; name: string };

type Props = {
  flows: Flow[];
  userId: string;
  onClose: () => void;
  onCreated: () => void;
};

const conditionTypes = [
  { value: "error_rate", label: "Error rate (%)" },
  { value: "spend_limit", label: "Spend limit (USD)" },
  { value: "budget_exceeded", label: "Budget exceeded" },
  { value: "token_spike", label: "Token spike (count)" },
];

const CreateAlertRuleModal = ({ flows, userId, onClose, onCreated }: Props) => {
  const [name, setName] = useState("");
  const [conditionType, setConditionType] = useState("error_rate");
  const [threshold, setThreshold] = useState("");
  const [scope, setScope] = useState("all");
  const [flowId, setFlowId] = useState("");
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [slackUrl, setSlackUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) { setError("Rule name is required."); return; }
    const thresholdVal = parseFloat(threshold);
    if (isNaN(thresholdVal) || thresholdVal <= 0) { setError("Enter a valid positive threshold."); return; }
    if (scope === "specific" && !flowId) { setError("Select a flow."); return; }

    setLoading(true);
    const { error: insertError } = await supabase.from("alert_rules").insert({
      user_id: userId,
      name: name.trim(),
      condition_type: conditionType,
      threshold: thresholdVal,
      scope,
      flow_id: scope === "specific" ? flowId : null,
      notify_email: notifyEmail,
      slack_webhook_url: slackUrl.trim() || null,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
    } else {
      onCreated();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-[440px] shadow-lg" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-xl tracking-tight mb-5">Create alert rule</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Rule name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-border rounded-lg px-4 py-2.5 text-sm bg-card text-foreground focus:outline-none focus:border-primary"
              placeholder="e.g. High error rate alert"
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Condition type</label>
            <select
              value={conditionType}
              onChange={(e) => setConditionType(e.target.value)}
              className="w-full border border-border rounded-lg px-4 py-2.5 text-sm bg-card text-foreground focus:outline-none focus:border-primary"
            >
              {conditionTypes.map((ct) => (
                <option key={ct.value} value={ct.value}>{ct.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Threshold value</label>
            <input
              type="number"
              step="any"
              min="0"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="w-full border border-border rounded-lg px-4 py-2.5 text-sm bg-card text-foreground focus:outline-none focus:border-primary"
              placeholder={conditionType === "error_rate" ? "e.g. 25" : conditionType === "spend_limit" ? "e.g. 10.00" : "e.g. 5000"}
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Scope</label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="w-full border border-border rounded-lg px-4 py-2.5 text-sm bg-card text-foreground focus:outline-none focus:border-primary"
            >
              <option value="all">All flows</option>
              <option value="specific">Specific flow</option>
            </select>
          </div>

          {scope === "specific" && (
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Select flow</label>
              <select
                value={flowId}
                onChange={(e) => setFlowId(e.target.value)}
                className="w-full border border-border rounded-lg px-4 py-2.5 text-sm bg-card text-foreground focus:outline-none focus:border-primary"
              >
                <option value="">Choose a flow...</option>
                {flows.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="border-t border-border pt-4">
            <p className="text-sm font-medium text-foreground mb-3">Notify via</p>
            <label className="flex items-center gap-2.5 mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-sm text-foreground">Email</span>
            </label>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Slack webhook URL (optional)</label>
              <input
                value={slackUrl}
                onChange={(e) => setSlackUrl(e.target.value)}
                className="w-full border border-border rounded-lg px-4 py-2.5 text-sm bg-card text-foreground focus:outline-none focus:border-primary"
                placeholder="https://hooks.slack.com/services/..."
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex items-center gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-border py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-medium tracking-tight hover:opacity-90 transition-opacity disabled:opacity-50">
              {loading ? "Creating..." : "Create rule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateAlertRuleModal;
