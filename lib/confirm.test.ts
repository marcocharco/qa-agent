import { describe, expect, it } from "vitest";
import { needsSecondRun, reconcile } from "./confirm";
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
  it("an errored check that passes on retry is trusted as flaky, not as a pass", () => {
    expect(reconcile(err, pass).state).toBe("needs_review");
  });
  it("keeps the cause when neither run produced a verdict", () => {
    expect(reconcile(err, err)).toMatchObject({ state: "errored", classification: "test_problem" });
    expect(reconcile(down, down)).toMatchObject({ state: "errored", classification: "environment" });
  });
});
