import { Link } from "react-router-dom";

const ConfigurationRequired = () => (
  <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
    <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-sm">
      <div className="font-display text-2xl tracking-tight">Flow<span className="text-primary">Ledger</span></div>
      <h1 className="mt-8 text-2xl font-semibold tracking-tight">This workspace isn’t connected yet</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Connect the workspace data service before using account data. You can still explore the public demo without a connection.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link to="/demo" className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">Open public demo</Link>
        <Link to="/docs#developer-reference" className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground">Technical setup</Link>
      </div>
      <details className="mt-6 text-xs leading-5 text-muted-foreground"><summary className="cursor-pointer font-medium text-foreground">Technical details</summary><p className="mt-2">This local build needs <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to load a real authenticated workspace.</p></details>
    </div>
  </main>
);

export default ConfigurationRequired;
