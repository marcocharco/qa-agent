import { describe, expect, it } from "vitest";
import { needsSecondRun, needsThirdRun, reconcile, reconcileThree } from "./confirm";
import type { Verdict } from "./verdict";

const pass: Verdict = { state: "passed", failedStep: null, reason: "ok" };
const fail: Verdict = { state: "failed", failedStep: 2, reason: "saw $290" };
const err: Verdict = { state: "errored", failedStep: null, reason: "no result", cause: "test_problem" };
const down: Verdict = { state: "errored", failedStep: null, reason: "timeout", cause: "environment" };

describe("reconcile", () => {
  it("a first pass is final and needs no second run", () => {
    expect(needsSecondRun(pass)).toBe(false);
    expect(reconcile(pass, null).state).toBe("passed");
  });
  it("files a bug only when two runs fail", () => {
    expect(needsSecondRun(fail)).toBe(true);
    expect(reconcile(fail, fail)).toMatchObject({ state: "failed", classification: "bug", failedStep: 2 });
  });
  it("a failure that flips on the second run is needs_review, never a finding", () => {
    expect(reconcile(fail, pass).state).toBe("needs_review");
    expect(reconcile(pass, fail).state).toBe("passed");
    expect(reconcile(err, fail).state).toBe("needs_review");
  });
  it("keeps the cause when neither run produced a verdict", () => {
    expect(reconcile(err, err)).toMatchObject({ state: "errored", classification: "test_problem" });
    expect(reconcile(down, down)).toMatchObject({ state: "errored", classification: "environment" });
  });

  it("an errored first run is not an answer: a later pass is simply a pass", () => {
    expect(reconcile(err, pass).state).toBe("passed");
    expect(reconcile(down, pass).state).toBe("passed");
  });
  it("a real failure against a later pass is still a disagreement", () => {
    expect(reconcile(fail, pass).state).toBe("needs_review");
  });

  it("one run errored and one failed: a third run decides", () => {
    expect(needsThirdRun(err, fail)).toBe(true);
    expect(needsThirdRun(fail, err)).toBe(true);
    expect(needsThirdRun(fail, fail)).toBe(false);
    expect(needsThirdRun(err, pass)).toBe(false);
  });
  it("errors are not votes when there are three runs", () => {
    expect(reconcileThree(err, fail, fail).state).toBe("failed");
    expect(reconcileThree(fail, err, fail).state).toBe("failed");
    expect(reconcileThree(err, fail, pass).state).toBe("needs_review");
    expect(reconcileThree(fail, err, err).state).toBe("needs_review");
    expect(reconcileThree(err, err, err).state).toBe("errored");
  });
});
