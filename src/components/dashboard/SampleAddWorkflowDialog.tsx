import { useEffect, useState, type FormEvent } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import type { SampleFlow } from "@/lib/demo/workspace";
import { createSampleFlow } from "@/lib/demo/workspace";

type Props = { onClose: () => void; onAdd: (flow: SampleFlow) => void; mode: "demo" | "preview"; scenario?: "baseline" | "week" | "month"; onOpenConnection?: (flow: SampleFlow) => void };

export default function SampleAddWorkflowDialog({ onClose, onAdd, mode, scenario, onOpenConnection }: Props) {
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState("Zapier");
  const [model, setModel] = useState("");
  const [more, setMore] = useState(false);
  const [owner, setOwner] = useState("");
  const [team, setTeam] = useState("");
  const [created, setCreated] = useState<SampleFlow | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const flow = createSampleFlow({ name, platform, model, owner, team }, mode, scenario);
    onAdd(flow);
    setCreated(flow);
  };

  const demo = mode === "demo";
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-labelledby="sample-add-title">
    <div className="w-full max-w-[430px] rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
      <div className="flex items-start justify-between"><div><h2 id="sample-add-title" className="text-lg font-semibold">{created ? (demo ? "Demo workflow added" : "Connect a provider") : "Add workflow"}</h2><p className="mt-1 text-xs text-slate-500">{created ? (demo ? "Illustrative values were generated for this demo only." : "Your workflow is registered; connect it before activity can be tracked.") : (demo ? "We’ll generate clearly labeled demo activity and a sample budget. Nothing will connect or send data." : "Start with the essentials. You’ll be prompted to connect a provider next.")}</p></div><button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button></div>
      {created ? <div className="mt-5"><div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><Check className="h-4 w-4" />{created.name} {demo ? "has synthetic activity." : "is ready to connect."}</div>{demo ? <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3"><div className="text-sm font-medium text-slate-800">Synthetic sample data</div><p className="mt-1 text-xs leading-5 text-slate-500">Generated locally: ${created.spend?.toFixed(2)} reported spend, ${created.budget?.toFixed(2)} sample budget, and {created.executions} executions. Reset sample removes it; no provider was contacted.</p></div> : <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3"><div className="text-sm font-medium text-slate-800">Next: connect {created.platform}</div><p className="mt-1 text-xs leading-5 text-slate-500">Choose a connector and create a scoped credential before sending activity. Spend and budgets stay empty until connected data arrives.</p></div>}<div className="mt-5 flex gap-2">{!demo && onOpenConnection ? <button type="button" onClick={() => onOpenConnection(created)} className="h-9 flex-1 rounded-md border border-slate-300 text-xs font-semibold text-slate-700">Open connector setup</button> : null}<button type="button" onClick={onClose} className="h-9 flex-1 rounded-md bg-blue-600 text-xs font-semibold text-white">Done</button></div></div> : <form onSubmit={submit} className="mt-5 space-y-4"><label className="block text-xs font-medium text-slate-700">Workflow name<input autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder="Customer support triage" className="mt-1.5 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label><label className="block text-xs font-medium text-slate-700">Where does it run?<select value={platform} onChange={(event) => setPlatform(event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"><option>Zapier</option><option>n8n</option><option>Make</option><option>LangChain</option><option>Custom</option></select></label><label className="block text-xs font-medium text-slate-700">AI model <span className="font-normal text-slate-400">(optional)</span><input value={model} onChange={(event) => setModel(event.target.value)} placeholder="GPT-4o" className="mt-1.5 h-10 w-full rounded-md border border-slate-300 px-3 text-sm" /></label><button type="button" onClick={() => setMore((value) => !value)} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600">More options <ChevronDown className={`h-3.5 w-3.5 transition-transform ${more ? "rotate-180" : ""}`} /></button>{more ? <div className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-2"><label className="text-xs font-medium text-slate-600">Owner<input value={owner} onChange={(event) => setOwner(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm" /></label><label className="text-xs font-medium text-slate-600">Team<input value={team} onChange={(event) => setTeam(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm" /></label></div> : null}<div className="flex gap-2 pt-1"><button type="button" onClick={onClose} className="h-9 flex-1 rounded-md border border-slate-300 text-xs font-semibold text-slate-700">Cancel</button><button type="submit" className="h-9 flex-1 rounded-md bg-blue-600 text-xs font-semibold text-white">Add workflow</button></div></form>}
    </div>
  </div>;
}
