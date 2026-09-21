import { Link, Navigate, useSearchParams } from "react-router-dom";
import AppShell from "@/components/app/AppShell";
import { useAuth } from "@/hooks/useAuth";

export default function Setup() {
  const { user, loading, signOut } = useAuth();
  const [searchParams] = useSearchParams();
  const flowId = searchParams.get("flow");

  if (flowId) return <Navigate to={`/flows/${flowId}?tab=settings`} replace />;
  if (loading) return <div className="min-h-screen bg-[#f7f8fa]" />;

  return (
    <AppShell userLabel={user?.email} workspaceLabel="My workspace" onSignOut={signOut}>
      <div className="mx-auto max-w-3xl space-y-5">
        <div>
          <h1 className="text-xl font-semibold tracking-[-.02em]">Connection settings</h1>
          <p className="mt-1 text-sm text-slate-500">Connections belong to a specific workflow so reporting, budgets, and ownership stay together.</p>
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold">Connect a workflow</h2>
          <ol className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
            <li><span className="font-semibold text-slate-900">1. Add or select a workflow.</span> Start in Overview, then open the workflow you want to track.</li>
            <li><span className="font-semibold text-slate-900">2. Open Settings.</span> Create a scoped reporting key and copy that workflow’s endpoint.</li>
            <li><span className="font-semibold text-slate-900">3. Send records after each run.</span> Include a stable event ID, status, duration, tokens, and actual cost.</li>
          </ol>
          <Link to="/dashboard" className="mt-5 inline-flex h-9 items-center rounded-md bg-blue-600 px-3 text-xs font-semibold text-white">Open workflows</Link>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold">What this does—and does not—connect</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">FlowLedger records only the events your workflow reports with its scoped credential. Naming a workflow “Zapier,” “n8n,” or “Claude Code” does not connect that provider or prove budget enforcement. Guard protection requires the workflow to use the separate guard protocol before a paid call begins.</p>
        </section>
      </div>
    </AppShell>
  );
}
