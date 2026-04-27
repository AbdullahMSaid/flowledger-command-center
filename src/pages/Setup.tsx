import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, CheckCircle, Copy, Check } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const buildScript = (webhookUrl: string) => `#!/usr/bin/env bash
# FlowLedger — Claude Code session tracker
# Add to your shell rc: source /path/to/flowledger.sh

WEBHOOK="${webhookUrl}"

flowledger_preexec() {
  _fl_start=$(date +%s%3N)
  _fl_cmd="$1"
}

flowledger_precmd() {
  local exit_code=$?
  [[ -z "$_fl_start" ]] && return
  local end=$(date +%s%3N)
  local duration=$(( end - _fl_start ))
  local status="success"
  [[ $exit_code -ne 0 ]] && status="error"

  curl -s -X POST "$WEBHOOK" \\
    -H "Content-Type: application/json" \\
    -d "{
      \\"status\\": \\"$status\\",
      \\"duration_ms\\": $duration,
      \\"cost_usd\\": 0,
      \\"token_count\\": 0
    }" > /dev/null 2>&1 &

  unset _fl_start _fl_cmd
}

# Bash
if [[ -n "$BASH_VERSION" ]]; then
  trap 'flowledger_preexec "$BASH_COMMAND"' DEBUG
  PROMPT_COMMAND="flowledger_precmd\${PROMPT_COMMAND:+;$PROMPT_COMMAND}"
fi

# Zsh
if [[ -n "$ZSH_VERSION" ]]; then
  autoload -Uz add-zsh-hook
  add-zsh-hook preexec flowledger_preexec
  add-zsh-hook precmd flowledger_precmd
fi`;

