import { describe, expect, it } from "vitest";
import { segmentSteps } from "./replay";

const actions = [
  "Navigate to the page", "Check current state before Check 1", "Switch to Annual for Check 1", "Read prices for Check 1",
  "Reload the page", "Set seats for Check 2", "Read prices for Check 2", "Report results",
];

describe("segmentSteps", () => {
  it("returns the steps of one check", () => {
    expect(segmentSteps(actions, 1)).toEqual({ start: 1, end: 3 });
  });
  it("ends the last check at the final step", () => {
    expect(segmentSteps(actions, 2)).toEqual({ start: 5, end: 6 });
  });
  it("falls back to the whole session when the agent did not label its steps", () => {
    expect(segmentSteps(["a", "b", "c"], 1)).toEqual({ start: 0, end: 2 });
    expect(segmentSteps(actions, 9)).toEqual({ start: 0, end: 7 });
  });
});
