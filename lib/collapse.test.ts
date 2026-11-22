import { describe, expect, it } from "vitest";
import { collapseSteps, type Frame } from "./collapse";

const fr = (...a: string[]): Frame[] => a.map((action, i) => ({ action, durationS: 1, file: `f${i}.png` }));

describe("collapseSteps", () => {
  it("merges repeated increments into one step", () => {
    const g = collapseSteps(fr("CHECK 1 step 3: Increase Team seats from 3 to 4", "CHECK 1 step 3: Increase Team seats to 5", "CHECK 1 step 3: Increase Team seats to 6"));
    expect(g).toHaveLength(1);
    expect(g[0].label).toBe("Increase Team seats from 3 to 6");
    expect(g[0].durationS).toBe(3);
    expect(g[0].file).toBe("f2.png");
  });
  it("counts repeats when there is no starting number", () => {
    expect(collapseSteps(fr("Increase Team seats to 4", "Increase Team seats to 5"))[0].label).toBe("Increase Team seats to 5 (×2)");
  });
  it("merges consecutive looks and keeps the last label", () => {
    const g = collapseSteps(fr("Select the Team plan", "Check if Team plan is selected after click", "Visual check of page", "Set seats to 9"));
    expect(g.map((x) => x.label)).toEqual(["Select the Team plan", "Visual check of page", "Set seats to 9"]);
  });
  it("keeps different actions apart and strips check bookkeeping", () => {
    expect(collapseSteps(fr("Reload page for CHECK 2 fresh state", "Select Team plan for Check 2")).map((g) => g.label)).toEqual(["Reload page fresh state", "Select Team plan"]);
  });
});
