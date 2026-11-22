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
  it("drops looks in the middle and keeps the final one as the result", () => {
    const g = collapseSteps(fr("Understand current page state", "Select the Team plan", "Check if Team plan is selected after click", "Set seats to 9", "Check final state", "Recheck final state"));
    expect(g.map((x) => x.label)).toEqual(["Select the Team plan", "Set seats to 9", "Read the result"]);
    expect(g[2].file).toBe("f5.png");
  });
  it("drops the agent wrapping up", () => {
    expect(collapseSteps(fr("Select Team plan", "Check final state", "Finish result", "Task completed")).map((g) => g.label)).toEqual(["Select Team plan", "Read the result"]);
  });
  it("drops a reload that trails the last read", () => {
    expect(collapseSteps(fr("Select Team plan", "Check final state", "Reload page fresh")).map((g) => g.label)).toEqual(["Select Team plan", "Read the result"]);
  });
  it("keeps only the first reload or navigation", () => {
    expect(collapseSteps(fr("Navigate to the page", "Select Team plan", "Reload page fresh", "Set seats to 10", "Check final state")).map((g) => g.label)).toEqual(["Open the page", "Select Team plan", "Set seats to 10", "Read the result"]);
  });
  it("keeps different actions apart and strips check bookkeeping", () => {
    expect(collapseSteps(fr("Reload page for CHECK 2 fresh state", "Select Team plan for Check 2")).map((g) => g.label)).toEqual(["Open the page", "Select Team plan"]);
  });
});
