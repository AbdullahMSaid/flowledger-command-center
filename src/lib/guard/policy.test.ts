import { describe, expect, it } from "vitest";
import { evaluateGuardBudget } from "./policy";

describe("guard budget policy", () => {
  it("allows an exact boundary and denies one cent over", () => {
    const base = { monthlyCap: 10, dailyCap: null, monthlySpent: 7, dailySpent: 0, outstandingReservations: 1, flowEnabled: true as const };
    expect(evaluateGuardBudget({ ...base, requestedMaxCost: 2 }).allowed).toBe(true);
    expect(evaluateGuardBudget({ ...base, requestedMaxCost: 2.01 })).toMatchObject({ allowed: false, reason: "budget_exceeded" });
  });

  it("treats null as unlimited and zero as a real cap", () => {
    expect(evaluateGuardBudget({ monthlyCap: null, dailyCap: null, monthlySpent: 500, dailySpent: 500, outstandingReservations: 0, requestedMaxCost: 50 }).allowed).toBe(true);
    expect(evaluateGuardBudget({ monthlyCap: 0, dailyCap: null, monthlySpent: 0, dailySpent: 0, outstandingReservations: 0, requestedMaxCost: 0 }).allowed).toBe(true);
    expect(evaluateGuardBudget({ monthlyCap: 0, dailyCap: null, monthlySpent: 0, dailySpent: 0, outstandingReservations: 0, requestedMaxCost: 0.01 }).reason).toBe("budget_exceeded");
  });

  it("keeps the emergency stop latched against ordinary resume", () => {
    expect(evaluateGuardBudget({ monthlyCap: 10, dailyCap: null, monthlySpent: 0, dailySpent: 0, outstandingReservations: 0, requestedMaxCost: 1, controlState: "emergency_stopped" })).toMatchObject({ allowed: false, reason: "emergency_stopped" });
  });
});
