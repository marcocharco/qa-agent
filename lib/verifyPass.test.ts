import { describe, expect, it } from "vitest";
import { verifyPass } from "./verifyPass";
import type { Verdict } from "./verdict";

const pass: Verdict = { state: "passed", failedStep: null, reason: "ok" };
const ask = (r: { seen: string; contradicts: boolean } | Error) => (async () => { if (r instanceof Error) throw r; return r; }) as never;

describe("verifyPass", () => {
  it("turns a pass into a failure when the screenshot contradicts it", async () => {
    const v = await verifyPass(pass, "a/1.jpg", "Total $87.00", ask({ seen: "Total $58.00", contradicts: true }));
    expect(v.state).toBe("failed");
    expect(v.reason).toContain("$58.00");
  });
  it("keeps the pass when the screenshot agrees or shows nothing relevant", async () => {
    expect(await verifyPass(pass, "a/1.jpg", "x", ask({ seen: "", contradicts: false }))).toBe(pass);
  });
  it("keeps the pass when the model call fails or there is no screenshot", async () => {
    expect(await verifyPass(pass, "a/1.jpg", "x", ask(new Error("boom")))).toBe(pass);
    expect(await verifyPass(pass, null, "x")).toBe(pass);
  });
  it("never touches a non-pass", async () => {
    const f: Verdict = { state: "failed", failedStep: 1, reason: "r" };
    expect(await verifyPass(f, "a/1.jpg", "x", ask({ seen: "", contradicts: true }))).toBe(f);
  });
});
