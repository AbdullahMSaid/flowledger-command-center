import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type SetBudgetModalProps = {
  flowId: string;
  flowName: string;
  currentBudget: number | null;
  currentDailyBudget: number | null;
  currentProtectionMode: string;
  onClose: () => void;
  onSaved: () => void;
};

const SetBudgetModal = ({ flowId, flowName, currentBudget, currentDailyBudget, currentProtectionMode, onClose, onSaved }: SetBudgetModalProps) => {
  const [budget, setBudget] = useState(currentBudget !== null ? String(currentBudget) : "");
  const [dailyBudget, setDailyBudget] = useState(currentDailyBudget !== null ? String(currentDailyBudget) : "");
  const [protectionMode, setProtectionMode] = useState(currentProtectionMode || "Monitor only");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const removeBudget = async () => {
    setLoading(true);
    const { error: updateError } = await supabase.rpc("set_flow_policy", {
      p_flow_id: flowId,
      p_budget_limit: null,
      p_daily_budget_limit: null,
      p_protection_mode: protectionMode,
      p_reason: "Removed budget policy from operations dashboard",
    });
    if (updateError) { setError(updateError.message); setLoading(false); }
    else onSaved();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const budgetValue = budget.trim() === "" ? null : parseFloat(budget);
    const dailyBudgetValue = dailyBudget.trim() === "" ? null : parseFloat(dailyBudget);

    if ((budgetValue !== null && (isNaN(budgetValue) || budgetValue < 0)) || (dailyBudgetValue !== null && (isNaN(dailyBudgetValue) || dailyBudgetValue < 0))) {
      setError("Enter valid nonnegative numbers or leave empty to remove.");
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase.rpc("set_flow_policy", {
      p_flow_id: flowId,
      p_budget_limit: budgetValue,
      p_daily_budget_limit: dailyBudgetValue,
      p_protection_mode: protectionMode,
      p_reason: "Updated budget policy from operations dashboard",
    });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
    } else {
      onSaved();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-xl p-6 w-full max-w-[380px] shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-xl tracking-tight mb-1">Set monthly budget</h2>
        <p className="text-sm text-muted-foreground mb-5 truncate">{flowName}</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Budget (USD / month)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="w-full border border-border rounded-lg px-4 py-3 text-sm bg-card text-foreground focus:outline-none focus:border-primary"
              placeholder="e.g. 5.00 — leave empty to remove"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Daily limit (USD / UTC day)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={dailyBudget}
              onChange={(e) => setDailyBudget(e.target.value)}
              className="w-full border border-border rounded-lg px-4 py-3 text-sm bg-card text-foreground focus:outline-none focus:border-primary"
              placeholder="Optional daily admission cap"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Protection mode</label>
            <select
              value={protectionMode}
              onChange={(e) => setProtectionMode(e.target.value)}
              className="w-full border border-border rounded-lg px-4 py-3 text-sm bg-card text-foreground focus:outline-none focus:border-primary"
            >
              <option>Monitor only</option>
              <option>Guard connected</option>
            </select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-border py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            {currentBudget !== null && (
              <button
                type="button"
                onClick={removeBudget}
                disabled={loading}
                className="flex-1 border border-destructive/40 text-destructive py-2.5 rounded-lg text-sm font-medium hover:bg-destructive/5 transition-colors disabled:opacity-50"
              >
                Remove
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-medium tracking-tight hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SetBudgetModal;
