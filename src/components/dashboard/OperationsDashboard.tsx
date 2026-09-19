import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ArrowRight, ChevronRight, Plus, SlidersHorizontal } from "lucide-react";
import { Link } from "react-router-dom";

export type OperationsFlow = {
  id: string;
  name: string;
  owner: string;
  team?: string;
  platform: string;
  model: string;
  status: string;
  spend: number | null;
  budget: number | null;
  protection?: string;
  lastRun?: string;
};

type Props = {
  title?: string;
  scopeLabel: string;
  periodLabel: string;
  spend: number | null;
  activeFlows: number;
  runCount: number | null;
  issueCount: number;
  flows: OperationsFlow[];
  chartData: { label: string; cost: number }[];
  onAddFlow: () => void;
  onSelectFlow: (id: string) => void;
  preview?: boolean;
  demo?: boolean;
  attentionPath?: string;
  onSimulate?: (period: "week" | "month") => void;
  simulationStatus?: string | null;
  simulating?: boolean;
  error?: string | null;
};

const statusClass = (status: string) => {
  const value = status.toLowerCase();
  if (value.includes("error") || value.includes("emergency") || value.includes("blocked")) return "border-red-200 bg-red-50 text-red-700";
  if (value.includes("degraded") || value.includes("warning") || value.includes("attention")) return "border-amber-200 bg-amber-50 text-amber-700";
  if (value.includes("paused") || value.includes("archived") || value.includes("stale")) return "border-slate-200 bg-slate-100 text-slate-600";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
};

