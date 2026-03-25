import { useState } from "react";

const errorMessages = [
  "Timeout after 30s",
  "Rate limit exceeded",
  "Invalid API key",
  "Context length exceeded",
];

const BulkSimulateButton = ({ flowIds }: { flowIds: string[] }) => {
  const [state, setState] = useState<"idle" | "running">("idle");
  const [progress, setProgress] = useState(0);

  const runBulk = async () => {
    if (flowIds.length === 0) return;
    setState("running");
    setProgress(0);

    for (let i = 0; i < 10; i++) {
      const flowId = flowIds[Math.floor(Math.random() * flowIds.length)];
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
        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ingest/${flowId}`,
          {
            method: "POST",
            headers: {
              Authorization: "Bearer demo-token",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          }
        );
      } catch {
        // continue on failure
      }

      setProgress(i + 1);
      if (i < 9) await new Promise((r) => setTimeout(r, 500));
    }

    setState("idle");
    setProgress(0);
  };

  return (
    <button
      onClick={runBulk}
      disabled={state === "running" || flowIds.length === 0}
      className="border border-border rounded-lg px-4 py-2.5 text-sm font-medium text-ink2 hover:border-ink3 hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {state === "running" ? `Simulating… ${progress}/10` : "Simulate 10 runs"}
    </button>
  );
};

export default BulkSimulateButton;
