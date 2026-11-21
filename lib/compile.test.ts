import { describe, expect, it } from "vitest";
import { compileRequirement, renderGoal, type StructuredModel } from "./compile";

const req = { id: "r1", text: "The cart should survive a page refresh" };

describe("compileRequirement", () => {
  it("turns a testable requirement into a strict goal with stop rules", async () => {
    const model: StructuredModel = async () => ({
      testable: true,
      preconditions: ["Start with an empty cart"],
      steps: ["Add the first product to the cart", "Reload the page"],
      expected: "The cart still shows 1 item",
    });

    const result = await compileRequirement(req, model);

    expect(result.testable).toBe(true);
    if (!result.testable) return;
    expect(result.goal).toContain("1. Add the first product to the cart");
    expect(result.goal).toContain("2. Reload the page");
    expect(result.goal).toContain("Expected result: The cart still shows 1 item");
    expect(result.goal).toContain("stop and report which step failed");
    expect(result.goal).toContain("Set failed_step to null if every step passed");
    expect(result.goal).toContain("Start with an empty cart");
  });

  it("marks a requirement untestable with the reason and builds no goal", async () => {
    const model: StructuredModel = async () => ({
      testable: false,
      reason: "'Smoother' is subjective and has no observable outcome",
    });

    const result = await compileRequirement(
      { id: "r2", text: "Make checkout feel smoother" },
      model,
    );

    expect(result).toEqual({
      testable: false,
      reason: "'Smoother' is subjective and has no observable outcome",
    });
  });
});

describe("renderGoal", () => {
  it("numbers steps from 1 and never invents steps", () => {
    const goal = renderGoal({ preconditions: [], steps: ["A", "B", "C"], expected: "X" });
    expect(goal).toMatch(/1\. A\n2\. B\n3\. C/);
  });
});
