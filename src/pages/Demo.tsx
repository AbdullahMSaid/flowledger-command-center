import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, Check, ChevronRight, CircleStop, Clock3, Pause, Play, RotateCcw, ShieldCheck, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { demoAgents, defaultDemoPolicy, DEMO_DURATION_SECONDS, formatDemoTime, getDemoSnapshot, type DemoPolicy, type ReplayStage } from "@/lib/demo/fixtures";
import AppShell from "@/components/app/AppShell";
import { useAuth } from "@/hooks/useAuth";

const stageCopy: Record<ReplayStage, { label: string; title: string; description: string }> = {
  idle: { label: "Ready to replay", title: "See the failure pattern in under a minute.", description: "A deterministic synthetic workflow will move from normal traffic to a guarded block." },
  baseline: { label: "Baseline captured", title: "The responder starts normally.", description: "FlowLedger establishes a five-minute baseline before evaluating the change." },
  rising: { label: "Spend rate rising", title: "Channel checks are accelerating.", description: "Call volume is rising 13× above its normal cadence. The underlying scope is still unchanged." },
  detected: { label: "Warning detected", title: "An explainable anomaly is forming.", description: "The current five-minute spend rate crossed the configured threshold and absolute floor." },
  blocked: { label: "Request blocked", title: "The next costly call never runs.", description: "The guard reserved the remaining budget and denied the next request before provider execution." },
  resolved: { label: "Control restored", title: "The policy is safer now.", description: "The scope was narrowed, frequency lowered, and an operator explicitly resumed the guarded flow." },
};

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(value);
}

function statusClasses(status: string) {
  if (status === "Healthy") return "bg-emerald/10 text-emerald";
  if (status === "Warning") return "bg-amber-100 text-amber-800";
  if (status === "Blocked") return "bg-red-50 text-red-700";
  return "bg-slate-100 text-slate-600";
}

