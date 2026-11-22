import { describe, expect, it } from "vitest";
import { describeChange } from "./graph";
import { prMarkdown, type ReportDoc } from "./prReport";

const doc: ReportDoc = {
  trailId: "t1", title: "Annual billing", description: "Add annual billing.", branch: "feat/x", commit: "abc", ranAt: null, verdict: "hold", passed: 1, ran: 2,
  asks: [{ label: "Team gets 5% off", text: "Team gets 5% off at 10 seats", quote: "5% off at 10 or more seats" }],
  changes: [{ path: "lib/pricing.ts", status: "M", items: ["function annualQuote: body changed (2 dependents)"] }],
  proof: [
    { checkId: "c1", state: "failed", label: "Team gets 5% off", text: "x", claim: "No volume line.", saw: "Total $290.00", frame: null },
    { checkId: "c2", state: "passed", label: "Pro 5 seats", text: "y", claim: "", saw: null, frame: null },
  ],
  decisions: [{ was: "SAVE10 works on Team annual", now: "Volume plans skip the coupon" }], untestable: [],
};

describe("prMarkdown", () => {
  const md = prMarkdown(doc, "https://r.example");
  it("states why, what changed and proof in one document", () => {
    expect(md).toContain("### Why");
    expect(md).toContain('> "5% off at 10 or more seats"');
    expect(md).toContain("`lib/pricing.ts` (M)");
    expect(md).toContain("### Proof");
  });
  it("links the replay of a failure and the full report, and shows what the page really said", () => {
    expect(md).toContain("[Replay](https://r.example/t/t1/checks/c1)");
    expect(md).toContain("Saw: Total $290.00");
    expect(md).toContain("[Full report with replays](https://r.example/r/t1)");
  });
  it("surfaces a changed requirement as a decision", () => expect(md).toContain("Now: Volume plans skip the coupon"));
});

describe("describeChange", () => {
  it("reads as a sentence with dependents", () => {
    expect(describeChange({ type: "signature_changed", kind: "type", name: "PlanView", dependents_count: 3 })).toBe("type PlanView: signature changed (3 dependents)");
  });
});
