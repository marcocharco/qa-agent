import { describe, expect, it } from "vitest";
import { buildCards, defaultCard, groupByFeature, groupState, shortLabel, splitReason, summarize, verdictOf } from "./overview";
import type { CheckRow, Live, RequirementRow } from "./queries";

const req = (id: string, o: Partial<RequirementRow> = {}): RequirementRow =>
  ({ id, trailId: "t", trailTitle: "T", text: `Req ${id}: details`, type: "behaviour", confidence: 0.9, testable: true, untestableReason: null, status: "approved", sourceKind: "session", quote: null, edited: false, feature: null, supersedes: null, ...o });
const chk = (requirementId: string, status: CheckRow["status"], o: Partial<CheckRow> = {}): CheckRow =>
  ({ id: `c-${requirementId}`, requirementId, requirement: "", status, reason: null, failedStep: null, streamingUrl: null, durationMs: null, ...o });
const live = (checks: CheckRow[], finished = true): Live => ({ newestBroken: false, run: { id: "r", headSha: "x", startedAt: "2026-01-01T00:00:00Z", finishedAt: finished ? "2026-01-01T00:01:00Z" : null }, checks });

describe("buildCards", () => {
  it("a check wins over the requirement's own status, and untestable or rejected asks are left out", () => {
    const cards = buildCards([req("a"), req("b", { status: "proposed" }), req("c", { testable: false }), req("d", { status: "rejected" })], [req("r1")], live([chk("a", "failed")]));
    expect(cards.map((c) => [c.req.id, c.state, c.regression])).toEqual([["a", "failed", false], ["b", "proposed", false], ["r1", "todo", true]]);
  });
});

describe("verdictOf", () => {
  it("is idle before any run and running while a run is open", () => {
    expect(verdictOf([], { run: null, checks: [], newestBroken: false })).toBe("idle");
    expect(verdictOf(buildCards([req("a")], [], live([chk("a", "running")], false)), live([chk("a", "running")], false))).toBe("running");
  });
  it("a finished run that tested nothing is broken, never all clear", () => {
    const l = live([]);
    expect(verdictOf(buildCards([req("a")], [], l), l)).toBe("broken");
  });
  it("holds on a failure, asks for review on flaky, clears when all pass", () => {
    const v = (s: CheckRow["status"]) => { const l = live([chk("a", s)]); return verdictOf(buildCards([req("a")], [], l), l); };
    expect([v("failed"), v("review"), v("passed")]).toEqual(["hold", "review", "merge"]);
  });
});

describe("groups", () => {
  it("one state stands for a group, worst first", () => {
    const l = live([chk("a", "passed"), chk("b", "failed"), chk("c", "running", { streamingUrl: "https://s" })]);
    const cards = buildCards([req("a", { feature: "F" }), req("b", { feature: "F" }), req("c", { feature: "G" })], [], l);
    expect(groupState(cards.slice(0, 2))).toBe("failed");
    const g = groupByFeature(cards);
    expect(g.map((x) => [x.feature, x.state, x.streamingUrl])).toEqual([["F", "failed", null], ["G", "running", "https://s"]]);
  });
  it("opens on what needs you", () => {
    const l = live([chk("a", "passed"), chk("b", "failed")]);
    expect(defaultCard(buildCards([req("a"), req("b")], [], l))?.req.id).toBe("b");
    expect(summarize(buildCards([req("a"), req("b")], [], l)).failed).toBe(1);
  });
});

describe("text helpers", () => {
  it("shortens to the first clause", () => {
    expect(shortLabel("Team gets 5% off the subtotal at 10 or more seats: Team at 10 seats has x")).toBe("Team gets 5% off the subtotal at 10 or more...");
    expect(shortLabel("The billing toggle works.")).toBe("Billing toggle works.");
  });
  it("splits the observed text from the reason", () => {
    expect(splitReason("It differed. Saw: Total $290.00")).toEqual({ claim: "It differed.", saw: "Total $290.00" });
    expect(splitReason(null)).toEqual({ claim: "", saw: null });
  });
});
