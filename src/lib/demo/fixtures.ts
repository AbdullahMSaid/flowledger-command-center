export type ProtectionMode = "Guard connected" | "Monitor only";
export type DemoAgentState = "Healthy" | "Warning" | "Blocked" | "Paused";

export type DemoAgent = {
  id: string;
  name: string;
  description: string;
  owner: string;
  team: string;
  platform: string;
  model: string;
  protection: ProtectionMode;
  todayCost: number;
  budget: number;
  baselinePerMinute: number;
  normalCallsPerMinute: number;
};

export type DemoPolicy = {
  channelScope: "All channels" | "Priority channels only";
  checksPerHour: number;
};

export type ReplayStage = "idle" | "baseline" | "rising" | "detected" | "blocked" | "resolved";

export type DemoSnapshot = {
  stage: ReplayStage;
  virtualTime: string;
  elapsedSeconds: number;
  currentCallsPerMinute: number;
  currentSpendPerMinute: number;
  baselineSpendPerMinute: number;
  projectedDailySpend: number;
  outOfOfficeCost: number;
  totalCost: number;
  blockedRequests: number;
  warningVisible: boolean;
  requestBlocked: boolean;
  canInspectIncident: boolean;
};

export const demoAgents: DemoAgent[] = [
  {
    id: "out-of-office",
    name: "Out-of-office responder",
    description: "Scans shared channels and drafts replies for away teammates.",
    owner: "Maya Chen",
    team: "People Ops",
    platform: "Make.com",
    model: "GPT-4o mini",
    protection: "Guard connected",
    todayCost: 0.42,
    budget: 0.88,
    baselinePerMinute: 0.012,
    normalCallsPerMinute: 2,
  },
  {
    id: "invoice-extraction",
    name: "Invoice extraction",
    description: "Reads vendor invoices and prepares structured entries.",
    owner: "Jordan Lee",
    team: "Finance Ops",
    platform: "n8n",
    model: "Claude 3.5 Haiku",
    protection: "Monitor only",
    todayCost: 1.86,
    budget: 12,
    baselinePerMinute: 0.041,
    normalCallsPerMinute: 1,
  },
  {
    id: "support-triage",
    name: "Support triage",
    description: "Classifies inbound tickets and routes urgent issues.",
    owner: "Ari Patel",
    team: "Customer Support",
    platform: "Zapier",
    model: "GPT-4o",
    protection: "Guard connected",
    todayCost: 3.24,
    budget: 18,
    baselinePerMinute: 0.062,
    normalCallsPerMinute: 3,
  },
];

export const defaultDemoPolicy: DemoPolicy = {
  channelScope: "All channels",
  checksPerHour: 24,
};

export const DEMO_START_TIME = new Date("2026-09-17T14:00:00Z");
export const DEMO_DURATION_SECONDS = 48;

const money = (value: number) => Math.round(value * 100) / 100;

export function getDemoSnapshot(elapsedSeconds: number, policy: DemoPolicy, manuallyResumed: boolean): DemoSnapshot {
  const elapsed = Math.max(0, Math.min(DEMO_DURATION_SECONDS, Math.floor(elapsedSeconds)));
  const adjusted = policy.channelScope === "Priority channels only" && policy.checksPerHour <= 12;
  const resolved = manuallyResumed && adjusted;

  let stage: ReplayStage = "idle";
  if (elapsed > 0 && elapsed < 12) stage = "baseline";
  if (elapsed >= 12 && elapsed < 26) stage = "rising";
  if (elapsed >= 26 && elapsed < 34) stage = "detected";
  if (elapsed >= 34 && !resolved) stage = "blocked";
  if (resolved && elapsed >= 34) stage = "resolved";

  const isRising = stage === "rising" || stage === "detected" || stage === "blocked";
  const isBlocked = stage === "blocked";
  const callsPerMinute = resolved ? 4 : isRising ? 26 : 2;
  const spendPerMinute = resolved ? 0.018 : isRising ? 0.42 : 0.012;
  const risingSeconds = Math.max(0, Math.min(elapsed, 34) - 12);
  const postDecisionSeconds = Math.max(0, elapsed - 34);
  const outOfOfficeCost = money(
    0.42 +
    risingSeconds * (0.42 / 60) +
    postDecisionSeconds * (resolved ? 0.018 / 60 : isBlocked ? 0 : 0.42 / 60),
  );
  const totalCost = money(demoAgents.reduce((sum, agent) => sum + agent.todayCost, 0) - demoAgents[0].todayCost + outOfOfficeCost);

  return {
    stage,
    virtualTime: new Date(DEMO_START_TIME.getTime() + elapsed * 1000).toISOString(),
    elapsedSeconds: elapsed,
    currentCallsPerMinute: callsPerMinute,
    currentSpendPerMinute: spendPerMinute,
    baselineSpendPerMinute: demoAgents[0].baselinePerMinute,
    projectedDailySpend: money(spendPerMinute * 60 * 24),
    outOfOfficeCost,
    totalCost,
    blockedRequests: isBlocked || resolved ? 7 : 0,
    warningVisible: stage === "detected" || isBlocked,
    requestBlocked: isBlocked,
    canInspectIncident: stage === "detected" || isBlocked || stage === "resolved",
  };
}

export function formatDemoTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
  }).format(new Date(iso)) + " UTC";
}