const Demo = () => {
  const [policy, setPolicy] = useState<DemoPolicy>(defaultDemoPolicy);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [manuallyResumed, setManuallyResumed] = useState(false);
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const { user, signOut } = useAuth(false);
  const previewMode = searchParams.get("mode") === "preview" && Boolean(user);
  const snapshot = useMemo(() => getDemoSnapshot(elapsedSeconds, policy, manuallyResumed), [elapsedSeconds, manuallyResumed, policy]);
  const stage = stageCopy[snapshot.stage];

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setElapsedSeconds((current) => {
        if (current >= DEMO_DURATION_SECONDS) {
          setPlaying(false);
          return DEMO_DURATION_SECONDS;
        }
        return current + 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [playing]);

  const restart = () => {
    setPlaying(false);
    setElapsedSeconds(0);
    setManuallyResumed(false);
    setPolicy(defaultDemoPolicy);
    setIncidentOpen(false);
  };

  const runDemo = () => {
    if (elapsedSeconds >= DEMO_DURATION_SECONDS) restart();
    setPlaying(true);
  };

  const adjustPolicy = () => {
    const saferPolicy = policy.channelScope === "Priority channels only" && policy.checksPerHour <= 12;
    setPolicy(saferPolicy ? defaultDemoPolicy : { channelScope: "Priority channels only", checksPerHour: 12 });
    if (saferPolicy) setManuallyResumed(false);
  };

  const resumeFlow = () => {
    if (policy.channelScope === "Priority channels only" && policy.checksPerHour <= 12) {
      setManuallyResumed(true);
    }
  };

  const getAgentStatus = (id: string) => {
    if (id === "out-of-office" && snapshot.requestBlocked) return "Blocked";
    if (id === "out-of-office" && snapshot.warningVisible) return "Warning";
    if (id === "out-of-office" && snapshot.stage === "resolved") return "Healthy";
    return "Healthy";
  };

  return (
    <AppShell workspaceLabel={previewMode ? "Preview account" : "Demo workspace"} userLabel={previewMode ? user?.email : undefined} preview demo={!previewMode} onSignOut={previewMode ? signOut : undefined}>
      <div className="space-y-6">
        <section className="mb-8 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[2px] text-electric-blue">Runaway-agent replay</div>
            <h1 className="font-display text-4xl leading-tight tracking-tight text-slate-950 sm:text-5xl">Spending rises → next call blocked → review and resume.</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">This is a guided synthetic example, not activity from your account. Watch an out-of-office responder move from normal behavior to a budget decision in under a minute.</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button onClick={runDemo} className="inline-flex h-11 items-center gap-2 rounded-lg bg-slate-950 px-5 text-sm font-medium text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-electric-blue focus:ring-offset-2">
              <Play className="h-4 w-4 fill-current" /> {playing ? "Replay running" : "Run runaway-agent demo"}
            </button>
            <button onClick={() => setPlaying(false)} disabled={!playing} className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-40">
              <Pause className="h-4 w-4" /> Pause
            </button>
            <button onClick={restart} className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-slate-500">
              <RotateCcw className="h-4 w-4" /> Restart
            </button>
          </div>
        </section>

        <section className="mb-6 grid gap-3 md:grid-cols-3" aria-label="Operating modes">
          {[
            { label: "Demo", text: "Synthetic traffic only", icon: Sparkles, active: true },
            { label: "Monitor only", text: "Reports incurred cost", icon: Clock3, active: false },
            { label: "Guard connected", text: "Cooperating workflow", icon: ShieldCheck, active: false },
          ].map((mode) => (
            <div key={mode.label} className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${mode.active ? "border-blue-200 bg-blue-50/70" : "border-slate-200 bg-white"}`}>
              <mode.icon className={`h-4 w-4 ${mode.active ? "text-electric-blue" : "text-slate-400"}`} />
              <div><div className="text-sm font-semibold text-slate-800">{mode.label}</div><div className="text-xs text-slate-500">{mode.text}</div></div>
              {mode.active && <span className="ml-auto rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">Current</span>}
            </div>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(360px,0.8fr)]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[1.5px] text-slate-500"><span className="h-2 w-2 rounded-full bg-electric-blue" /> {stage.label}</div>
                  <h2 className="mt-2 font-display text-3xl tracking-tight text-slate-950">{stage.title}</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{stage.description}</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-4 py-3 text-right"><div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Virtual clock</div><div className="mt-1 font-mono text-sm text-slate-700">{formatDemoTime(snapshot.virtualTime)}</div></div>
              </div>
              <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between text-xs text-slate-500"><span>Replay timeline</span><span>{snapshot.elapsedSeconds}s / {DEMO_DURATION_SECONDS}s</span></div>
                <div className="relative h-2 rounded-full bg-slate-200"><div className={`h-2 rounded-full transition-all duration-500 ${snapshot.requestBlocked ? "bg-red-500" : snapshot.warningVisible ? "bg-amber-400" : "bg-electric-blue"}`} style={{ width: `${(snapshot.elapsedSeconds / DEMO_DURATION_SECONDS) * 100}%` }} /><span className="absolute left-[25%] top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-amber-400" /><span className="absolute left-[54%] top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-red-500" /></div>
                <div className="mt-3 grid grid-cols-3 text-[10px] uppercase tracking-wider text-slate-400"><span>Baseline</span><span className="text-center">Warning</span><span className="text-right">Block</span></div>
              </div>
              {snapshot.warningVisible && <div className={`mt-4 flex gap-3 rounded-xl border p-4 ${snapshot.requestBlocked ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`} role="status"><AlertTriangle className={`mt-0.5 h-5 w-5 shrink-0 ${snapshot.requestBlocked ? "text-red-600" : "text-amber-600"}`} /><div><div className={`text-sm font-semibold ${snapshot.requestBlocked ? "text-red-900" : "text-amber-900"}`}>{snapshot.requestBlocked ? "Request blocked before execution" : "Spend-rate warning"}</div><div className={`mt-1 text-xs leading-5 ${snapshot.requestBlocked ? "text-red-800" : "text-amber-800"}`}>{snapshot.requestBlocked ? "Reserved cost would exceed the $0.88 daily demo budget. No provider callback was invoked." : "Current five-minute rate is 35× the $0.012/min baseline, above the 3× threshold and $0.25 absolute floor."}</div></div></div>}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6"><div><h2 className="text-sm font-semibold text-slate-900">Registered AI workflows</h2><p className="mt-1 text-xs text-slate-500">Owner and protection status are explicit coverage fields.</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">3 workflows</span></div>
              <div className="divide-y divide-slate-100">{demoAgents.map((agent) => { const status = getAgentStatus(agent.id); const cost = agent.id === "out-of-office" ? snapshot.outOfOfficeCost : agent.todayCost; return <div key={agent.id} className="grid gap-4 px-5 py-5 sm:grid-cols-[minmax(0,1.3fr)_0.75fr_0.7fr_0.8fr] sm:items-center sm:px-6"><div><div className="flex items-center gap-2 text-sm font-semibold text-slate-900">{agent.name}<span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClasses(status)}`}>{status}</span></div><div className="mt-1 text-xs text-slate-500">{agent.description}</div><div className="mt-2 text-[11px] text-slate-400">Owner: <span className="text-slate-600">{agent.owner}</span> · {agent.team}</div></div><div><div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Protection</div><div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-slate-700">{agent.protection === "Guard connected" ? <ShieldCheck className="h-3.5 w-3.5 text-emerald" /> : <Clock3 className="h-3.5 w-3.5 text-slate-400" />}{agent.protection}</div></div><div><div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Today</div><div className="mt-1 text-sm font-semibold tabular-nums text-slate-900">{money(cost)}</div><div className="mt-1 text-[11px] text-slate-400">of {money(agent.budget)} budget</div></div><div className="sm:text-right"><div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Platform</div><div className="mt-1 text-xs text-slate-700">{agent.platform}</div><div className="text-[11px] text-slate-400">{agent.model}</div></div></div> })}</div>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm sm:p-6"><div className="flex items-center justify-between"><div className="text-xs font-semibold uppercase tracking-[1.5px] text-slate-400">Workspace snapshot</div><span className="rounded-full bg-white/10 px-2 py-1 text-[10px] text-slate-300">Illustrative</span></div><div className="mt-5 grid grid-cols-2 gap-4"><div><div className="text-xs text-slate-400">Spend today</div><div className="mt-1 text-2xl font-semibold tabular-nums">{money(snapshot.totalCost)}</div></div><div><div className="text-xs text-slate-400">Open incidents</div><div className="mt-1 text-2xl font-semibold tabular-nums">{snapshot.warningVisible ? "1" : "0"}</div></div><div><div className="text-xs text-slate-400">Current rate</div><div className="mt-1 text-2xl font-semibold tabular-nums">{money(snapshot.currentSpendPerMinute)}<span className="text-sm font-normal text-slate-400">/min</span></div></div><div><div className="text-xs text-slate-400">Guarded flows</div><div className="mt-1 text-2xl font-semibold tabular-nums">2</div></div></div><div className="mt-5 border-t border-white/10 pt-4"><div className="flex items-center justify-between text-xs text-slate-400"><span>Projected daily spend at current rate</span><span className="font-semibold text-white">{money(snapshot.projectedDailySpend)}</span></div><p className="mt-2 text-[11px] leading-5 text-slate-500">Observed rate × 24 hours. This is a projection, not actual provider spending.</p></div></div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[1.5px] text-slate-500"><SlidersHorizontal className="h-4 w-4" /> Policy response</div><h2 className="mt-2 text-lg font-semibold text-slate-900">Make the next run safer</h2><p className="mt-1 text-xs leading-5 text-slate-500">A policy change is separate from resuming execution.</p></div>{snapshot.stage === "resolved" && <Check className="h-5 w-5 text-emerald" />}</div><div className="mt-5 space-y-3"><label className="block text-xs font-medium text-slate-700">Channel scope<select value={policy.channelScope} onChange={(e) => setPolicy((current) => ({ ...current, channelScope: e.target.value as DemoPolicy["channelScope"] }))} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-electric-blue focus:outline-none focus:ring-2 focus:ring-blue-100"><option>All channels</option><option>Priority channels only</option></select></label><label className="block text-xs font-medium text-slate-700">Checks per hour<input type="number" min="1" max="60" value={policy.checksPerHour} onChange={(e) => setPolicy((current) => ({ ...current, checksPerHour: Number(e.target.value) || 1 }))} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-electric-blue focus:outline-none focus:ring-2 focus:ring-blue-100" /></label></div><div className="mt-5 flex flex-wrap gap-2"><button onClick={adjustPolicy} className="inline-flex h-10 items-center gap-2 rounded-lg bg-electric-blue px-3.5 text-xs font-semibold text-white hover:bg-blue-700">{policy.channelScope === "Priority channels only" && policy.checksPerHour <= 12 ? "Restore original policy" : "Narrow scope + lower rate"}</button><button onClick={resumeFlow} disabled={snapshot.stage !== "blocked" || !(policy.channelScope === "Priority channels only" && policy.checksPerHour <= 12)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-40"><Play className="h-3.5 w-3.5" /> Resume guarded flow</button></div>{manuallyResumed && <p className="mt-3 text-xs font-medium text-emerald">Resumed with the updated policy. Spent cost was not reset.</p>}</div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center justify-between"><div><div className="text-xs font-semibold uppercase tracking-[1.5px] text-slate-500">Incident evidence</div><h2 className="mt-2 text-lg font-semibold text-slate-900">One decision, fully explained</h2></div><CircleStop className={`h-5 w-5 ${snapshot.requestBlocked ? "text-red-500" : "text-slate-300"}`} /></div><div className="mt-4 space-y-3 text-xs"><div className="flex justify-between gap-4"><span className="text-slate-500">Detection rule</span><span className="text-right font-medium text-slate-700">≥3× baseline + floor</span></div><div className="flex justify-between gap-4"><span className="text-slate-500">Baseline window</span><span className="text-right font-medium text-slate-700">Prior 30 minutes</span></div><div className="flex justify-between gap-4"><span className="text-slate-500">Current window</span><span className="text-right font-medium text-slate-700">Last 5 minutes</span></div><div className="flex justify-between gap-4"><span className="text-slate-500">Blocked requests</span><span className="text-right font-medium text-slate-700">{snapshot.blockedRequests}</span></div></div><button onClick={() => setIncidentOpen(true)} disabled={!snapshot.canInspectIncident} className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-40">Inspect incident <ChevronRight className="h-3.5 w-3.5" /></button></div>
          </aside>
        </section>

        <footer className="mt-8 flex flex-col justify-between gap-3 border-t border-slate-200 pt-5 text-xs text-slate-500 sm:flex-row"><span>Demo records never enter live totals.</span><span>Monitor only reports costs. Guard connected requires a cooperating runner.</span></footer>
      </div>

      {incidentOpen && <div className="fixed inset-0 z-50 flex items-end justify-end bg-slate-950/30 p-0 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="incident-title"><div className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl sm:p-6"><div className="flex items-start justify-between"><div><div className="text-xs font-semibold uppercase tracking-[1.5px] text-red-600">Incident · Synthetic evidence</div><h2 id="incident-title" className="mt-2 font-display text-3xl tracking-tight text-slate-950">Out-of-office responder</h2><p className="mt-1 text-sm text-slate-500">Open · detected {formatDemoTime(snapshot.virtualTime)}</p></div><button onClick={() => setIncidentOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close incident detail"><X className="h-5 w-5" /></button></div><div className="mt-6 space-y-4"><div className="rounded-xl border border-red-200 bg-red-50 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-red-900"><CircleStop className="h-4 w-4" /> Request blocked before execution</div><p className="mt-2 text-xs leading-5 text-red-800">The guard denied a maximum cost of $0.42 because the reservation would exceed the remaining $0.31 budget. The provider callback was never invoked.</p></div><div className="grid grid-cols-2 gap-3">{[["Owner", "Maya Chen"], ["Team", "People Ops"], ["Protection", "Guard connected"], ["Scope", policy.channelScope], ["Baseline", "$0.012 / min"], ["Current", "$0.42 / min"]].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</div><div className="mt-1 text-xs font-medium text-slate-800">{value}</div></div>)}</div><div><div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Timeline</div><ol className="mt-3 space-y-3 border-l border-slate-200 pl-4 text-xs text-slate-600"><li><span className="font-medium text-slate-900">14:00:12 UTC</span> · baseline established at $0.012/min</li><li><span className="font-medium text-slate-900">14:00:26 UTC</span> · warning: 35× baseline, scope unchanged</li><li><span className="font-medium text-slate-900">14:00:34 UTC</span> · admission denied; 7 requests held</li></ol></div><div className="rounded-xl border border-slate-200 p-4"><div className="text-xs font-semibold text-slate-800">Recommended action</div><p className="mt-1 text-xs leading-5 text-slate-600">Narrow the channel scope and reduce polling frequency, then explicitly resume. Resuming alone must not reset the spent budget.</p></div></div></div></div>}
    </AppShell>
  );
};

export default Demo;
