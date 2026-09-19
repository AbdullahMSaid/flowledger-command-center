import { describe, expect, it } from "vitest";
import { calculateValueMetrics } from "./value";

describe("calculateValueMetrics", () => {
  it("calculates the documented value multiple and net return", () => {
    const result = calculateValueMetrics(5000, 720);
    expect(result.multiple).toBeCloseTo(6.9444, 3);
    expect(result.netReturnPercent).toBeCloseTo(594.44, 2);
  });

  it("does not invent ROI for missing or zero cost", () => {
    expect(calculateValueMetrics(null, 720)).toEqual({ multiple: null, netReturnPercent: null });
    expect(calculateValueMetrics(5000, 0)).toEqual({ multiple: null, netReturnPercent: null });
  });
});
