import { describe, expect, it } from "vitest";
import { toFeatureVerdicts, toVerdict, gaveNoVerdict } from "./verdict";

describe("toVerdict", () => {
  it("passes when the run completed and the agent reported passed: true", () => {
    expect(
      toVerdict({ status: "COMPLETED", error: null, result: { passed: true, failed_step: null, reason: "Cart showed 5 seats" } }),
    ).toEqual({ state: "passed", failedStep: null, reason: "Cart showed 5 seats" });
  });

  it("fails, keeping the step and reason, when the agent reported passed: false", () => {
    expect(
      toVerdict({
        status: "COMPLETED",
        error: null,
        result: { passed: false, failed_step: 3, reason: "Total showed $900.00 per year" },
      }),
    ).toEqual({ state: "failed", failedStep: 3, reason: "Total showed $900.00 per year" });
  });

  it("is errored, not passed, when the run completed without a result", () => {
    expect(toVerdict({ status: "COMPLETED", error: null, result: null })).toEqual({
      state: "errored",
      failedStep: null,
      reason: "The agent returned no valid verdict",
      cause: "test_problem",
    });
  });

  it("is errored when the result is missing the passed field", () => {
    expect(toVerdict({ status: "COMPLETED", error: null, result: { reason: "looked fine" } }).state).toBe("errored");
  });

  it("is errored with the platform's message when the run itself failed", () => {
    expect(toVerdict({ status: "FAILED", error: "Site could not be reached", result: null })).toEqual({
      state: "errored",
      failedStep: null,
      reason: "Run FAILED: Site could not be reached",
      cause: "environment",
    });
  });

  it("never trusts a result on a cancelled run", () => {
    const v = toVerdict({ status: "CANCELLED", error: null, result: { passed: true, failed_step: null, reason: "ok" } });
    expect(v.state).toBe("errored");
  });
});

describe("toFeatureVerdicts", () => {
  const ok = (check: number, passed: boolean, observed = "Total $10.00") => ({ check, passed, failed_step: passed ? null : 1, observed, reason: "r" });

  it("gives one verdict per check from one session", () => {
    const v = toFeatureVerdicts({ status: "COMPLETED", error: null, result: { results: [ok(1, true), ok(2, false)] } }, 2);
    expect(v.map((x) => x.state)).toEqual(["passed", "failed"]);
  });

  it("never trusts a pass that quotes nothing it saw", () => {
    const v = toFeatureVerdicts({ status: "COMPLETED", error: null, result: { results: [ok(1, true, "  ")] } }, 1);
    expect(v[0].state).toBe("errored");
  });

  it("errors a check the agent never reported, and every check when the run did not complete", () => {
    expect(toFeatureVerdicts({ status: "COMPLETED", error: null, result: { results: [ok(1, true)] } }, 2).map((x) => x.state)).toEqual(["passed", "errored"]);
    expect(toFeatureVerdicts({ status: "FAILED", error: "boom", result: null }, 2).map((x) => x.state)).toEqual(["errored", "errored"]);
  });
});

describe("gaveNoVerdict", () => {
  const run = (result: Record<string, unknown>) => ({ status: "COMPLETED" as const, error: null, result });
  it("is true when the agent returned an empty list", () => expect(gaveNoVerdict(run({ results: [] }), 2)).toBe(true));
  it("is false when any check has a result", () => {
    expect(gaveNoVerdict(run({ results: [{ check: 1, passed: false, failed_step: 1, observed: "x", reason: "y" }] }), 2)).toBe(false);
  });
  it("is true for a run that failed with no answer, which a rerun can fix", () => expect(gaveNoVerdict({ status: "FAILED", error: "boom", result: null }, 1)).toBe(true));
});
