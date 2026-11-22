import { describe, expect, it } from "vitest";
import { buildCards, currentStep, defaultCard, featureOrder, groupByFeature, groupState, shortLabel, sortTrails, splitReason, summarize, trailStatus, verdictOf, type TrailCard } from "./overview";
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
  it("the Requirements page orders features exactly like the Run view", () => {
    const fresh = [req("x", { feature: "Untested", testable: false }), req("a", { feature: "B" }), req("n"), req("c", { feature: "A" })];
    const regression = [req("r", { feature: "Z" })];
    expect(groupByFeature(buildCards(fresh, regression, live([]))).map((g) => g.feature)).toEqual(["B", "A", "Z", "Other"]);
    // Features that only have untested asks follow, and no feature stays last.
    expect(featureOrder(fresh, regression)).toEqual(["B", "A", "Z", "Untested", "Other"]);
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

const trail = (o: Partial<TrailCard>): TrailCard => ({ id: "t", title: "T", branch: "b", state: "open", toReview: 0, requirements: 5, runOpen: false, lastRunAt: "2026-01-01T00:00:00Z", passed: 5, failed: 0, review: 0, ...o });

describe("trailStatus", () => {
  it("puts what needs attention first", () => {
    expect(trailStatus(trail({ runOpen: true, failed: 2 }))).toBe("running");
    expect(trailStatus(trail({ failed: 2, toReview: 3 }))).toBe("failing");
    expect(trailStatus(trail({ toReview: 3 }))).toBe("review");
    expect(trailStatus(trail({}))).toBe("ready");
    expect(trailStatus(trail({ lastRunAt: null }))).toBe("idle");
    expect(trailStatus(trail({ state: "merged", failed: 1 }))).toBe("merged");
  });
  it("lists running and failing Trails before ready and merged ones", () => {
    const sorted = sortTrails([trail({ id: "m", state: "merged" }), trail({ id: "r" }), trail({ id: "f", failed: 1 })]);
    expect(sorted.map((t) => t.id)).toEqual(["f", "r", "m"]);
  });
});

describe("currentStep", () => {
  const steps = ["Select the Team plan", "Select monthly billing", "Set the seat count to 10"];
  it("follows a step the agent names", () => expect(currentStep("CHECK 2 step 3: Increase Team seats to 7", steps, 0)).toBe(2));
  it("matches by words", () => expect(currentStep("Switch to monthly billing", steps, 0)).toBe(1));
  it("never goes backwards", () => expect(currentStep("Select the Team plan again", steps, 2)).toBe(2));
  it("treats wrapping up as the last step", () => expect(currentStep("Finish task with result", steps, 0)).toBe(2));
  it("stays put when nothing matches", () => expect(currentStep("Understand current page state", steps, 1)).toBe(1));
});
