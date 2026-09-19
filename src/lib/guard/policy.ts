export type GuardDecisionReason = "approved" | "paused" | "emergency_stopped" | "archived" | "budget_exceeded" | "daily_budget_exceeded";

export type GuardDecision = {
  allowed: boolean;
  reason: GuardDecisionReason;
  remainingBudgetUsd: number | null;
};

export function evaluateGuardBudget(input: {
  monthlyCap: number | null;
  dailyCap: number | null;
  monthlySpent: number;
  dailySpent: number;
  outstandingReservations: number;
  requestedMaxCost: number;
  flowEnabled?: boolean;
  controlState?: "running" | "paused" | "emergency_stopped";
  archived?: boolean;
}): GuardDecision {
  const {
    monthlyCap,
    dailyCap,
    monthlySpent,
    dailySpent,
    outstandingReservations,
    requestedMaxCost,
    flowEnabled = true,
    controlState = "running",
    archived = false,
  } = input;
  const cap = monthlyCap ?? dailyCap;
  const used = monthlyCap !== null ? monthlySpent : dailySpent;
  const remainingBudgetUsd = cap === null ? null : Math.max(cap - used - outstandingReservations, 0);

  if (archived) return { allowed: false, reason: "archived", remainingBudgetUsd };
  if (controlState === "emergency_stopped") return { allowed: false, reason: "emergency_stopped", remainingBudgetUsd };
  if (!flowEnabled || controlState !== "running") return { allowed: false, reason: "paused", remainingBudgetUsd };
  if (monthlyCap !== null && monthlySpent + outstandingReservations + requestedMaxCost > monthlyCap) {
    return { allowed: false, reason: "budget_exceeded", remainingBudgetUsd };
  }
  if (dailyCap !== null && dailySpent + outstandingReservations + requestedMaxCost > dailyCap) {
    return { allowed: false, reason: "daily_budget_exceeded", remainingBudgetUsd };
  }
  return { allowed: true, reason: "approved", remainingBudgetUsd };
}