const money = (value: number | null) => value === null ? "Unavailable" : `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function OperationsDashboard({ title = "Overview", scopeLabel, periodLabel, spend, activeFlows, runCount, issueCount, flows, chartData, onAddFlow, onSelectFlow, preview = false, demo = false, attentionPath, onSimulate, simulationStatus, simulating = false, error }: Props) {
  return <div className="space-y-5">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div><div className="flex items-center gap-2"><h1 className="text-xl font-semibold tracking-[-0.02em]">{title}</h1>{preview ? <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Synthetic preview</span> : null}</div><p className="mt-1 text-xs text-slate-500">{scopeLabel} · {periodLabel} · UTC</p></div>
      <div className="flex items-center gap-2"><Link to={demo ? "/demo/management" : "/command-center"} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900"><SlidersHorizontal className="h-3.5 w-3.5" />Reviews</Link><button type="button" onClick={onAddFlow} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"><Plus className="h-4 w-4" />Add workflow</button></div>
    </div>

    {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><div className="font-medium">Workspace data could not be loaded.</div><div className="mt-0.5 text-xs">{error}</div></div> : null}
    {preview ? <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-800">{demo ? "Public synthetic demo. These deterministic records never enter an account, Supabase, or live totals." : "Development-only signed-in preview. These deterministic records never enter Supabase or live totals."}</div> : null}
    {onSimulate ? <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center"><div className="flex-1"><div className="text-sm font-semibold text-slate-800">Simulate activity</div><p className="mt-0.5 text-xs text-slate-500">Load an illustrative period into this local sample. It replaces the current sample scenario; it never sends telemetry or calls a provider.</p>{simulationStatus ? <p className="mt-1 text-xs font-medium text-emerald-700" role="status">{simulationStatus}</p> : null}</div><div className="flex shrink-0 gap-2"><button type="button" onClick={() => onSimulate("week")} disabled={simulating} className="h-8 rounded-md border border-slate-300 px-3 text-xs font-semibold text-slate-700 disabled:opacity-50">{simulating ? "Loading…" : "Load 1 week"}</button><button type="button" onClick={() => onSimulate("month")} disabled={simulating} className="h-8 rounded-md bg-slate-900 px-3 text-xs font-semibold text-white disabled:opacity-50">Load 1 month</button></div></div> : null}
    {issueCount > 0 ? <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center"><AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" /><div className="flex-1 text-sm text-amber-950"><span className="font-semibold">{issueCount} {issueCount === 1 ? "workflow needs" : "workflows need"} attention.</span> Review what happened and decide whether new calls should resume.</div><Link to={attentionPath ?? (preview ? "/demo/replay" : "/alerts")} className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800">View issue <ArrowRight className="h-3.5 w-3.5" /></Link></div> : null}

    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="grid grid-cols-2 divide-x divide-y divide-slate-200 sm:grid-cols-4 sm:divide-y-0">
        {[[`Spend · ${periodLabel}`, money(spend), "Reported spend"], ["Active workflows", String(activeFlows), "Non-archived"], ["Executions · selected period", runCount === null ? "Unavailable" : runCount.toLocaleString(), "Reported activity"], ["Needs attention", String(issueCount), issueCount ? "Review required" : "No open issues"]].map(([label, value, note]) => <div key={label} className="p-4 sm:p-5"><div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</div><div className="mt-2 text-2xl font-semibold tracking-[-0.03em] tabular-nums text-slate-950">{value}</div><div className="mt-1 text-[11px] text-slate-400">{note}</div></div>)}
      </div>
    </section>

    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,.85fr)]">
      <div id="operations-flows" className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3"><div><h2 className="text-sm font-semibold">Workflows</h2><p className="mt-0.5 text-[11px] text-slate-400">Your AI agents and automations. Select one to inspect activity, spending, and controls.</p></div><span className="text-[11px] text-slate-400">{flows.length} shown</span></div>
        <div className="mobile-flow-list divide-y divide-slate-100 sm:hidden">{flows.map(flow => <button key={flow.id} type="button" onClick={() => onSelectFlow(flow.id)} className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left hover:bg-blue-50/40"><div className="min-w-0"><div className="truncate text-sm font-medium text-slate-900">{flow.name}</div><div className="mt-1 text-[11px] text-slate-400">{flow.owner} · {flow.platform}</div><span className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClass(flow.status)}`}>{flow.status}</span></div><div className="shrink-0 text-right"><div className="text-sm font-semibold tabular-nums">{money(flow.spend)}</div><div className="mt-1 text-[10px] text-slate-400">{flow.budget === null ? "No budget" : `${money(flow.budget)} budget`}</div><ChevronRight className="ml-auto mt-2 h-4 w-4 text-slate-300" /></div></button>)}{flows.length === 0 ? <div className="px-4 py-10 text-center text-sm text-slate-500">No flows yet.</div> : null}</div>
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-slate-50/80 text-[10px] uppercase tracking-[0.1em] text-slate-400"><tr><th className="px-4 py-2.5 font-semibold">Name</th><th className="px-4 py-2.5 font-semibold">Owner</th><th className="px-4 py-2.5 font-semibold">Status</th><th className="px-4 py-2.5 text-right font-semibold">Spend</th><th className="px-4 py-2.5 font-semibold">Budget</th><th className="w-10" /></tr></thead><tbody className="divide-y divide-slate-100">{flows.map(flow => { const pct = flow.budget && flow.spend !== null ? Math.min(100, (flow.spend / flow.budget) * 100) : null; return <tr key={flow.id} onClick={() => onSelectFlow(flow.id)} onKeyDown={event => { if (event.key === "Enter") onSelectFlow(flow.id); }} tabIndex={0} className="cursor-pointer outline-none transition-colors hover:bg-blue-50/40 focus:bg-blue-50/60"><td className="px-4 py-3"><div className="font-medium text-slate-900">{flow.name}</div><div className="mt-0.5 text-[11px] text-slate-400">{flow.platform} · {flow.model}</div></td><td className="px-4 py-3"><div className="text-slate-700">{flow.owner}</div>{flow.team ? <div className="mt-0.5 text-[11px] text-slate-400">{flow.team}</div> : null}</td><td className="px-4 py-3"><span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClass(flow.status)}`}>{flow.status}</span>{flow.protection ? <div className="mt-1 text-[10px] text-slate-400">{flow.protection}</div> : null}</td><td className="px-4 py-3 text-right font-medium tabular-nums text-slate-800">{money(flow.spend)}</td><td className="px-4 py-3">{flow.budget === null ? <span className="text-slate-400">Not set</span> : <div className="min-w-28"><div className="flex justify-between text-[10px] text-slate-400"><span>{pct?.toFixed(0)}%</span><span>{money(flow.budget)}</span></div><div className="mt-1 h-1 overflow-hidden rounded bg-slate-100"><div className={`h-full rounded ${pct && pct >= 90 ? "bg-red-500" : pct && pct >= 70 ? "bg-amber-500" : "bg-blue-600"}`} style={{ width: `${pct ?? 0}%` }} /></div></div>}</td><td className="px-3 py-3"><ChevronRight className="h-4 w-4 text-slate-300" /></td></tr>; })}{flows.length === 0 ? <tr><td colSpan={6} className="px-4 py-12 text-center"><div className="text-sm font-medium text-slate-700">No flows in this workspace</div><div className="mt-1 text-xs text-slate-400">Add a flow to connect its telemetry and set a budget.</div><button onClick={onAddFlow} className="mt-4 inline-flex h-8 items-center gap-1 rounded-md bg-blue-600 px-3 text-xs font-semibold text-white"><Plus className="h-3.5 w-3.5" />Add flow</button></td></tr> : null}</tbody></table></div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Spend trend</h2><p className="mt-0.5 text-[11px] text-slate-400">Reported spend · UTC</p></div><Link to={demo ? "/demo/spending" : "/analytics"} className="text-[11px] font-semibold text-blue-600">Open spending</Link></div><div className="mt-4 h-[250px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 5, right: 4, left: -20, bottom: 0 }}><defs><linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563eb" stopOpacity={0.18}/><stop offset="100%" stopColor="#2563eb" stopOpacity={0.01}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#e8edf3" /><XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false}/><YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`}/><Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, "Spend"]} contentStyle={{ border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 11, boxShadow: "none" }}/><Area type="monotone" dataKey="cost" stroke="#2563eb" strokeWidth={2} fill="url(#spendFill)" /></AreaChart></ResponsiveContainer></div></div>
    </section>
  </div>;
}
