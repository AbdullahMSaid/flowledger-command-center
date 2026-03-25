import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const platforms = ["Zapier", "n8n", "Make", "LangChain", "Other"];

const AddFlowModal = ({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) => {
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState("Zapier");
  const [model, setModel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Not authenticated");
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from("flows").insert({
      name,
      platform,
      model,
      user_id: user.id,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
    } else {
      onCreated();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-foreground/50" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl p-8 w-full max-w-[440px] shadow-lg">
        <h2 className="font-display text-2xl tracking-tight mb-6">Add flow</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-sm text-ink2 mb-1 block">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full border border-border rounded-lg px-4 py-3 text-sm bg-card text-foreground focus:outline-none focus:border-primary"
              placeholder="e.g. Customer support triage"
            />
          </div>
          <div>
            <label className="text-sm text-ink2 mb-1 block">Platform</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full border border-border rounded-lg px-4 py-3 text-sm bg-card text-foreground focus:outline-none focus:border-primary"
            >
              {platforms.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-ink2 mb-1 block">Model</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              required
              className="w-full border border-border rounded-lg px-4 py-3 text-sm bg-card text-foreground focus:outline-none focus:border-primary"
              placeholder="e.g. gpt-4o"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-3 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-border py-2.5 rounded-lg text-sm text-foreground hover:border-ink3 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create flow"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddFlowModal;
