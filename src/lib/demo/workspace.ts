import { useCallback, useState } from "react";
import type { OperationsFlow } from "@/components/dashboard/OperationsDashboard";
import { demoAgents } from "@/lib/demo/fixtures";

export type SampleMode = "demo" | "preview";
export type SampleReviewStatus = "Needs review" | "Approved" | "Not needed";

export type SampleFlow = OperationsFlow & {
  description: string;
  environment: "In use" | "Trial" | "Testing";
  executions: number;
  reviewStatus: SampleReviewStatus;
  nextReview?: string;
  issue?: string;
  activityNote: string;
  baseSpend: number;
  baseExecutions: number;
};

export type SampleScenario = "baseline" | "week" | "month";
export type SampleWorkspace = { flows: SampleFlow[]; scenario?: SampleScenario };

const storageKey = (mode: SampleMode) => `flowledger.sample-workspace.${mode}.v1`;

const seedWorkspace = (): SampleWorkspace => ({
  flows: demoAgents.map((agent, index): SampleFlow => ({
    id: agent.id,
    name: agent.name,
    description: agent.description,
    owner: agent.owner,
    team: agent.team,
    platform: agent.platform,
    model: agent.model,
    status: index === 0 ? "Needs attention" : "Live",
    spend: agent.todayCost,
    budget: agent.budget,
    protection: agent.protection === "Guard connected" ? "Budget protection connected" : "Tracking only",
    environment: index === 1 ? "Trial" : "In use",
    executions: [7, 5, 6][index],
    reviewStatus: index === 1 ? "Needs review" : "Approved",
    nextReview: index === 1 ? "Sep 30" : undefined,
    issue: index === 0 ? "Spending rose much faster than usual. The next AI call was blocked for review." : undefined,
    activityNote: index === 0 ? "One protected call was blocked before it started." : "Activity was received in the selected period.",
    baseSpend: agent.todayCost,
    baseExecutions: [7, 5, 6][index],
  })),
});

const isWorkspace = (value: unknown): value is SampleWorkspace => Boolean(value && typeof value === "object" && Array.isArray((value as SampleWorkspace).flows));

const normalizeWorkspace = (workspace: SampleWorkspace): SampleWorkspace => ({
  ...workspace,
  flows: workspace.flows.map((flow) => ({
    ...flow,
    baseSpend: Number.isFinite(flow.baseSpend) ? flow.baseSpend : flow.spend ?? 0,
    baseExecutions: Number.isFinite(flow.baseExecutions) ? flow.baseExecutions : flow.executions ?? 0,
  })),
});

export const loadSampleWorkspace = (mode: SampleMode): SampleWorkspace => {
  if (typeof window === "undefined") return seedWorkspace();
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey(mode)) ?? "null");
    if (isWorkspace(stored)) return normalizeWorkspace(stored);
  } catch {
    // Invalid local preview data should never block the product surface.
  }
  return seedWorkspace();
};

export const saveSampleWorkspace = (mode: SampleMode, workspace: SampleWorkspace) => {
  if (typeof window !== "undefined") window.localStorage.setItem(storageKey(mode), JSON.stringify(workspace));
};

export const resetSampleWorkspace = (mode: SampleMode) => {
  if (typeof window !== "undefined") window.localStorage.removeItem(storageKey(mode));
  return seedWorkspace();
};

export const sampleWorkspaceMetrics = (workspace: SampleWorkspace) => ({
  spend: workspace.flows.reduce((total, flow) => total + (flow.spend ?? 0), 0),
  activeFlows: workspace.flows.filter((flow) => flow.status !== "Archived").length,
  executions: workspace.flows.reduce((total, flow) => total + flow.executions, 0),
  issueCount: workspace.flows.filter((flow) => Boolean(flow.issue)).length,
  reviewCount: workspace.flows.filter((flow) => flow.reviewStatus === "Needs review").length,
});

export const sampleScenarioLabel = (scenario: SampleScenario | undefined) => scenario === "week" ? "Simulated 1 week" : scenario === "month" ? "Simulated 1 month" : "Last 7 days";

export const simulateSampleWorkspace = (workspace: SampleWorkspace, scenario: Exclude<SampleScenario, "baseline">): SampleWorkspace => {
  const multiplier = scenario === "week" ? 3 : 12;
  return {
    scenario,
    flows: workspace.flows.map((flow) => ({
      ...flow,
      spend: Math.round(flow.baseSpend * multiplier * 100) / 100,
      executions: flow.baseExecutions * multiplier,
      status: flow.id === "out-of-office" ? "Needs attention" : flow.status === "No activity yet" ? "No activity yet" : "Live",
      issue: flow.id === "out-of-office" ? "Illustrative activity exceeded this workflow’s budget. Review the example protection decision before allowing new calls." : flow.issue,
      activityNote: `Loaded the illustrative ${scenario === "week" ? "one-week" : "one-month"} activity scenario. No live telemetry was created.`,
    })),
  };
};

export function useSampleWorkspace(mode: SampleMode) {
  const [workspace, setWorkspace] = useState<SampleWorkspace>(() => loadSampleWorkspace(mode));
  const update = useCallback((updater: (current: SampleWorkspace) => SampleWorkspace) => {
    setWorkspace((current) => {
      const next = updater(current);
      saveSampleWorkspace(mode, next);
      return next;
    });
  }, [mode]);
  const reset = useCallback(() => {
    const next = resetSampleWorkspace(mode);
    setWorkspace(next);
  }, [mode]);
  return { workspace, update, reset };
}

type NewSampleFlowValues = Pick<SampleFlow, "name" | "platform" | "model" | "owner" | "team">;

const scenarioMultiplier = (scenario: SampleScenario | undefined) => scenario === "week" ? 3 : scenario === "month" ? 12 : 1;

const sampleNumber = (value: string) => [...value].reduce((total, character) => ((total * 31) + character.charCodeAt(0)) >>> 0, 17);

export const createSampleFlow = (values: NewSampleFlowValues, mode: SampleMode, scenario?: SampleScenario): SampleFlow => {
  const id = `sample-${Date.now()}`;
  if (mode === "demo") {
    const seed = sampleNumber(`${values.name}:${values.platform}:${values.model}`);
    const budget = 24 + (seed % 77);
    const baseSpend = Math.round((budget * (0.24 + ((seed >>> 4) % 52) / 100)) * 100) / 100;
    const baseExecutions = 9 + (seed % 38);
    const multiplier = scenarioMultiplier(scenario);
    return {
      id,
      name: values.name,
      description: "Illustrative workflow created in the demo workspace.",
      owner: values.owner || "Demo owner",
      team: values.team || "Operations",
      platform: values.platform,
      model: values.model || "Not specified",
      status: "Live",
      spend: Math.round(baseSpend * multiplier * 100) / 100,
      budget,
      protection: "Budget protection connected",
      environment: "In use",
      executions: baseExecutions * multiplier,
      reviewStatus: "Approved",
      activityNote: "Synthetic demo activity was generated locally. No provider was connected or contacted.",
      baseSpend,
      baseExecutions,
    };
  }

  return {
    id,
    name: values.name,
    description: "New workflow awaiting its first connected activity.",
    owner: values.owner || "Unassigned",
    team: values.team,
    platform: values.platform,
    model: values.model || "Not specified",
    status: "No activity yet",
    spend: 0,
    budget: null,
    protection: "Tracking only",
    environment: "Trial",
    executions: 0,
    reviewStatus: "Needs review",
    nextReview: "Choose during review",
    activityNote: "No activity has been received yet. Connect a provider to begin tracking.",
    baseSpend: 0,
    baseExecutions: 0,
  };
};
