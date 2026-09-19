import { describe, expect, it } from "vitest";
import { createSampleFlow } from "./workspace";

describe("sample workflow creation", () => {
  const values = { name: "Approvals assistant", platform: "Zapier", model: "GPT-4o", owner: "", team: "" };

  it("generates clearly synthetic financial activity for the public demo", () => {
    const flow = createSampleFlow(values, "demo", "week");
    expect(flow.spend).toBeGreaterThan(0);
    expect(flow.budget).toBeGreaterThan(0);
    expect(flow.executions).toBeGreaterThan(0);
    expect(flow.activityNote).toContain("Synthetic demo activity");
  });

  it("leaves signed-in preview workflows empty until they are connected", () => {
    const flow = createSampleFlow(values, "preview");
    expect(flow.spend).toBe(0);
    expect(flow.budget).toBeNull();
    expect(flow.executions).toBe(0);
    expect(flow.activityNote).toContain("Connect a provider");
  });
});
