import { describe, expect, it } from "vitest";
import { decideFindings, overrideFinding, type CheckResult } from "./findings";

const fail: CheckResult = {
  requirementId: "r1",
  requirementText: "The cart survives a page refresh",
  passed: false,
  failedStep: 2,
  reason: "After reload the cart showed 0 items",
};
const pass: CheckResult = { ...fail, passed: true, failedStep: null, reason: "Cart showed 1 item" };

describe("decideFindings", () => {
  it("creates one finding for a newly failing requirement", () => {
    const actions = decideFindings({}, [fail]);

    expect(actions).toEqual([
      {
        kind: "create",
        requirementId: "r1",
        title: "The cart survives a page refresh",
        body: "Failed at step 2: After reload the cart showed 0 items",
      },
    ]);
  });

  it("does not duplicate a finding that is already open", () => {
    expect(decideFindings({ r1: "f-9" }, [fail])).toEqual([]);
  });

  it("auto-resolves an open finding when the requirement passes again", () => {
    expect(decideFindings({ r1: "f-9" }, [pass])).toEqual([
      { kind: "resolve", requirementId: "r1", findingId: "f-9", message: "Passed on re-run: Cart showed 1 item" },
    ]);
  });

  it("does nothing for a requirement that passes with no open finding", () => {
    expect(decideFindings({}, [pass])).toEqual([]);
  });
});

describe("overrideFinding", () => {
  it("'not a bug' resolves the finding and keeps the requirement active", () => {
    expect(overrideFinding("not-a-bug", { requirementId: "r1", findingId: "f-9" })).toEqual({
      resolve: { findingId: "f-9", message: "Overridden by reviewer: not a bug in this run" },
      requirementStatus: null,
      removeFromBrain: false,
    });
  });

  it("'requirement is wrong' resolves the finding, rejects the requirement and clears Brain", () => {
    expect(overrideFinding("requirement-wrong", { requirementId: "r1", findingId: "f-9" })).toEqual({
      resolve: { findingId: "f-9", message: "Overridden by reviewer: the requirement is wrong" },
      requirementStatus: "rejected",
      removeFromBrain: true,
    });
  });
});