const ClaudeCodeTab = ({ userId }: { userId: string }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedSave, setCopiedSave] = useState(false);
  const [copiedUse, setCopiedUse] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);
  const [testError, setTestError] = useState("");

  const handleCreate = async () => {
    setLoading(true);
    setError("");

    const { data: newFlow, error: insertError } = await supabase
      .from("flows")
      .insert({
        name: "Claude Code sessions",
        platform: "Claude Code",
        model: "claude-sonnet-4-5",
        user_id: userId,
      })
      .select("id")
      .single();

    if (insertError || !newFlow) {
      setError(insertError?.message ?? "Failed to create flow");
      setLoading(false);
      return;
    }

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ingest/${newFlow.id}`;
    setWebhookUrl(url);
    setLoading(false);
  };

  const handleCopyWebhook = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const handleCopyScript = async () => {
    await navigator.clipboard.writeText(buildScript(webhookUrl));
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const saveCommands = `nano ~/claude-tracked\nchmod +x ~/claude-tracked`;

  const handleCopySave = async () => {
    await navigator.clipboard.writeText(saveCommands);
    setCopiedSave(true);
    setTimeout(() => setCopiedSave(false), 2000);
  };

  const handleCopyUse = async () => {
    await navigator.clipboard.writeText("~/claude-tracked");
    setCopiedUse(true);
    setTimeout(() => setCopiedUse(false), 2000);
  };

  const handleTestRun = async () => {
    setTestLoading(true);
    setTestError("");
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "success", duration_ms: 2400, token_count: 850, cost_usd: 0.02 }),
      });
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
      setTestSuccess(true);
    } catch (e) {
      setTestError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setTestLoading(false);
    }
  };

  if (webhookUrl) {
    return (
      <div className="flex flex-col gap-8">
        {/* Success + Step 1 */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle size={22} className="text-[hsl(160,80%,28%)] shrink-0" />
            <p className="font-medium">Flow created successfully</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              <span className="font-medium text-foreground">Step 1 —</span> Your webhook URL:
            </p>
            <div className="flex items-stretch gap-2">
              <code className="flex-1 block bg-secondary border border-border rounded-lg px-4 py-3 text-sm font-mono break-all">
                {webhookUrl}
              </code>
              <button
                onClick={handleCopyWebhook}
                className="shrink-0 border border-border rounded-lg px-3 hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                title="Copy webhook URL"
              >
                {copiedWebhook ? <Check size={15} /> : <Copy size={15} />}
              </button>
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div>
          <p className="text-sm text-muted-foreground mb-2">
            <span className="font-medium text-foreground">Step 2 —</span> Add this script to your shell config (<code className="text-xs bg-secondary px-1 py-0.5 rounded">~/.bashrc</code> or <code className="text-xs bg-secondary px-1 py-0.5 rounded">~/.zshrc</code>):
          </p>
          <div className="relative">
            <pre className="bg-[hsl(220,16%,14%)] text-[hsl(220,14%,80%)] border border-border rounded-lg px-5 py-4 text-xs font-mono overflow-x-auto leading-relaxed whitespace-pre">
              {buildScript(webhookUrl)}
            </pre>
            <button
              onClick={handleCopyScript}
              className="absolute top-3 right-3 border border-[hsl(220,14%,28%)] rounded-lg px-2.5 py-1.5 hover:bg-[hsl(220,16%,22%)] transition-colors text-[hsl(220,14%,60%)] hover:text-[hsl(220,14%,80%)]"
              title="Copy script"
            >
              {copiedScript ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </div>
        </div>

        {/* Step 3 */}
        <div>
          <p className="text-sm text-muted-foreground mb-2">
            <span className="font-medium text-foreground">Step 3 —</span> Save the script to a file and make it executable:
          </p>
          <div className="relative">
            <pre className="bg-[hsl(220,16%,14%)] text-[hsl(220,14%,80%)] border border-border rounded-lg px-5 py-4 text-xs font-mono leading-relaxed whitespace-pre">
              {saveCommands}
            </pre>
            <button
              onClick={handleCopySave}
              className="absolute top-3 right-3 border border-[hsl(220,14%,28%)] rounded-lg px-2.5 py-1.5 hover:bg-[hsl(220,16%,22%)] transition-colors text-[hsl(220,14%,60%)] hover:text-[hsl(220,14%,80%)]"
              title="Copy commands"
            >
              {copiedSave ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </div>
        </div>

        {/* Step 4 */}
        <div>
          <p className="text-sm text-muted-foreground mb-2">
            <span className="font-medium text-foreground">Step 4 —</span> Use it instead of the <code className="text-xs bg-secondary px-1 py-0.5 rounded">claude</code> command. Everything works the same. FlowLedger logs each session in the background.
          </p>
          <div className="flex items-stretch gap-2">
            <pre className="flex-1 bg-[hsl(220,16%,14%)] text-[hsl(220,14%,80%)] border border-border rounded-lg px-5 py-4 text-xs font-mono leading-relaxed whitespace-pre">
              ~/claude-tracked
            </pre>
            <button
              onClick={handleCopyUse}
              className="shrink-0 border border-border rounded-lg px-3 hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
              title="Copy command"
            >
              {copiedUse ? <Check size={15} /> : <Copy size={15} />}
            </button>
          </div>
        </div>

        {/* Step 5 */}
        <div>
          <p className="text-sm text-muted-foreground mb-3">
            <span className="font-medium text-foreground">Step 5 —</span> Send a test run to confirm everything is connected.
          </p>
          {testSuccess ? (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle size={16} className="text-[hsl(160,80%,28%)] shrink-0" />
              <span>Test run received. Check your <Link to="/dashboard" className="underline hover:text-foreground transition-colors">dashboard</Link>.</span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <button
                onClick={handleTestRun}
                disabled={testLoading}
                className="self-start border border-border px-5 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
              >
                {testLoading ? "Sending..." : "Send test run"}
              </button>
              {testError && <p className="text-sm text-destructive">{testError}</p>}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Create a flow to start tracking Claude Code session costs and usage.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <button
        onClick={handleCreate}
        disabled={loading}
        className="self-start bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {loading ? "Creating..." : "Create Claude Code flow"}
      </button>
    </div>
  );
};

const ZapierTab = ({ userId }: { userId: string }) => {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { setError("Name cannot be empty."); return; }
    setLoading(true);
    setError("");

    const { data: newFlow, error: insertError } = await supabase
      .from("flows")
      .insert({ name: trimmed, platform: "Zapier", model: "gpt-4o", user_id: userId })
      .select("id")
      .single();

    if (insertError || !newFlow) {
      setError(insertError?.message ?? "Failed to create flow");
      setLoading(false);
      return;
    }

    setWebhookUrl(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ingest/${newFlow.id}`);
    setLoading(false);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const steps = [
    {
      label: "Step 2 — Create a Zap in Zapier",
      body: "In Zapier, click \"Create Zap\". Choose your trigger app and event — for example, Gmail → New Email, or HubSpot → New Contact. Complete the trigger setup as normal.",
    },
    {
      label: "Step 3 — Add a Webhooks action",
      body: "Add a new action step. Search for \"Webhooks by Zapier\" and select the POST action. In the URL field, paste your webhook URL:",
      showUrl: true,
    },
    {
      label: "Step 4 — Configure the payload",
      body: "Set Content-Type to application/json. In the Data field, send at minimum: status (\"success\" or \"error\"), cost_usd (the cost of the AI call), token_count, and duration_ms. Map these from earlier steps in your Zap where available.",
    },
    {
      label: "Step 5 — Test and turn on",
      body: "Run a test in Zapier to confirm the webhook receives data. Then turn your Zap on. Every time it runs, FlowLedger will log the session — visible on your dashboard.",
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* Step 1 */}
      <div>
        <p className="text-sm text-muted-foreground mb-3">
          <span className="font-medium text-foreground">Step 1 —</span> Name your flow and get a webhook URL to use in Zapier.
        </p>
        {webhookUrl ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle size={18} className="text-[hsl(160,80%,28%)] shrink-0" />
              <p className="font-medium text-sm">Flow created. Here's your webhook URL:</p>
            </div>
            <div className="flex items-stretch gap-2">
              <code className="flex-1 block bg-secondary border border-border rounded-lg px-4 py-3 text-sm font-mono break-all">
                {webhookUrl}
              </code>
              <button
                onClick={handleCopy}
                className="shrink-0 border border-border rounded-lg px-3 hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                title="Copy webhook URL"
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Lead notification Zap"
              className="w-full max-w-sm border border-border rounded-lg px-4 py-3 text-sm bg-card text-foreground focus:outline-none focus:border-primary"
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="self-start bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create flow"}
            </button>
          </form>
        )}
      </div>

      {/* Steps 2–5 */}
      {steps.map((step, i) => (
        <div key={i}>
          <p className="text-sm font-medium text-foreground mb-1">{step.label}</p>
          <p className="text-sm text-muted-foreground">{step.body}</p>
          {step.showUrl && (
            <code className="mt-2 block bg-secondary border border-border rounded-lg px-4 py-3 text-sm font-mono break-all">
              {webhookUrl || <span className="italic text-muted-foreground">webhook URL will appear here after Step 1</span>}
            </code>
          )}
        </div>
      ))}
    </div>
  );
};

