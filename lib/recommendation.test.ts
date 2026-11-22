import { describe, expect, it } from "vitest";
import { recommend } from "./recommendation";

const base = { total: 8, passed: 8, failed: 0, needsReview: 0, errored: 0, failures: [] };

describe("recommend", () => {
  it("is safe only when everything passes", () => expect(recommend(base).verdict).toBe("merge"));
  it("holds on a confirmed failure and lists it", () => {
    const r = recommend({ ...base, passed: 6, failed: 2, failures: [{ text: "Team 10 seats gets 5% off", reason: "x" }] });
    expect(r.verdict).toBe("hold");
    expect(r.text).toContain("Team 10 seats gets 5% off");
  });
  it("asks for review, not a hold, when results are only flaky or missing", () => {
    expect(recommend({ ...base, passed: 6, needsReview: 1, errored: 1 }).verdict).toBe("review");
  });
});
