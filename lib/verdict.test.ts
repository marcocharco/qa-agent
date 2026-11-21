import { describe, expect, it } from "vitest";
import { toVerdict } from "./verdict";

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
    });
  });

  it("never trusts a result on a cancelled run", () => {
    const v = toVerdict({ status: "CANCELLED", error: null, result: { passed: true, failed_step: null, reason: "ok" } });
    expect(v.state).toBe("errored");
  });
});
