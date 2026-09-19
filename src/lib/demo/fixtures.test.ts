import { describe, expect, it } from "vitest";
import { defaultDemoPolicy, getDemoSnapshot } from "./fixtures";

describe("demo replay", () => {
  it("is deterministic and progresses through the explainable stages", () => {
    expect(getDemoSnapshot(0, defaultDemoPolicy, false)).toEqual(getDemoSnapshot(0, defaultDemoPolicy, false));
    expect(getDemoSnapshot(15, defaultDemoPolicy, false).stage).toBe("rising");
    expect(getDemoSnapshot(28, defaultDemoPolicy, false).warningVisible).toBe(true);
    expect(getDemoSnapshot(40, defaultDemoPolicy, false).requestBlocked).toBe(true);
  });

  it("only resolves after both policy adjustment and explicit resume", () => {
    const saferPolicy = { channelScope: "Priority channels only" as const, checksPerHour: 12 };
    expect(getDemoSnapshot(40, saferPolicy, false).stage).toBe("blocked");
    expect(getDemoSnapshot(40, saferPolicy, true).stage).toBe("resolved");
    expect(getDemoSnapshot(40, saferPolicy, true).outOfOfficeCost).toBeGreaterThan(0.42);
    expect(getDemoSnapshot(40, saferPolicy, true).blockedRequests).toBe(7);
    expect(getDemoSnapshot(40, saferPolicy, true).outOfOfficeCost).toBeGreaterThanOrEqual(
      getDemoSnapshot(34, defaultDemoPolicy, false).outOfOfficeCost,
    );
  });
});