const N8nTab = ({ userId }: { userId: string }) => {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { setError("Name cannot be empty."); return; }
    setLoading(true);
    setError("");

    const { data: newFlow, error: insertError } = await supabase
      .from("flows")
      .insert({ name: trimmed, platform: "n8n", model: "gpt-4o", user_id: userId })
      .select("id")
      .single();

    if (insertError || !newFlow) {
      setError(insertError?.message ?? "Failed to create flow");
      setLoading(false);
      return;
    }

    setWebhookUrl(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ingest/${newFlow.id}`);
    setLoading(false);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const urlPlaceholder = <span className="italic text-muted-foreground">webhook URL will appear here after Step 1</span>;

  const steps = [
    {
      label: "Step 2 — Create a workflow in n8n",
      body: "In n8n, click \"New Workflow\". Add your trigger node — for example, a Schedule trigger, a Webhook trigger, or any app node like OpenAI or Slack. Complete the trigger setup as normal.",
    },
    {
      label: "Step 3 — Add an HTTP Request node",
      body: "Add a new node and search for \"HTTP Request\". Set the method to POST and paste your webhook URL in the URL field:",
      showUrl: true,
    },
    {
      label: "Step 4 — Configure the request body",
      body: "Set Body Content-Type to JSON. Add the following fields: status (\"success\" or \"error\"), cost_usd (the cost of the AI call), token_count, and duration_ms. Use n8n expressions to map values from earlier nodes where available.",
    },
    {
      label: "Step 5 — Activate your workflow",
      body: "Run a manual test to confirm FlowLedger receives the data. Then activate the workflow. Every execution will be logged and visible on your dashboard.",
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* Step 1 */}
      <div>
        <p className="text-sm text-muted-foreground mb-3">
          <span className="font-medium text-foreground">Step 1 —</span> Name your flow and get a webhook URL to use in n8n.
        </p>
        {webhookUrl ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle size={18} className="text-[hsl(160,80%,28%)] shrink-0" />
              <p className="font-medium text-sm">Flow created. Here's your webhook URL:</p>
            </div>
            <div className="flex items-stretch gap-2">
              <code className="flex-1 block bg-secondary border border-border rounded-lg px-4 py-3 text-sm font-mono break-all">
                {webhookUrl}
              </code>
              <button
                onClick={handleCopy}
                className="shrink-0 border border-border rounded-lg px-3 hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                title="Copy webhook URL"
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. AI workflow tracker"
              className="w-full max-w-sm border border-border rounded-lg px-4 py-3 text-sm bg-card text-foreground focus:outline-none focus:border-primary"
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="self-start bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create flow"}
            </button>
          </form>
        )}
      </div>

      {/* Steps 2–5 */}
      {steps.map((step, i) => (
        <div key={i}>
          <p className="text-sm font-medium text-foreground mb-1">{step.label}</p>
          <p className="text-sm text-muted-foreground">{step.body}</p>
          {step.showUrl && (
            <code className="mt-2 block bg-secondary border border-border rounded-lg px-4 py-3 text-sm font-mono break-all">
              {webhookUrl || urlPlaceholder}
            </code>
          )}
        </div>
      ))}
    </div>
  );
};

const Setup = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 flex items-center justify-between px-8 py-4 border-b border-border bg-background/95 backdrop-blur-sm">
        <Link to="/" className="font-display text-[22px] tracking-tight">
          Flow<span className="text-primary">Ledger</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link to="/docs" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Docs</Link>
          <span className="text-sm text-muted-foreground">{user?.email}</span>
          <button onClick={signOut} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Sign out</button>
        </div>
      </nav>

      <div className="max-w-[1100px] mx-auto px-8 py-10">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate("/dashboard")} className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
            <ArrowLeft size={18} />
          </button>
          <h1 className="font-display text-3xl tracking-tight">Integrations</h1>
        </div>

        <Tabs defaultValue="claude-code">
          <TabsList className="mb-6">
            <TabsTrigger value="claude-code">Claude Code</TabsTrigger>
            <TabsTrigger value="zapier">Zapier</TabsTrigger>
            <TabsTrigger value="n8n">n8n</TabsTrigger>
          </TabsList>

          <TabsContent value="claude-code">
            <div className="border border-border rounded-xl bg-card px-6 py-8">
              <ClaudeCodeTab userId={user?.id ?? ""} />
            </div>
          </TabsContent>

          <TabsContent value="zapier">
            <div className="border border-border rounded-xl bg-card px-6 py-8">
              <ZapierTab userId={user?.id ?? ""} />
            </div>
          </TabsContent>

          <TabsContent value="n8n">
            <div className="border border-border rounded-xl bg-card px-6 py-8">
              <N8nTab userId={user?.id ?? ""} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Setup;
