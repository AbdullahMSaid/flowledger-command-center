import { useState } from "react";

const errorMessages = [
  "Timeout after 30s",
  "Rate limit exceeded",
  "Invalid API key",
  "Context length exceeded",
];

const SimulateRunButton = ({ flowId, onSuccess }: { flowId: string; onSuccess?: () => void }) => {
  const [state, setState] = useState<"idle" | "sending" | "failed">("idle");

  const simulate = async () => {
    setState("sending");

    const isError = Math.random() < 0.2;
    const payload = {
      status: isError ? "error" : "success",
      cost_usd: Number((Math.random() * 0.078 + 0.002).toFixed(4)),
      duration_ms: Math.floor(Math.random() * 4400 + 600),
      token_count: Math.floor(Math.random() * 3800 + 200),
      error_message: isError
        ? errorMessages[Math.floor(Math.random() * errorMessages.length)]
        : null,
    };

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ingest/${flowId}`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed");
      setState("idle");
      onSuccess?.();
    } catch {
      setState("failed");
      setTimeout(() => setState("idle"), 3000);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={(e) => {
          e.stopPropagation();
          simulate();
        }}
        disabled={state === "sending"}
        className="text-xs border border-border rounded-md px-2.5 py-1 text-ink2 hover:border-ink3 hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
      >
        {state === "sending" ? "Sending..." : "Simulate run"}
      </button>
      {state === "failed" && (
        <span className="text-xs text-destructive">Failed</span>
      )}
    </div>
  );
};

export default SimulateRunButton;
