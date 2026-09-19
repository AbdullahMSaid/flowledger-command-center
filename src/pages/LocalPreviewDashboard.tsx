import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "@/components/app/AppShell";
import OperationsDashboard from "@/components/dashboard/OperationsDashboard";
import SampleAddWorkflowDialog from "@/components/dashboard/SampleAddWorkflowDialog";
import { sampleScenarioLabel, sampleWorkspaceMetrics, simulateSampleWorkspace, useSampleWorkspace } from "@/lib/demo/workspace";
import { useAuth } from "@/hooks/useAuth";

const baseChartData = [{ label: "Mon", cost: .52 }, { label: "Tue", cost: .74 }, { label: "Wed", cost: .66 }, { label: "Thu", cost: 1.08 }, { label: "Fri", cost: 1.21 }, { label: "Sat", cost: .59 }, { label: "Sun", cost: .72 }];

export default function LocalPreviewDashboard() {
  const { signOut } = useAuth(false); const navigate = useNavigate(); const { workspace, update, reset } = useSampleWorkspace("preview"); const [adding, setAdding] = useState(false); const [simulating, setSimulating] = useState(false); const [simulationStatus, setSimulationStatus] = useState<string | null>(null); const metrics = sampleWorkspaceMetrics(workspace); const multiplier = workspace.scenario === "week" ? 3 : workspace.scenario === "month" ? 12 : 1; const chartData = baseChartData.map((point) => ({ ...point, cost: point.cost * multiplier }));
  const simulate = (period: "week" | "month") => { if (simulating) return; setSimulating(true); update((current) => simulateSampleWorkspace(current, period)); setSimulationStatus(`Loaded the illustrative ${period === "week" ? "one-week" : "one-month"} scenario.`); window.setTimeout(() => setSimulating(false), 350); };
  return <AppShell workspaceLabel="Preview account" userLabel="test@gmail.com" preview onSignOut={signOut} onReset={reset}><OperationsDashboard scopeLabel="Preview account · test@gmail.com" periodLabel={sampleScenarioLabel(workspace.scenario)} spend={metrics.spend} activeFlows={metrics.activeFlows} runCount={metrics.executions} issueCount={metrics.issueCount} flows={workspace.flows} chartData={chartData} onAddFlow={() => setAdding(true)} onSelectFlow={(id) => navigate(`/flows/${id}`)} attentionPath="/flows/out-of-office" onSimulate={simulate} simulationStatus={simulationStatus} simulating={simulating} preview />{adding ? <SampleAddWorkflowDialog mode="preview" onClose={() => setAdding(false)} onAdd={(flow) => update((current) => ({ ...current, flows: [flow, ...current.flows] }))} onOpenConnection={(flow) => { setAdding(false); navigate(`/flows/${flow.id}?tab=settings`); }} /> : null}</AppShell>;
}
