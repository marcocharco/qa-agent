import { describe, expect, it } from "vitest";
import { checkStatus, claudeCodeSummary, receiptWindow, reportMarkdown, type ReportData } from "./report";

const msgs = Array.from({ length: 7 }, (_, i) => ({ id: `m${i}`, role: i % 2 ? "assistant" : "user", text: `t${i}` }));
const data: ReportData = {
  requirement: "SAVE10 works on Team annual",
  trailTitle: "Annual billing",
  commit: "e4f5a6b9999",
  verdict: "failed",
  reason: "Total stayed at $835.20",
  failedStep: 2,
  steps: ["Open the page", "Apply SAVE10"],
  quote: "SAVE10 has to work on both plans",
};

describe("checkStatus", () => {
  it("lets the verdict decide, then falls back on reason and run state", () => {
    expect(checkStatus({ passed: true, reason: "ok" }, false)).toBe("passed");
    expect(checkStatus({ passed: false, reason: "bad" }, false)).toBe("failed");
    expect(checkStatus({ passed: null, reason: "Run FAILED: timeout" }, false)).toBe("errored");
    expect(checkStatus({ passed: null, reason: null }, false)).toBe("running");
    expect(checkStatus({ passed: null, reason: null }, true)).toBe("errored");
    expect(checkStatus({ passed: null, reason: "Runs disagreed", classification: "flaky" }, true)).toBe("review");
  });
});

describe("receiptWindow", () => {
  it("returns the cited message with its neighbours and clamps at the edges", () => {
    expect(receiptWindow(msgs, "m3").map((m) => m.id)).toEqual(["m1", "m2", "m3", "m4", "m5"]);
    expect(receiptWindow(msgs, "m0").map((m) => m.id)).toEqual(["m0", "m1", "m2"]);
    expect(receiptWindow(msgs, "m3").find((m) => m.highlight)?.id).toBe("m3");
  });
  it("is empty for an unknown message", () => expect(receiptWindow(msgs, "nope")).toEqual([]));
});

describe("reports", () => {
  it("level 1 is the short summary", () => {
    expect(reportMarkdown(data, 1)).not.toContain("Steps to reproduce");
  });
  it("level 2 numbers the steps and marks the failing one", () => {
    const md = reportMarkdown(data, 2);
    expect(md).toContain("1. Open the page\n2. Apply SAVE10 **(fails here)**");
    expect(md).toContain("`e4f5a6b`");
  });
  it("Claude Code summary has the repro and no markdown or instructions", () => {
    const s = claudeCodeSummary(data);
    expect(s).toContain("2. Apply SAVE10  <- fails here");
    expect(s).not.toContain("**");
  });
});
